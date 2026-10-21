/**
 * Bootstrap and helper layer for OpenCascade.js (OCCT compiled to WebAssembly).
 *
 * Why this module exists
 * ----------------------
 * `opencascade.js@1.1.1` ships a prebuilt full OCCT build (LGPL-2.1) but the package
 * makes three assumptions that only hold inside a bundler:
 *
 *  1. `dist/opencascade.wasm.js` ends with `export default` (ESM) while its body uses
 *     `__dirname` (CJS), so neither module system alone can load it;
 *  2. its loader calls `fetch()` for the `.wasm`, which does not work for a local
 *     file in Node;
 *  3. overloaded C++ constructors get numeric suffixes (`_1`, `_2`, ...) in the
 *     order they were declared, with no published map of which suffix is which.
 *
 * This module hides (1) and (2) behind `loadKernel()`, and (3) behind a small
 * "pick the first overload that accepts these arguments" helper that caches the
 * winner and records it, so the chosen signature can be reported and documented
 * instead of guessed.
 *
 * It is deliberately free of any septic-tank or Fundi-specific logic: the geometry
 * adapter (`septicSolid.mjs`) owns that. Keeping the kernel layer generic is what
 * makes it reusable for other members later.
 */

const DIST = 'node_modules/opencascade.js/dist';
const GLUE = `${DIST}/opencascade.wasm.js`;
const WASM = `${DIST}/opencascade.wasm.wasm`;

/**
 * Load the OCCT kernel.
 *
 * In Node the module rewrites the default export to `module.exports`, loads it with
 * `createRequire`, and hands the WASM binary over directly. In a browser it uses the
 * package entry point and lets the bundler resolve the `.wasm` asset, unless the
 * caller supplies a URL.
 *
 * @param {{ wasmBinary?: Uint8Array, locateFile?: (file: string) => string }} [options]
 * @returns {Promise<object>} the emscripten module (`oc`)
 */
export async function loadKernel(options = {}) {
  const isNode =
    typeof process !== 'undefined' && Boolean(process.versions?.node) && typeof window === 'undefined';

  if (isNode) {
    const fs = await import('node:fs');
    const path = await import('node:path');
    const { createRequire } = await import('node:module');
    const { fileURLToPath } = await import('node:url');

    // Resolve relative to this file so the caller's cwd does not matter. fileURLToPath
    // is required: import.meta.url percent-encodes spaces ("Java%20script").
    const here = path.dirname(fileURLToPath(import.meta.url));
    const distDir = path.resolve(here, '..', '..', ...DIST.split('/'));
    const glueSource = path.join(distDir, 'opencascade.wasm.js');
    const wasmPath = path.join(distDir, 'opencascade.wasm.wasm');

    const cacheDir = path.resolve(here, '..', '..', '.test-artifacts', 'oc');
    fs.mkdirSync(cacheDir, { recursive: true });
    const cjsPath = path.join(cacheDir, 'opencascade.kernel.cjs');
    if (!fs.existsSync(cjsPath)) {
      const source = fs.readFileSync(glueSource, 'utf8');
      if (!source.includes('export default opencascade;')) {
        throw new Error(
          `unexpected opencascade.js glue format in ${glueSource}: the CJS shim needs ` +
            'the `export default opencascade;` tail. Re-check the package version.',
        );
      }
      fs.writeFileSync(
        cjsPath,
        source.replace('export default opencascade;', 'module.exports = opencascade;'),
        'utf8',
      );
    }
    const factory = createRequire(import.meta.url)(cjsPath);
    return factory({
      wasmBinary: options.wasmBinary ?? fs.readFileSync(wasmPath),
      print: options.print ?? (() => {}),
      printErr: options.printErr ?? (() => {}),
    });
  }

  const mod = await import('opencascade.js');
  return mod.initOpenCascade({
    locateFile: options.locateFile ?? ((file) => new URL(file, import.meta.url).href),
    print: options.print ?? (() => {}),
    printErr: options.printErr ?? (() => {}),
  });
}

