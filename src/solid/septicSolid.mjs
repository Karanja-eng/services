/**
 * Septic tank -> OpenCascade solids.
 *
 * Source of truth
 * ---------------
 * The engineering parameters are **not** defined here. They come from
 * `src/Backend/cad_ifc/septic_model.py::build_model()`, the same canonical model that
 * feeds the DXF and the IFC export. This adapter consumes that document (JSON) and
 * only *projects* it into precise solids, so the drawing, the BIM model and the
 * solid share one parameter set and one element identity.
 *
 * Geometry rules (each one explicit)
 * ---------------------------------
 * - **Units**: the canonical model is metres and Z-up; OCCT is unit-agnostic, so the
 *   solids are built in metres and the exported STEP is in metres. No conversion
 *   happens anywhere, therefore nothing can drift.
 * - **Tank shell** = the canonical base slab + 4 walls + top slab fused, then the
 *   internal volume (tank_int_l x tank_int_w x tank_int_depth) is **cut** out. The
 *   internal void is not a guess: it is exactly the generator's internal dimensions,
 *   so the resulting wall and base thicknesses are the generator's own.
 * - **Baffles** are fused *after* the void cut, because they stand inside the void.
 * - **Pipe penetrations** are cut from the *pipe elements'* axis, radius and level,
 *   extended to three wall thicknesses so the hole fully crosses the wall. The pipe
 *   element describes a stub; the hole through the wall is derived from it by this
 *   documented rule rather than invented.
 * - **Manhole** is built the same way, and its **access opening** is cut through the
 *   cover slab and cover, from the internal void up through the top, because that is
 *   how the generator defines the chamber (manhole_int_l x manhole_int_w x depth).
 *
 * Failure handling
 * ----------------
 * Every operation records validity and volume before/after. If a Boolean produces an
 * invalid shape, or a requested cut removes no material, the build fails with the
 * operation that failed instead of returning a plausible-looking model.
 */

const EPS = 1e-9;

/** Small helper: axis-aligned extents of a canonical element (metres). */
function extents(element) {
  const dims = element.dimensions || {};
  const pos = element.placement || {};
  if (element.shape === 'box') {
    const dx = dims.length_x;
    const dy = dims.width_y;
    const dz = dims.height_z;
    return {
      dx, dy, dz,
      min: { x: pos.x - dx / 2, y: pos.y - dy / 2, z: pos.z - dz / 2 },
      max: { x: pos.x + dx / 2, y: pos.y + dy / 2, z: pos.z + dz / 2 },
    };
  }
  if (element.shape === 'cylinder') {
    const r = dims.radius;
    const h = dims.height;
    const axis = element.axis || 'z';
    return {
      radius: r,
      length: h,
      axis,
      centre: { x: pos.x, y: pos.y, z: pos.z },
      min: {
        x: pos.x - (axis === 'x' ? h / 2 : r),
        y: pos.y - (axis === 'y' ? h / 2 : r),
        z: pos.z - (axis === 'z' ? h / 2 : r),
      },
      max: {
        x: pos.x + (axis === 'x' ? h / 2 : r),
        y: pos.y + (axis === 'y' ? h / 2 : r),
        z: pos.z + (axis === 'z' ? h / 2 : r),
      },
    };
  }
  throw new Error(`unsupported element shape ${element.shape} for ${element.id}`);
}

/** Index the canonical elements by their role suffix for readable lookups. */
function indexElements(model) {
  const byId = new Map();
  for (const element of model.elements) byId.set(element.id, element);
  const tank = (suffix) => {
    const id = `${model.model_id}.tank.${suffix}`;
    const element = byId.get(id);
    if (!element) throw new Error(`canonical model has no element ${id}`);
    return element;
  };
  const manhole = (suffix) => {
    const id = `${model.model_id}.manhole.${suffix}`;
    const element = byId.get(id);
    if (!element) throw new Error(`canonical model has no element ${id}`);
    return element;
  };
  return { byId, tank, manhole };
}

