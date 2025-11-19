"""
FastAPI Backend for Roof CAD Application
Handles roof calculations, image processing, and data export
"""

from fastapi import FastAPI, APIRouter, File, UploadFile, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
import cv2
import numpy as np
from io import BytesIO
from PIL import Image
import base64
import json

# Import calculation module
from .RoofBackend import (
    RoofCalculator,
    RoofDimensions,
    MemberSizes,
    CoveringDetails,
    RoofQuantities,
)


router = APIRouter()


# Pydantic models for API requests
class RoofConfigRequest(BaseModel):
    """Request model for roof configuration"""

    roof_type: str = Field(
        ..., description="Type of roof: gable, hipped, gambrel, lean-to"
    )
    building_length: float = Field(..., gt=0, description="Building length in meters")
    building_width: float = Field(
        ..., gt=0, description="Building width/span in meters"
    )
    wall_thickness: float = Field(0.3, ge=0, description="Wall thickness in meters")
    overhang: float = Field(0.6, ge=0, description="Eaves overhang in meters")
    pitch_angle: float = Field(..., ge=10, le=70, description="Pitch angle in degrees")
    truss_spacing: float = Field(1.8, gt=0, description="Truss spacing in meters")
    rafter_spacing: float = Field(0.6, gt=0, description="Rafter spacing in meters")
    bearer_spacing: float = Field(0.6, gt=0, description="Bearer spacing in meters")
    material: str = Field("timber", description="Material: timber or steel")

    # Member sizes (optional, will use defaults if not provided)
    wall_plate_size: Optional[List[float]] = None
    rafter_size: Optional[List[float]] = None
    tie_beam_size: Optional[List[float]] = None
    strut_size: Optional[List[float]] = None
    ridge_size: Optional[List[float]] = None
    purlin_size: Optional[List[float]] = None

    # Covering details (optional)
    covering_type: Optional[str] = None
    sheet_length: Optional[float] = None
    sheet_width: Optional[float] = None
    side_overlap: Optional[float] = None
    end_overlap: Optional[float] = None
    tile_length: Optional[float] = None
    tile_width: Optional[float] = None
    tile_lap: Optional[float] = None
    wastage_percent: float = Field(10.0, ge=0, le=50)

    # Valleys
    has_valley: bool = False
    valley_length: float = 0.0

    # Downpipes
    downpipe_length: float = 3.0


class ImageProcessRequest(BaseModel):
    """Request model for image processing"""

    image_base64: str
    operation: str = Field(
        ..., description="Operation: contours, dimensions, plan_analysis"
    )
    scale: Optional[float] = None  # Scale in meters per pixel


# Helper functions for image processing
def decode_base64_image(base64_str: str) -> np.ndarray:
    """Decode base64 string to OpenCV image"""
    try:
        # Remove data URL prefix if present
        if "," in base64_str:
            base64_str = base64_str.split(",")[1]

        img_data = base64.b64decode(base64_str)
        nparr = np.frombuffer(img_data, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        return img
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to decode image: {str(e)}")


def encode_image_to_base64(img: np.ndarray) -> str:
    """Encode OpenCV image to base64"""
    _, buffer = cv2.imencode(".png", img)
    img_base64 = base64.b64encode(buffer).decode("utf-8")
    return f"data:image/png;base64,{img_base64}"


def detect_outer_contours(gray_img: np.ndarray) -> List:
    """Detect outer contours of building plan"""
    # Apply Gaussian blur
    blurred = cv2.GaussianBlur(gray_img, (5, 5), 0)

    # Edge detection
    edges = cv2.Canny(blurred, 50, 150)

    # Morphological operations to close gaps
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (5, 5))
    closed = cv2.morphologyEx(edges, cv2.MORPH_CLOSE, kernel)

    # Find contours
    contours, _ = cv2.findContours(closed, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)

    # Filter contours by area
    min_area = 1000
    filtered_contours = [c for c in contours if cv2.contourArea(c) > min_area]

    # Sort by area (largest first)
    filtered_contours = sorted(filtered_contours, key=cv2.contourArea, reverse=True)

    return filtered_contours