/**
 * Wraps the emscripten module with the handful of OCCT operations this project
 * needs, hiding overload-suffix details and recording which overload was used.
 */
export class Kernel {
  constructor(oc) {
    this.oc = oc;
    /** @type {Map<string, string>} operation -> overload name actually used */
    this.overloads = new Map();
    /** @type {Array<{op: string, overload: string, ok: boolean, error?: string}>} */
    this.operations = [];
  }

  /** Try each candidate in order; cache and record the first that works. */
  _pick(op, candidates) {
    const cached = this.overloads.get(op);
    if (cached) {
      const entry = candidates.find(([name]) => name === cached);
      if (entry) {
        const value = entry[1]();
        this._log(op, cached, true);
        return value;
      }
    }
    const errors = [];
    for (const [name, run] of candidates) {
      try {
        const value = run();
        this.overloads.set(op, name);
        this._log(op, name, true);
        return value;
      } catch (error) {
        errors.push(`${name}: ${error.message}`);
      }
    }
    this._log(op, 'none', false, errors.join(' | '));
    throw new Error(
      `no working OpenCascade binding for ${op}. Tried: ${errors.join(' ; ')}`,
    );
  }

  _log(op, overload, ok, error) {
    this.operations.push({ op, overload, ok, ...(error ? { error } : {}) });
  }

  /**
   * OCCT primitives, with their 3-double constructor discovered once and cached.
   *
   * The overload suffix numbering is *not* consistent across OCCT classes — `gp_Pnt_3`
   * is the (x, y, z) constructor while `gp_Dir_2` and `gp_Vec_3` are copy
   * constructors — so each is resolved by trying the candidates in order.
   */
  _pnt(x, y, z) {
    const oc = this.oc;
    return this._pick('gp_Pnt', ['gp_Pnt_1', 'gp_Pnt_2', 'gp_Pnt_3', 'gp_Pnt_4'].map((name) => [
      name, () => new oc[name](x, y, z),
    ]));
  }

  _dir(x, y, z) {
    const oc = this.oc;
    return this._pick('gp_Dir', ['gp_Dir_1', 'gp_Dir_2', 'gp_Dir_3', 'gp_Dir_4'].map((name) => [
      name, () => new oc[name](x, y, z),
    ]));
  }

  _vec(x, y, z) {
    const oc = this.oc;
    return this._pick('gp_Vec', ['gp_Vec_1', 'gp_Vec_2', 'gp_Vec_3', 'gp_Vec_4'].map((name) => [
      name, () => new oc[name](x, y, z),
    ]));
  }

  _ax2(point, direction) {
    const oc = this.oc;
    return this._pick('gp_Ax2', ['gp_Ax2_1', 'gp_Ax2_2', 'gp_Ax2_3'].map((name) => [
      `${name}(pnt,dir)`, () => new oc[name](point, direction),
    ]));
  }

  _ax1(point, direction) {
    const oc = this.oc;
    return this._pick('gp_Ax1', ['gp_Ax1_1', 'gp_Ax1_2', 'gp_Ax1_3'].map((name) => [
      `${name}(pnt,dir)`, () => new oc[name](point, direction),
    ]));
  }

  /** Axis-aligned box with its minimum corner at (x, y, z). */
  box(dx, dy, dz, x = 0, y = 0, z = 0) {
    const oc = this.oc;
    return this._pick('makeBox', [
      ['MakeBox_2(pnt,dx,dy,dz)', () => new oc.BRepPrimAPI_MakeBox_2(
        this._pnt(x, y, z), dx, dy, dz,
      ).Shape()],
      ['MakeBox_1(dx,dy,dz)+translate', () => {
        const base = new oc.BRepPrimAPI_MakeBox_1(dx, dy, dz).Shape();
        return x === 0 && y === 0 && z === 0 ? base : this.translate(base, x, y, z);
      }],
    ]);
  }