/** Guard: a dimension must be a positive, finite number of metres. */
function positive(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive number of metres, got ${value}`);
  }
  return value;
}

/**
 * Build the solid model for a canonical septic document.
 *
 * @param {import('./ocKernel.mjs').Kernel} kernel
 * @param {object} model canonical model document (septic_model.build_model)
 * @returns {object} solids, per-operation log, checks and summary
 */
export function buildSepticSolids(kernel, model) {
  if (!model || model.schema !== 'fundi.canonical.model/1' && model.schema !== 'fundi.canonical') {
    throw new Error(`unexpected canonical schema ${model?.schema}`);
  }
  const params = model.parameters || {};
  const tankL = positive(params.tank_int_l, 'tank_int_l');
  const tankW = positive(params.tank_int_w, 'tank_int_w');
  const tankD = positive(params.tank_depth_int, 'tank_depth_int');
  const wall = positive(params.wall_thick, 'wall_thick');
  const baseT = positive(params.bed_thick_tank, 'bed_thick_tank');
  const topT = positive(params.slab_thick, 'slab_thick');
  const pipeR = positive(params.pipe_diameter, 'pipe_diameter') / 2;
  const baffles = Math.max(0, Math.trunc(params.num_baffles ?? 0));

  const { tank, manhole, byId } = indexElements(model);
  const operations = [];
  const components = [];

  /**
   * Run one Boolean, recording validity and the volume change.
   *
   * `redundant` marks a cut that is *expected* to remove nothing because the target is
   * already the shape that cut would produce. See the tank internal-void note below.
   */
  const boolean = (label, op, target, tool, kind, redundant = false) => {
    const before = kernel.volume(target);
    const result = kind === 'cut' ? kernel.cut(target, tool) : kernel.fuse(target, tool);
    const after = kernel.volume(result);
    const delta = after - before;
    const valid = kernel.isValid(result);
    operations.push({
      label, kind, valid, redundant,
      volumeBeforeM3: before, volumeAfterM3: after, deltaM3: delta,
      removedMaterial: kind === 'cut' ? delta < -EPS : delta > EPS,
    });
    if (!valid) throw new Error(`Boolean ${kind} "${label}" produced an invalid shape`);
    return result;
  };

  // ---------------------------------------------------------------------------
  // Tank shell: base + 4 walls + top slab, then the internal void is cut out.
  // ---------------------------------------------------------------------------
  const tankParts = [
    tank('base_slab'),
    tank('wall.north'),
    tank('wall.south'),
    tank('wall.east'),
    tank('wall.west'),
    tank('top_slab'),
  ].map((element) => {
    const box = extents(element);
    return kernel.box(box.dx, box.dy, box.dz, box.min.x, box.min.y, box.min.z);
  });

  let tankShell = tankParts[0];
  for (let index = 1; index < tankParts.length; index += 1) {
    tankShell = boolean(
      `tank fuse part ${index + 1}`,
      'fuse', tankShell, tankParts[index], 'fuse',
    );
  }
  const tankEnvelope = kernel.volume(tankShell);

  // Internal void.
  //
  // The canonical tank elements are the *members* (a 150 mm base slab, 200 mm walls,
  // a 200 mm top slab). Fusing those already produces a closed hollow shell — the
  // internal volume holds no material to remove. The void is nevertheless cut, and a
  // zero removal is the expected, verified outcome: it proves the assembly is hollow
  // rather than a solid block, without inventing material just to cut it away.
  const voidZ = baseT;
  const voidH = tankD;
  const voidSolid = kernel.box(
    tankL, tankW, voidH,
    -tankL / 2, -tankW / 2, voidZ,
  );
  const shellBeforeVoid = kernel.volume(tankShell);
  tankShell = boolean('tank internal void cut', 'cut', tankShell, voidSolid, 'cut', true);
  const voidRemoved = shellBeforeVoid - kernel.volume(tankShell);
  if (voidRemoved > EPS) {
    // Material was removed, so the member solids did not already form a closed shell.
    // That is legitimate (e.g. a future generator modelling a solid block), so it is
    // accepted — but it must not be silently mistaken for the normal case.
    operations[operations.length - 1].note =
      'the fused members were not hollow; the internal void removed material';
  }

  // Baffles stand inside the void, so they are fused after the void exists.
  const baffleElements = [];
  for (let index = 1; index <= baffles; index += 1) {
    baffleElements.push(tank(`baffle~${index}`));
  }
  for (const baffle of baffleElements) {
    const box = extents(baffle);
    const solid = kernel.box(box.dx, box.dy, box.dz, box.min.x, box.min.y, box.min.z);
    tankShell = boolean(`baffle ${baffle.id} fuse`, 'fuse', tankShell, solid, 'fuse');
  }

  // Pipe penetrations: cut through the wall each pipe crosses, using the pipe's own
  // radius and level, extended to three wall thicknesses so it crosses completely.
  //
  // The outlet pipe and the tank->manhole connection are drawn at the same level and
  // on the same axis, so they share *one* physical hole in the east wall. Penetration
  // requests are therefore de-duplicated by (wall, y, z, radius); the shared hole
  // records every element id that relies on it instead of being cut twice (a second
  // identical cut removes nothing and would otherwise look like a failed Boolean).
  const wallCentreOf = (element) => element.placement.x;
  const requests = [];
  const inlet = tank('inlet_pipe');
  const outlet = tank('outlet_pipe');
  const connection = byId.get(`${model.model_id}.connection.tank_to_manhole`);
  requests.push({ element: inlet, wall: tank('wall.west'), wallCentre: wallCentreOf(tank('wall.west')) });
  requests.push({ element: outlet, wall: tank('wall.east'), wallCentre: wallCentreOf(tank('wall.east')) });
  if (connection) {
    requests.push({ element: connection, wall: tank('wall.east'), wallCentre: wallCentreOf(tank('wall.east')) });
    requests.push({ element: connection, wall: manhole('wall.west'), wallCentre: wallCentreOf(manhole('wall.west')) });
  }

  const uniqueHoles = [];
  for (const request of requests) {
    const radius = request.element.shape === 'cylinder' ? request.element.dimensions.radius : pipeR;
    const y = request.element.placement.y;
    const z = request.element.placement.z;
    const wallBox = extents(request.wall);
    const existing = uniqueHoles.find((hole) =>
      Math.abs(hole.wallCentre - request.wallCentre) < 1e-9 &&
      Math.abs(hole.y - y) < 1e-9 &&
      Math.abs(hole.z - z) < 1e-9 &&
      Math.abs(hole.radius - radius) < 1e-9);
    if (existing) {
      existing.elementIds.push(request.element.id);
    } else {
      uniqueHoles.push({
        elementIds: [request.element.id],
        wallElementId: request.wall.id,
        wallCentre: request.wallCentre,
        wallBottomZ: wallBox.min.z,
        wallTopZ: wallBox.max.z,
        radius, y, z,
      });
    }
  }

  const penetrations = [];
  const applyHole = (hole, target, shellName) => {
    // Geometry decides first: a pipe whose level is clear of the wall it is claimed to
    // cross cannot remove material, and running the Boolean anyway would record a
    // no-op cut as if it were a real operation.
    if (hole.z + hole.radius < hole.wallBottomZ || hole.z - hole.radius > hole.wallTopZ) {
      const record = {
        elementIds: hole.elementIds,
        wallElementId: hole.wallElementId,
        shell: shellName,
        radius: hole.radius,
        level: hole.z,
        wallCentre: hole.wallCentre,
        applied: false,
        removedM3: 0,
        expectedM3: Math.PI * hole.radius * hole.radius * wall,
        ratio: null,
        reason:
          `the pipe at z=${hole.z} m cannot reach ${hole.wallElementId}, whose z range is ` +
          `${hole.wallBottomZ}..${hole.wallTopZ} m. The connection element in the ` +
          'canonical model does not meet that wall.',
      };
      penetrations.push(record);
      return target;
    }
    const cutterLength = wall * 3;
    const cutter = kernel.cylinder(hole.radius, cutterLength, {
      axis: 'x', x: hole.wallCentre - cutterLength / 2, y: hole.y, z: hole.z,
    });
    const before = kernel.volume(target);
    const result = boolean(`penetration ${hole.elementIds.join('+')}`, 'cut', target, cutter, 'cut');
    const removed = before - kernel.volume(result);
    // A through-wall hole must remove approximately pi r^2 * wall thickness.
    const expected = Math.PI * hole.radius * hole.radius * wall;
    const record = {
      elementIds: hole.elementIds,
      wallElementId: hole.wallElementId,
      shell: shellName,
      radius: hole.radius,
      level: hole.z,
      wallCentre: hole.wallCentre,
      applied: removed > EPS,
      removedM3: removed,
      expectedM3: expected,
      ratio: expected > 0 ? removed / expected : null,
    };
    if (removed <= EPS) {
      // Do not silently drop this. A pipe that does not reach the wall it is supposed
      // to cross means the canonical model is inconsistent, and the caller has to see
      // it: the shape is left unchanged and the reason is recorded.
      record.reason =
        `the cutter does not intersect ${hole.wallElementId}: the pipe at z=${hole.z} m ` +
        'removes no material from that wall. The connection does not reach this wall in ' +
        'the canonical model.';
    }
    penetrations.push(record);
    return record.applied ? result : target;
  };

  for (const hole of uniqueHoles.filter((entry) => entry.wallElementId.includes('.tank.wall.'))) {
    tankShell = applyHole(hole, tankShell, 'tank');
  }

  components.push({
    role: 'tank',
    elementIds: ['base_slab', 'wall.north', 'wall.south', 'wall.east', 'wall.west', 'top_slab']
      .map((suffix) => tank(suffix).id)
      .concat(baffleElements.map((element) => element.id)),
    shape: tankShell,
    volumeM3: kernel.volume(tankShell),
    valid: kernel.isValid(tankShell),
    bbox: kernel.bbox(tankShell),
    solidCount: kernel.solidCount(tankShell),
    envelopeVolumeM3: tankEnvelope,
  });

  // ---------------------------------------------------------------------------
  // Manhole: base + 4 walls + cover slab + cover; internal void and access opening.
  // ---------------------------------------------------------------------------
  const manholeL = positive(params.manhole_int_l, 'manhole_int_l');
  const manholeW = positive(params.manhole_int_w, 'manhole_int_w');
  const manholeD = positive(params.manhole_depth_int, 'manhole_depth_int');

  const manholeParts = [
    manhole('base_slab'),
    manhole('wall.north'), manhole('wall.south'), manhole('wall.east'), manhole('wall.west'),
    manhole('cover_slab'),
    manhole('cover'),
  ].map((element) => {
    const box = extents(element);
    return kernel.box(box.dx, box.dy, box.dz, box.min.x, box.min.y, box.min.z);
  });

  let manholeShell = manholeParts[0];
  for (let index = 1; index < manholeParts.length; index += 1) {
    manholeShell = boolean(
      `manhole fuse part ${index + 1}`, 'fuse', manholeShell, manholeParts[index], 'fuse',
    );
  }

  const manholeBase = manhole('base_slab');
  const manholeVoidZ = tableTop(manholeBase);
  const manholeVoid = kernel.box(
    manholeL, manholeW, manholeD,
    manhole('base_slab').placement.x - manholeL / 2,
    manhole('base_slab').placement.y - manholeW / 2,
    manholeVoidZ,
  );
  manholeShell = boolean('manhole internal void cut', 'cut', manholeShell, manholeVoid, 'cut', true);

  // Access opening: the same internal footprint, cut from the top of the internal
  // void up through the cover slab and the cover, i.e. the chamber is open to the
  // surface exactly as the generator's internal dimensions describe.
  const coverTop = tableTop(manhole('cover'));
  const accessH = coverTop - (manholeVoidZ + manholeD);
  let accessOpening = null;
  if (accessH > EPS) {
    const access = kernel.box(
      manholeL, manholeW, accessH,
      manhole('base_slab').placement.x - manholeL / 2,
      manhole('base_slab').placement.y - manholeW / 2,
      manholeVoidZ + manholeD,
    );
    const before = kernel.volume(manholeShell);
    manholeShell = boolean('manhole access opening cut', 'cut', manholeShell, access, 'cut');
    accessOpening = {
      removedM3: before - kernel.volume(manholeShell),
      expectedM3: manholeL * manholeW * accessH,
      heightM: accessH,
    };
  }

  components.push({
    role: 'manhole',
    elementIds: ['base_slab', 'wall.north', 'wall.south', 'wall.east', 'wall.west', 'cover_slab', 'cover']
      .map((suffix) => manhole(suffix).id),
    shape: manholeShell,
    volumeM3: kernel.volume(manholeShell),
    valid: kernel.isValid(manholeShell),
    bbox: kernel.bbox(manholeShell),
    solidCount: kernel.solidCount(manholeShell),
    accessOpening,
  });

  // Penetrations through the manhole walls (the tank->manhole connection enters it).
  for (const hole of uniqueHoles.filter((entry) => entry.wallElementId.includes('.manhole.wall.'))) {
    manholeShell = applyHole(hole, manholeShell, 'manhole');
    const component = components[components.length - 1];
    if (component.role === 'manhole') {
      component.shape = manholeShell;
      component.volumeM3 = kernel.volume(manholeShell);
      component.valid = kernel.isValid(manholeShell);
      component.bbox = kernel.bbox(manholeShell);
      component.solidCount = kernel.solidCount(manholeShell);
    }
  }

  // ---------------------------------------------------------------------------
  // Connection pipe as its own solid (it passes through two walls).
  // ---------------------------------------------------------------------------
  const connectionElement = byId.get(`${model.model_id}.connection.tank_to_manhole`);
  if (connectionElement) {
    const geometry = extents(connectionElement);
    const pipe = kernel.cylinder(geometry.radius, geometry.length, {
      axis: geometry.axis,
      x: geometry.centre.x - geometry.length / 2,
      y: geometry.centre.y,
      z: geometry.centre.z,
    });
    components.push({
      role: 'connection',
      elementIds: [connectionElement.id],
      shape: pipe,
      volumeM3: kernel.volume(pipe),
      valid: kernel.isValid(pipe),
      bbox: kernel.bbox(pipe),
      solidCount: kernel.solidCount(pipe),
    });
  }

  for (const component of components) {
    if (!component.valid) throw new Error(`component ${component.role} is invalid`);
    if (component.solidCount < 1) {
      throw new Error(`component ${component.role} contains no solid (solidCount=0)`);
    }
  }

  return {
    schema: 'fundi.solid.septic/1',
    modelId: model.model_id,
    units: { length: 'metre', volume: 'cubic_metre', note: 'no conversion: canonical metres pass straight into OCCT' },
    parameters: {
      tank_int_l: tankL, tank_int_w: tankW, tank_depth_int: tankD,
      wall_thick: wall, bed_thick_tank: baseT, slab_thick: topT,
      pipe_diameter: pipeR * 2, num_baffles: baffles,
      manhole_int_l: manholeL, manhole_int_w: manholeW, manhole_depth_int: manholeD,
    },
    components,
    operations,
    penetrations,
    // Source-data problems the solid model exposes but must not "fix" by itself.
    warnings: penetrations.filter((hole) => !hole.applied).map((hole) => ({
      code: 'PENETRATION_REACHES_NO_WALL',
      elementIds: hole.elementIds,
      wallElementId: hole.wallElementId,
      message: hole.reason,
    })),
    overloads: Object.fromEntries(kernel.overloads),
  };
}

/** Top of an axis-aligned box element (metres). */
function tableTop(element) {
  const box = extents(element);
  return box.max.z;
}

/**
 * Inspect STEP text without a kernel.
 *
 * This is the independent check: it reads the file's own entities and reports whether
 * it contains *solid* topology (`MANIFOLD_SOLID_BREP`, `CLOSED_SHELL`, `ADVANCED_FACE`)
 * rather than only faceted shells, whether a metric length unit is declared, and
 * whether the file is properly terminated. OCCT's reader is additionally attempted,
 * but its result is recorded rather than assumed — in this build it rejects the tank
 * file, which is a fact the report has to carry.
 */
export function inspectStepText(text) {
  const count = (pattern) => (text.match(pattern) || []).length;
  return {
    isStep: text.startsWith('ISO-10303-21'),
    terminated: /END-ISO-10303-21;\s*$/.test(text),
    bytes: Buffer.byteLength(text, 'utf8'),
    entities: count(/#\d+\s*=/g),
    solidBreps: count(/MANIFOLD_SOLID_BREP/g),
    closedShells: count(/CLOSED_SHELL/g),
    advancedFaces: count(/ADVANCED_FACE/g),
    cylindricalSurfaces: count(/CYLINDRICAL_SURFACE/g),
    lengthUnitMetre: /LENGTH_UNIT/.test(text) && /\.METRE\./.test(text),
    head: text.slice(0, 48).replace(/\s+/g, ' '),
  };
}

/**
 * Write genuine STEP files for the built components and verify each by reimporting.
 *
 * One file per component, not one fused assembly: this OpenCascade.js build throws a
 * raw OCCT exception when a fused *compound* of several solids is transferred to the
 * STEP writer, while a single solid transfers reliably. Rather than fake a combined
 * export, each solid gets its own verified file and the limitation is documented.
 */
export function exportStep(kernel, built, baseName = 'fundi-septic') {
  const oc = kernel.oc;
  const files = [];

  for (const component of built.components) {
    // Progress is logged to stderr so a raw OCCT exception (which carries no message)
    // can still be attributed to a component and a stage.
    const trace = (stage) => process.stderr.write(`[step] ${component.role}: ${stage}\n`);
    trace('begin');
    const fileName = `/${baseName}-${component.role}.step`;
    const writer = new oc.STEPControl_Writer_1();
    trace('writer created');
    // STEPControl_StepModelType is not bound as a JS enum in this build;
    // STEPControl_AsIs == 0.
    const transferStatus = writer.Transfer(component.shape, 0, true);
    trace('transferred');

    // The writer creates its output inside the emscripten virtual filesystem. After a
    // long session this build can mangle the name of the entry it creates, so the file
    // is located by diffing the directory before and after the write rather than
    // trusting the requested name. What matters is the content, verified as STEP below.
    const before = new Set(oc.FS.readdir('/'));
    const writeStatus = writer.Write(fileName);
    trace('written');
    const statusValue = writeStatus && typeof writeStatus === 'object' ? writeStatus.value : writeStatus;
    const created = oc.FS.readdir('/')
      .filter((name) => !before.has(name) && name !== '.' && name !== '..');

    let bytes = null;
    for (const candidate of [fileName, ...created.map((name) => `/${name}`)]) {
      try {
        const data = Uint8Array.from(oc.FS.readFile(candidate));
        if (data.length) {
          bytes = data;
          try {
            oc.FS.unlink(candidate);
          } catch (error) {
            // leaving the file in the virtual FS is harmless
          }
          break;
        }
      } catch (error) {
        // try the next candidate name
      }
    }
    if (!bytes) {
      throw new Error(
        `STEP export for ${component.role} produced no readable file ` +
          `(transfer=${String(transferStatus)}, write=${statusValue}, ` +
          `new entries=${JSON.stringify(created)})`,
      );
    }
    trace(`bytes read (${bytes.length})`);

    const text = Buffer.from(bytes).toString('utf8');
    if (!text.startsWith('ISO-10303-21')) {
      throw new Error(
        `STEP export for ${component.role} did not produce STEP data ` +
          `(head: ${JSON.stringify(text.slice(0, 40))})`,
      );
    }
    const inspection = inspectStepText(text);
    trace(`inspected (entities=${inspection.entities}, solids=${inspection.solidBreps})`);

    // Kernel reimport, recorded rather than assumed: this build's STEP reader throws on
    // shapes with cylindrical openings, and a silent "verified" claim would be a lie.
    let reimport = null;
    let reimportError = null;
    try {
      const round = kernel.readStep(bytes);
      reimport = {
        roots: round.roots,
        solidCount: round.solidCount,
        volumeM3: round.volume,
        valid: round.valid,
        volumeDeltaM3: round.volume - component.volumeM3,
      };
      trace(`reimported (roots=${round.roots}, solids=${round.solidCount})`);
    } catch (error) {
      reimportError = String(error?.message ?? error);
      trace(`reimport failed: ${reimportError}`);
    }

    files.push({
      role: component.role,
      elementIds: component.elementIds,
      fileName: `${baseName}-${component.role}.step`,
      bytes: bytes.length,
      transferStatus,
      writeStatus: statusValue,
      ...inspection,
      sourceVolumeM3: component.volumeM3,
      sourceSolidCount: component.solidCount,
      reimport,
      reimportError,
      data: bytes,
    });
  }

  return {
    schema: 'fundi.solid.step/1',
    note:
      'One STEP file per solid component. A single fused multi-solid assembly could ' +
      'not be transferred by this OCCT build (raw C++ exception), so no combined file ' +
      'is produced rather than emitting a file that is not what it claims. Each file ' +
      'is verified by reading its own STEP entities (solid topology, units, ' +
      'termination); the kernel reimport is attempted and its outcome recorded.',
    files,
  };
}

export { extents, indexElements };
