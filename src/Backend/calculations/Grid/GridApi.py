
# Design Functions
def design_slab(data: SlabData):
    area = (data.width / 1000) * (data.height / 1000)
    concrete_density = 25
    slab_thickness = 150 / 1000
    dead_load = area * slab_thickness * concrete_density
    live_load = area * 2.5
    dead_load_factor = 1.4
    live_load_factor = 1.6
    total_load = (dead_load * dead_load_factor) + (live_load * live_load_factor)
    return {"load": total_load}

def design_column(data: ColumnData):
    area = (data.width / 1000) * (data.height / 1000)
    concrete_density = 25
    column_height = 3000 / 1000
    dead_load = area * column_height * concrete_density
    live_load = area * 5
    dead_load_factor = 1.4
    live_load_factor = 1.6
    total_load = (dead_load * dead_load_factor) + (live_load * live_load_factor)
    return {"load": total_load}

def design_beam(data: BeamData):
    area = (data.width / 1000) * (data.depth / 1000)
    concrete_density = 25
    column_height = 3000 / 1000
    dead_load = area * column_height * concrete_density
    live_load = (data.width / 1000) * 2.5
    dead_load_factor = 1.4
    live_load_factor = 1.6
    total_load = (dead_load * dead_load_factor) + (live_load * live_load_factor)
    return {"load": total_load}

def design_foundation(data: FoundationData):
    column_data = ColumnData(id=data.column_id, width=300, height=300, rotation=0.0)
    area = (data.width / 1000) * (data.height / 1000)
    column_load = design_column(column_data)["load"]
    safety_factor = 1.5
    total_load = column_load * safety_factor
    return {"load": total_load}

# API Endpoints
@app.get("/grid")
async def get_grid():
    return {
        "rows": 3,
        "cols": 3,
        "panelDimensions": {"1A": {"width": 7200, "height": 6000}, "1B": {"width": 7200, "height": 6000}, "2A": {"width": 7200, "height": 6000}, "2B": {"width": 7200, "height": 6000}},
        "columnDimensions": {"1A": {"width": 300, "height": 300, "rotation": 0}, "1B": {"width": 300, "height": 300, "rotation": 0}, "1C": {"width": 300, "height": 300, "rotation": 0}, "2A": {"width": 300, "height": 300, "rotation": 0}, "2B": {"width": 300, "height": 300, "rotation": 0}, "2C": {"width": 300, "height": 300, "rotation": 0}, "3A": {"width": 300, "height": 300, "rotation": 0}, "3B": {"width": 300, "height": 300, "rotation": 0}, "3C": {"width": 300, "height": 300, "rotation": 0}},
        "beamDimensions": {"beam1A": {"width": 7200, "depth": 400, "breadth": 300}, "beam2A": {"width": 7200, "depth": 400, "breadth": 300}, "beamA1": {"width": 6000, "depth": 400, "breadth": 300}, "beamB1": {"width": 6000, "depth": 400, "breadth": 300}}
    }

@app.post("/grid")
async def update_grid(data: GridData):
    return data

@app.get("/slab_design")
async def get_slab_design():
    grid = await get_grid()
    return grid.get("panelDimensions", {})  # Return panelDimensions directly

@app.post("/slab_design")
async def post_slab_design(data: SlabData):
    result = design_slab(data)
    return {"load": result["load"]}

@app.get("/column_design")
async def get_column_design():
    grid = await get_grid()
    return grid.get("columnDimensions", {})  # Return columnDimensions directly

@app.post("/column_design")
async def post_column_design(data: ColumnData):
    result = design_column(data)
    return {"load": result["load"]}

@app.get("/beam_design")
async def get_beam_design():
    grid = await get_grid()
    return grid.get("beamDimensions", {})  # Return beamDimensions directly

@app.post("/beam_design")
async def post_beam_design(data: BeamData):
    result = design_beam(data)
    return {"load": result["load"]}

@app.get("/foundation_design")
async def get_foundation_design():
    grid = await get_grid()
    return grid.get("columnDimensions", {})  # Use columnDimensions as foundation IDs

@app.post("/foundation_design")
async def post_foundation_design(data: FoundationData):
    result = design_foundation(data)
    return {"load": result["load"]}