  /** Cylinder of radius `r` and length `h` whose base centre is (x, y, z). */
  cylinder(r, h, { axis = 'z', x = 0, y = 0, z = 0 } = {}) {
    const oc = this.oc;
    const direction = axis === 'x' ? [1, 0, 0] : axis === 'y' ? [0, 1, 0] : [0, 0, 1];
    return this._pick(`makeCylinder[${axis}]`, [
      [`MakeCylinder_2(ax2,r,h) axis=${axis}`, () => new oc.BRepPrimAPI_MakeCylinder_2(
        this._ax2(this._pnt(x, y, z), this._dir(...direction)), r, h,
      ).Shape()],
      [`MakeCylinder_1(r,h)+rotate+translate axis=${axis}`, () => {
        const base = new oc.BRepPrimAPI_MakeCylinder_1(r, h).Shape();
        const oriented = axis === 'z' ? base : this.rotateY(base, Math.PI / 2);
        return x === 0 && y === 0 && z === 0 ? oriented : this.translate(oriented, x, y, z);
      }],
    ]);
  }

  /** Boolean subtraction: `a` minus `b`. */
  cut(a, b) {
    const oc = this.oc;
    return this._pick('cut', [
      ['BRepAlgoAPI_Cut_3(a,b)', () => new oc.BRepAlgoAPI_Cut_3(a, b).Shape()],
      ['BRepAlgoAPI_Cut_2(a,b)', () => new oc.BRepAlgoAPI_Cut_2(a, b).Shape()],
    ]);
  }

  /** Boolean union of two solids. */
  fuse(a, b) {
    const oc = this.oc;
    return this._pick('fuse', [
      ['BRepAlgoAPI_Fuse_3(a,b)', () => new oc.BRepAlgoAPI_Fuse_3(a, b).Shape()],
      ['BRepAlgoAPI_Fuse_2(a,b)', () => new oc.BRepAlgoAPI_Fuse_2(a, b).Shape()],
    ]);
  }

  /** Fuse a list of solids left to right. */
  fuseAll(shapes) {
    if (!shapes.length) throw new Error('fuseAll requires at least one shape');
    return shapes.slice(1).reduce((accumulated, shape) => this.fuse(accumulated, shape), shapes[0]);
  }

  translate(shape, dx, dy, dz) {
    const oc = this.oc;
    // Overload suffix ordering is not consistent between OCCT classes, so the
    // translation is discovered rather than assumed.
    const trsf = this._pick('makeTranslation', [
      ['gp_Vec(x,y,z)+SetTranslation_1', () => {
        const t = new oc.gp_Trsf_1();
        t.SetTranslation_1(this._vec(dx, dy, dz));
        return t;
      }],
      ['SetTranslation_2(p0,p1)', () => {
        const t = new oc.gp_Trsf_1();
        t.SetTranslation_2(this._pnt(0, 0, 0), this._pnt(dx, dy, dz));
        return t;
      }],
    ]);
    return new oc.BRepBuilderAPI_Transform_2(shape, trsf, true).Shape();
  }

  rotateY(shape, radians) {
    const oc = this.oc;
    const trsf = this._pick('makeRotationY', [
      ['gp_Ax1(pnt,dir)+SetRotation_1', () => {
        const t = new oc.gp_Trsf_1();
        t.SetRotation_1(this._ax1(this._pnt(0, 0, 0), this._dir(0, 1, 0)), radians);
        return t;
      }],
    ]);
    return new oc.BRepBuilderAPI_Transform_2(shape, trsf, true).Shape();
  }

  /** True when OCCT considers the shape valid (no topological defects). */
  isValid(shape) {
    const oc = this.oc;
    return this._pick('isValid', [
      ['BRepCheck_Analyzer.IsValid_1(shape)', () => oc.BRepCheck_Analyzer.IsValid_1(shape)],
      ['Analyzer(shape,true).IsValid_1(shape)', () => new oc.BRepCheck_Analyzer(shape, true).IsValid_1(shape)],
    ]);
  }