def extract_dimensions_from_plan(img: np.ndarray, scale: float = None) -> Dict:
    """Extract dimensions from building plan"""
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    contours = detect_outer_contours(gray)

    if not contours:
        return {"error": "No contours detected"}

    # Get bounding rectangle of largest contour
    main_contour = contours[0]
    x, y, w, h = cv2.boundingRect(main_contour)

    # Calculate approximate polygon
    epsilon = 0.02 * cv2.arcLength(main_contour, True)
    approx = cv2.approxPolyDP(main_contour, epsilon, True)

    # Calculate dimensions
    dimensions = {
        "width_pixels": w,
        "height_pixels": h,
        "perimeter_pixels": cv2.arcLength(main_contour, True),
        "area_pixels": cv2.contourArea(main_contour),
        "num_vertices": len(approx),
        "vertices": approx.tolist(),
    }

    # If scale is provided, convert to meters
    if scale:
        dimensions["width_meters"] = w * scale
        dimensions["height_meters"] = h * scale
        dimensions["perimeter_meters"] = dimensions["perimeter_pixels"] * scale
        dimensions["area_meters"] = dimensions["area_pixels"] * (scale**2)

    return dimensions


def npimg_to_png_bytes(img: np.ndarray) -> bytes:
    """Convert numpy image to PNG bytes"""
    is_success, buffer = cv2.imencode(".png", img)
    if not is_success:
        raise HTTPException(status_code=500, detail="Failed to encode image")
    return buffer.tobytes()


# API Endpoints


@router.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Roof CAD Pro API",
        "version": "1.0.0",
        "endpoints": {
            "calculate": "/api/calculate",
            "process_image": "/api/process-image",
            "extract_contours": "/api/extract-contours",
            "generate_takeoff": "/api/generate-takeoff",
            "generate_boq": "/api/generate-boq",
        },
    }


@router.post("/api/calculate")
async def calculate_roof(config: RoofConfigRequest):
    """
    Calculate roof quantities based on configuration
    """
    try:
        # Create dimension object
        dims = RoofDimensions(
            building_length=config.building_length,
            building_width=config.building_width,
            wall_thickness=config.wall_thickness,
            overhang=config.overhang,
            pitch_angle=config.pitch_angle,
            truss_spacing=config.truss_spacing,
            rafter_spacing=config.rafter_spacing,
            bearer_spacing=config.bearer_spacing,
        )

        # Create member sizes object
        sizes = MemberSizes()
        if config.wall_plate_size:
            sizes.wall_plate = tuple(config.wall_plate_size)
        if config.rafter_size:
            sizes.rafter = tuple(config.rafter_size)
        if config.tie_beam_size:
            sizes.tie_beam = tuple(config.tie_beam_size)
        if config.strut_size:
            sizes.strut = tuple(config.strut_size)
        if config.ridge_size:
            sizes.ridge = tuple(config.ridge_size)
        if config.purlin_size:
            sizes.purlin = tuple(config.purlin_size)

        # Create covering details if provided
        covering = None
        if config.covering_type:
            covering = CoveringDetails(
                type=config.covering_type,
                sheet_length=config.sheet_length,
                sheet_width=config.sheet_width,
                side_overlap=config.side_overlap,
                end_overlap=config.end_overlap,
                tile_length=config.tile_length,
                tile_width=config.tile_width,
                tile_lap=config.tile_lap,
                wastage_percent=config.wastage_percent,
            )

        # Create calculator
        calculator = RoofCalculator(
            roof_type=config.roof_type,
            dimensions=dims,
            member_sizes=sizes,
            material=config.material,
            covering=covering,
            has_valley=config.has_valley,
            valley_length=config.valley_length,
            downpipe_length=config.downpipe_length,
        )

        # Calculate quantities
        quantities = calculator.calculate_all()

        # Convert to dict
        result = {
            "success": True,
            "quantities": {
                "wall_plate_m": quantities.wall_plate_m,
                "principal_rafter_m": quantities.principal_rafter_m,
                "common_rafter_m": quantities.common_rafter_m,
                "tie_beam_m": quantities.tie_beam_m,
                "ties_m": quantities.ties_m,
                "struts_m": quantities.struts_m,
                "binders_m": quantities.binders_m,
                "ridge_m": quantities.ridge_m,
                "purlins_m": quantities.purlins_m,
                "hips_m": quantities.hips_m,
                "valleys_m": quantities.valleys_m,
                "num_trusses": quantities.num_trusses,
                "num_common_rafters": quantities.num_common_rafters,
                "covering_area_m2": quantities.covering_area_m2,
                "num_covering_units": quantities.num_covering_units,
                "ridge_cover_m": quantities.ridge_cover_m,
                "fascia_m": quantities.fascia_m,
                "verge_m": quantities.verge_m,
                "gutter_len_m": quantities.gutter_len_m,
                "downpipe_m": quantities.downpipe_m,
                "roof_height": quantities.roof_height,
                "rafter_length": quantities.rafter_length,
                "effective_span": quantities.effective_span,
                "effective_length": quantities.effective_length,
            },
        }

        return result

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Calculation error: {str(e)}")