  /** Solid volume in the model's length units cubed. */
  volume(shape) {
    const oc = this.oc;
    const props = new oc.GProp_GProps_1();
    oc.BRepGProp.VolumeProperties_1(shape, props, false, false, false);
    return props.Mass();
  }

  /** Axis-aligned bounding box as {min:{x,y,z}, max:{x,y,z}, size:{x,y,z}}. */
  bbox(shape) {
    const oc = this.oc;
    const box = new oc.Bnd_Box_1();
    // Bnd_Box carries a default gap that inflates every extent by ~1e-7. It is a
    // display tolerance, not geometry, so it is removed before measuring.
    try {
      box.SetGap(0.0);
    } catch (error) {
      // older builds have no SetGap; the tolerance is handled by the callers
    }
    oc.BRepBndLib.Add(shape, box, false);
    const bounds = this._pick('bndBoxGet', [
      ['Bnd_Box.Get()', () => {
        const values = box.Get();
        return Array.from(values, (value) => Number(value));
      }],
      ['CornerMin/CornerMax', () => {
        const min = box.CornerMin();
        const max = box.CornerMax();
        return [min.X(), min.Y(), min.Z(), max.X(), max.Y(), max.Z()];
      }],
    ]);
    const [xmin, ymin, zmin, xmax, ymax, zmax] = bounds;
    return {
      min: { x: xmin, y: ymin, z: zmin },
      max: { x: xmax, y: ymax, z: zmax },
      size: { x: xmax - xmin, y: ymax - ymin, z: zmax - zmin },
    };
  }

  /** Number of solid sub-shapes (proves the model is made of solids, not faces). */
  solidCount(shape) {
    const oc = this.oc;
    let count = 0;
    const explorer = new oc.TopExp_Explorer_2(
      shape, oc.TopAbs_ShapeEnum.TopAbs_SOLID, oc.TopAbs_ShapeEnum.TopAbs_SHAPE,
    );
    for (; explorer.More(); explorer.Next()) count += 1;
    return count;
  }

  /**
   * Write a STEP file and return its bytes.
   *
   * The writer works in the emscripten virtual filesystem, so the bytes are read
   * back out with `FS.readFile` and returned; the caller decides where to put them.
   * Returns `{ bytes, transferStatus, writeStatus }` so a failed export is visible
   * rather than producing an empty `.step` file.
   */
  writeStep(shape, fileName = '/fundi.step') {
    const oc = this.oc;
    const writer = new oc.STEPControl_Writer_1();
    // STEPControl_StepModelType is not bound as a JS enum in this build; the C++
    // value STEPControl_AsIs is 0, which is what the writer expects here.
    const transferStatus = writer.Transfer(shape, 0, true);
    const writeStatus = writer.Write(fileName);
    const statusValue = writeStatus && typeof writeStatus === 'object' ? writeStatus.value : writeStatus;
    if (!oc.FS.readdir('/').includes(fileName.replace(/^\//, ''))) {
      throw new Error(
        `STEP writer produced no file (transfer=${transferStatus}, write=${statusValue}); ` +
          'refusing to return an empty export',
      );
    }
    const bytes = Uint8Array.from(oc.FS.readFile(fileName));
    oc.FS.unlink(fileName);
    return { bytes, transferStatus, writeStatus: statusValue };
  }

  /** Read a STEP file from bytes and return `{ shape, roots, volume, valid }`. */
  readStep(bytes, fileName = '/fundi-reimport.step') {
    const oc = this.oc;
    oc.FS.writeFile(fileName, bytes);
    const reader = new oc.STEPControl_Reader_1();
    const readStatus = reader.ReadFile(fileName);
    reader.TransferRoots();
    const roots = reader.NbRootsForTransfer();
    const shape = reader.OneShape();
    oc.FS.unlink(fileName);
    const volume = this.volume(shape);
    return {
      shape, roots, readStatus, volume,
      solidCount: this.solidCount(shape),
      valid: this.isValid(shape),
    };
  }
}

export default loadKernel;