@router.post("/api/generate-takeoff")
async def generate_takeoff(config: RoofConfigRequest):
    """
    Generate detailed quantity takeoff sheet
    """
    try:
        # Create calculator (same as calculate endpoint)
        dims = RoofDimensions(
            building_length=config.building_length,
            building_width=config.building_width,
            wall_thickness=config.wall_thickness,
            overhang=config.overhang,
            pitch_angle=config.pitch_angle,
            truss_spacing=config.truss_spacing,
            rafter_spacing=config.rafter_spacing,
            bearer_spacing=config.bearer_spacing,
        )

        sizes = MemberSizes()

        covering = None
        if config.covering_type:
            covering = CoveringDetails(
                type=config.covering_type,
                sheet_length=config.sheet_length,
                sheet_width=config.sheet_width,
                side_overlap=config.side_overlap,
                end_overlap=config.end_overlap,
                tile_length=config.tile_length,
                tile_width=config.tile_width,
                tile_lap=config.tile_lap,
                wastage_percent=config.wastage_percent,
            )

        calculator = RoofCalculator(
            roof_type=config.roof_type,
            dimensions=dims,
            member_sizes=sizes,
            material=config.material,
            covering=covering,
            has_valley=config.has_valley,
            valley_length=config.valley_length,
            downpipe_length=config.downpipe_length,
        )

        # Calculate and generate takeoff
        quantities = calculator.calculate_all()
        takeoff = calculator.generate_takeoff_sheet(quantities)

        return {
            "success": True,
            "takeoff": takeoff,
            "project_info": {
                "roof_type": config.roof_type,
                "material": config.material,
                "building_dimensions": f"{config.building_length}m x {config.building_width}m",
                "pitch": f"{config.pitch_angle}°",
            },
        }

    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Takeoff generation error: {str(e)}"
        )


@router.post("/api/generate-boq")
async def generate_boq(config: RoofConfigRequest):
    """
    Generate Bill of Quantities with rates and amounts
    """
    try:
        # Create calculator (same as other endpoints)
        dims = RoofDimensions(
            building_length=config.building_length,
            building_width=config.building_width,
            wall_thickness=config.wall_thickness,
            overhang=config.overhang,
            pitch_angle=config.pitch_angle,
            truss_spacing=config.truss_spacing,
            rafter_spacing=config.rafter_spacing,
            bearer_spacing=config.bearer_spacing,
        )

        sizes = MemberSizes()

        covering = None
        if config.covering_type:
            covering = CoveringDetails(
                type=config.covering_type,
                sheet_length=config.sheet_length,
                sheet_width=config.sheet_width,
                side_overlap=config.side_overlap,
                end_overlap=config.end_overlap,
                tile_length=config.tile_length,
                tile_width=config.tile_width,
                tile_lap=config.tile_lap,
                wastage_percent=config.wastage_percent,
            )

        calculator = RoofCalculator(
            roof_type=config.roof_type,
            dimensions=dims,
            member_sizes=sizes,
            material=config.material,
            covering=covering,
            has_valley=config.has_valley,
            valley_length=config.valley_length,
            downpipe_length=config.downpipe_length,
        )

        # Calculate and generate BOQ
        quantities = calculator.calculate_all()
        boq = calculator.generate_boq(quantities)

        return {"success": True, "boq": boq}

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"BOQ generation error: {str(e)}")


@router.post("/api/extract-contours")
async def extract_contours(file: UploadFile = File(...)):
    """
    Extract building contours from uploaded plan image
    Returns image with contours drawn
    """
    try:
        # Read uploaded file
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
            raise HTTPException(status_code=400, detail="Failed to read image")

        h, w = img.shape[:2]

        # Create blank canvas
        blank = np.ones((h, w, 3), np.uint8) * 255

        # Convert to grayscale
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # Detect contours
        contours = detect_outer_contours(gray)

        if not contours:
            raise HTTPException(status_code=400, detail="No contours detected")

        # Draw contours on blank canvas
        mask = np.zeros((h, w), np.uint8)
        cv2.drawContours(mask, contours, -1, 255, thickness=-1)

        # Create outline
        stroke = 10
        kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (stroke, stroke))
        eroded = cv2.erode(mask, kernel)
        outline = cv2.subtract(mask, eroded)

        # Create result image
        result = np.ones((h, w, 3), np.uint8) * 255
        ys, xs = np.where(outline == 255)
        result[ys, xs] = (0, 0, 0)

        # Convert to PNG bytes
        png_bytes = npimg_to_png_bytes(result)

        return Response(content=png_bytes, media_type="image/png")

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Contour extraction error: {str(e)}"
        )


@router.post("/api/process-image")
async def process_image(request: ImageProcessRequest):
    """
    Process image for various operations: contours, dimensions, analysis
    """
    try:
        # Decode image
        img = decode_base64_image(request.image_base64)

        if img is None:
            raise HTTPException(status_code=400, detail="Failed to decode image")

        operation = request.operation.lower()

        if operation == "contours":
            # Extract and draw contours
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            contours = detect_outer_contours(gray)

            result_img = img.copy()
            cv2.drawContours(result_img, contours, -1, (0, 255, 0), 3)

            result_base64 = encode_image_to_base64(result_img)

            return {
                "success": True,
                "operation": "contours",
                "image": result_base64,
                "num_contours": len(contours),
            }

        elif operation == "dimensions":
            # Extract dimensions
            dimensions = extract_dimensions_from_plan(img, request.scale)

            # Draw bounding box
            result_img = img.copy()
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            contours = detect_outer_contours(gray)

            if contours:
                x, y, w, h = cv2.boundingRect(contours[0])
                cv2.rectangle(result_img, (x, y), (x + w, y + h), (0, 255, 0), 3)

                # Add dimension text
                cv2.putText(
                    result_img,
                    f"W: {w}px",
                    (x, y - 10),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2,
                )
                cv2.putText(
                    result_img,
                    f"H: {h}px",
                    (x + w + 10, y + h // 2),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2,
                )

            result_base64 = encode_image_to_base64(result_img)

            return {
                "success": True,
                "operation": "dimensions",
                "image": result_base64,
                "dimensions": dimensions,
            }

        elif operation == "plan_analysis":
            # Comprehensive plan analysis
            gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            contours = detect_outer_contours(gray)
            dimensions = extract_dimensions_from_plan(img, request.scale)

            # Detect lines (potential walls)
            edges = cv2.Canny(gray, 50, 150)
            lines = cv2.HoughLinesP(
                edges, 1, np.pi / 180, 100, minLineLength=50, maxLineGap=10
            )

            result_img = img.copy()
            if contours:
                cv2.drawContours(result_img, contours, -1, (0, 255, 0), 2)
            if lines is not None:
                for line in lines:
                    x1, y1, x2, y2 = line[0]
                    cv2.line(result_img, (x1, y1), (x2, y2), (255, 0, 0), 1)

            result_base64 = encode_image_to_base64(result_img)

            return {
                "success": True,
                "operation": "plan_analysis",
                "image": result_base64,
                "dimensions": dimensions,
                "num_lines_detected": len(lines) if lines is not None else 0,
                "analysis": {
                    "shape": (
                        "rectangular"
                        if dimensions.get("num_vertices", 0) == 4
                        else "complex"
                    ),
                    "recommended_roof": (
                        "gable" if dimensions.get("num_vertices", 0) == 4 else "hipped"
                    ),
                },
            }

        else:
            raise HTTPException(
                status_code=400, detail=f"Unknown operation: {operation}"
            )

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Image processing error: {str(e)}")


@router.get("/api/health")
async def health_check():
    """Health check endpoint"""
    return {"status": "healthy", "service": "Roof CAD Pro API", "version": "1.0.0"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
