# backend/main.py
import io
import traceback
from typing import Tuple
from fastapi import FastAPI, UploadFile, File, Query, APIRouter, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageDraw, ImageFont
import numpy as np
import cv2
import os
import concurrent.futures
import asyncio
from skimage.morphology import skeletonize

from pathlib import Path

MAX_UPLOAD_BYTES = 8 * 1024 * 1024  # 8 MB - adjust to your server capacity
BASE_DIR = Path(__file__).parent
UPLOADS = BASE_DIR / "uploads"
UPLOADS.mkdir(exist_ok=True)

# ThreadPool for CPU-bound heavy work
EXEC = concurrent.futures.ThreadPoolExecutor(max_workers=2)


def ensure_size_ok(data: bytes):
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail=f"Uploaded file too large (> {MAX_UPLOAD_BYTES} bytes)",
        )


def run_blocking(fn, *args, **kwargs):
    """Run CPU-bound function in threadpool to avoid blocking loop."""
    return asyncio.get_event_loop().run_in_executor(EXEC, lambda: fn(*args, **kwargs))


# JSON helper (in addition to image responses)
def json_response(payload, status_code=200):
    from fastapi.responses import JSONResponse

    return JSONResponse(content=payload, status_code=status_code)


# try to import your utilities (these must be on PYTHONPATH)
try:
    from .utils.FloorplanToBlenderLib import detect, transform
    from .utils.post_prosessing import split_prediction, get_polygons

    # from utils.FloorplanToBlenderLib import polygons_to_image

    UTIL_OK = True
except Exception as e:
    UTIL_OK = False
    UTIL_IMPORT_ERR = str(e)

# pytesseract optional (OCR)
try:
    import pytesseract

    TESSERACT_OK = True
except Exception:
    TESSERACT_OK = False

# YOLO optional
try:
    from ultralytics import YOLO

    YOLO_OK = True
except Exception:
    YOLO_OK = False

YOLO_MODEL = None
if YOLO_OK and os.path.exists("best.pt"):
    try:
        YOLO_MODEL = YOLO("best.pt")
    except Exception:
        YOLO_MODEL = None

router = APIRouter()


# ---------- Helpers ----------
def pil_image_to_png_bytes(pil_img: Image.Image) -> bytes:
    buf = io.BytesIO()
    pil_img.save(buf, format="PNG")
    return buf.getvalue()


def npimg_to_png_bytes(npimg: np.ndarray) -> bytes:
    # convert BGR -> RGB for Pillow
    if npimg.ndim == 3 and npimg.shape[2] == 3:
        npimg_rgb = cv2.cvtColor(npimg, cv2.COLOR_BGR2RGB)
    else:
        npimg_rgb = npimg
    pil = Image.fromarray(npimg_rgb)
    return pil_image_to_png_bytes(pil)


def error_image_bytes(msg: str, w: int = 1200, h: int = 600) -> bytes:
    pil = Image.new("RGB", (w, h), (255, 255, 255))
    draw = ImageDraw.Draw(pil)
    try:
        font = ImageFont.truetype("arial.ttf", 14)
    except Exception:
        font = ImageFont.load_default()
    lines = str(msg).splitlines()
    y = 10
    for line in lines:
        draw.text((10, y), line, fill=(180, 0, 0), font=font)
        y += 18
    return pil_image_to_png_bytes(pil)


def safe_run(fn):
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except Exception as e:
            tb = traceback.format_exc()
            print(tb)
            return error_image_bytes(f"{str(e)}\n\n{tb.splitlines()[-1] if tb else ''}")

    return wrapper


async def load_image(file: UploadFile = None, file_id: str = None) -> np.ndarray:
    if file:
        data = await file.read()
        arr = np.frombuffer(data, dtype=np.uint8)
        img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
        return img
    elif file_id:
        # Search for any file starting with file_id
        # main2.py saves as f"{file_id}_{filename}"
        if UPLOADS.exists():
            for path in UPLOADS.iterdir():
                if path.name.startswith(file_id) and path.suffix.lower() in ['.png', '.jpg', '.jpeg', '.bmp']:
                    img = cv2.imread(str(path))
                    if img is not None:
                        return img
                    
        # Fallback legacy check
        for ext in ['.png', '.jpg', '.jpeg', '.pdf.png']:
            path = UPLOADS / f"{file_id}{ext}"
            if path.exists():
                img = cv2.imread(str(path))
                return img
    raise HTTPException(status_code=400, detail=f"Missing file or valid file_id: {file_id}")


# ---------- Endpoints ----------
@router.post("/contours")
@router.get("/contours")
async def contours_endpoint(file: UploadFile = File(None), file_id: str = Query(None)):
    if not UTIL_OK:
        return Response(
            content=error_image_bytes("utils import failed: " + UTIL_IMPORT_ERR),
            media_type="image/png",
        )

    img = await load_image(file, file_id)
    if img is None:
        return Response(
            content=error_image_bytes("Failed to read image"), media_type="image/png"
        )

    @safe_run
    def process(img):
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        contours, _ = detect.detectOuterContours(gray, np.zeros((h, w, 3), np.uint8), color=(255, 255, 255))
        if not isinstance(contours, list):
            contours = [contours]

        mask = np.zeros((h, w), np.uint8)
        cv2.drawContours(mask, contours, -1, 255, thickness=-1)

        result = np.ones((h, w, 3), np.uint8) * 255
        # AutoCAD Black for contours
        result[mask == 255] = (0, 0, 0) 
        return npimg_to_png_bytes(result)

    png = process(img)
    return Response(content=png, media_type="image/png")


@router.post("/rooms")
@router.get("/rooms")
async def rooms_endpoint(file: UploadFile = File(None), file_id: str = Query(None)):
    if not UTIL_OK:
        return Response(
            content=error_image_bytes("utils import failed: " + UTIL_IMPORT_ERR),
            media_type="image/png",
        )

    img = await load_image(file, file_id)
    if img is None:
        return Response(
            content=error_image_bytes("Failed to read image"), media_type="image/png"
        )

    @safe_run
    def process(img):
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # filter for walls and invert
        wall_filtered = detect.wall_filter(gray)
        inv = ~wall_filtered

        # find rooms
        rooms, colored_rooms = detect.find_rooms(inv.copy())

        # detect precise boxes
        gray_rooms = cv2.cvtColor(colored_rooms, cv2.COLOR_BGR2GRAY)
        boxes, _ = detect.detectPreciseBoxes(gray_rooms, gray_rooms)

        # draw all room boxes (multi-colored for differentiation)
        canvas = np.ones((h, w, 3), np.uint8) * 255
        import random
        for box in boxes:
            pts = np.array(box, dtype=np.int32).reshape(-1, 1, 2)
            # Generate a distinct random color
            color = (random.randint(50, 200), random.randint(50, 200), random.randint(50, 200))
            cv2.fillPoly(canvas, [pts], color) 

        return npimg_to_png_bytes(canvas)

    png = process(img)
    return Response(content=png, media_type="image/png")


@router.post("/walls")
@router.get("/walls")
async def walls_endpoint(file: UploadFile = File(None), file_id: str = Query(None)):
    if not UTIL_OK:
        return Response(
            content=error_image_bytes("utils import failed: " + UTIL_IMPORT_ERR),
            media_type="image/png",
        )

    img = await load_image(file, file_id)
    if img is None:
        return Response(
            content=error_image_bytes("Failed to read image"), media_type="image/png"
        )

    @safe_run
    def process(img):
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        wall_img = detect.wall_filter(gray)
        
        # AutoCAD Black for walls (Neat lines)
        canvas = np.ones((h, w, 3), np.uint8) * 255
        if wall_img is not None:
            # Dilate slightly for better visibility if it's too thin
            kernel = np.ones((2,2), np.uint8)
            wall_neat = cv2.dilate(wall_img, kernel, iterations=1)
            canvas[wall_neat > 0] = (0, 0, 0) # Black

        return npimg_to_png_bytes(canvas)

    png = process(img)
    return Response(content=png, media_type="image/png")


@router.post("/slabs")
@router.get("/slabs")
async def slabs_endpoint(file: UploadFile = File(None), file_id: str = Query(None), scale: float = Query(0.01)):
    if not UTIL_OK:
        return Response(
            content=error_image_bytes("utils import failed: " + UTIL_IMPORT_ERR),
            media_type="image/png",
        )

    img = await load_image(file, file_id)
    if img is None:
        return Response(
            content=error_image_bytes("Failed to read image"), media_type="image/png"
        )

    @safe_run
    def process(img):
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        wall_filtered = detect.wall_filter(gray)
        inv = ~wall_filtered
        rooms, colored_rooms = detect.find_rooms(inv.copy())

        gray_rooms = cv2.cvtColor(colored_rooms, cv2.COLOR_BGR2GRAY)
        boxes, _ = detect.detectPreciseBoxes(gray_rooms, gray_rooms)

        # AutoCAD Black for slab contours (Room boundaries)
        canvas = np.ones((h, w, 3), np.uint8) * 255
        for box in boxes:
            pts = np.array(box, dtype=np.int32).reshape((-1, 1, 2))
            cv2.polylines(canvas, [pts], isClosed=True, color=(0, 0, 0), thickness=3) 
            
        return npimg_to_png_bytes(canvas)

    png = process(img)
    return Response(content=png, media_type="image/png")


# -------------------------------
# Beams Endpoint (corrected)
# -------------------------------
def extract_beam_lines_from_wall_mask(wall_mask):
    """
    Input: wall_mask (binary np.uint8) walls==255
    Returns: list of (x1,y1,x2,y2) approximate beam center lines
    """
    # Convert to boolean for skeletonize
    bin_mask = (wall_mask > 0).astype(np.uint8)
    # thin -> skeletonize expects boolean
    sk = skeletonize(bin_mask > 0)
    sk_uint8 = (sk.astype(np.uint8) * 255).astype(np.uint8)
    # Use probabilistic Hough or HoughLinesP to extract lines
    lines = cv2.HoughLinesP(
        sk_uint8,
        rho=1,
        theta=np.pi / 180,
        threshold=20,
        minLineLength=20,
        maxLineGap=10,
    )
    result = []
    if lines is not None:
        for l in lines:
            x1, y1, x2, y2 = l[0]
            result.append((int(x1), int(y1), int(x2), int(y2)))
    return result


@router.post("/beams")
@router.get("/beams")
async def beams_endpoint(
    file: UploadFile = File(None),
    file_id: str = Query(None),
    scale: float = Query(0.01),
    json_out: bool = Query(False),
):
    if not UTIL_OK:
        return Response(
            content=error_image_bytes("utils import failed: " + UTIL_IMPORT_ERR),
            media_type="image/png",
        )
    img = await load_image(file, file_id)
    if img is None:
        return Response(
            content=error_image_bytes("Failed to read image"), media_type="image/png"
        )

    def _process(img):
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

        # 1) wall mask (white walls on black background) - keep original behavior
        wall_mask = detect.wall_filter(gray)
        if wall_mask is None:
            raise RuntimeError("wall_filter returned None")

        # 2) close small gaps (windows/doors) - tune kernel depending on dpi
        kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (7, 7))
        wall_closed = cv2.morphologyEx(wall_mask, cv2.MORPH_CLOSE, kernel, iterations=2)

        # 3) detect room boxes on inverted mask (same as before)
        wall_closed_inv = cv2.bitwise_not(wall_closed)
        boxes, _ = detect.detectPreciseBoxes(wall_closed_inv)

        # draw canvas (AutoCAD Black for Beams)
        canvas = np.ones((h, w, 3), np.uint8) * 255
        
        # 5) extract beam center lines from the cleaned wall mask
        midlines = extract_beam_lines_from_wall_mask(wall_closed)

        # draw midlines over canvas
        for x1, y1, x2, y2 in midlines:
            cv2.line(canvas, (x1, y1), (x2, y2), (0, 0, 0), thickness=max(3, int(0.15 * 100))) 

        if json_out:
            # prepare JSON output with scaled coordinates (optional)
            beams_json = [
                {
                    "x1": int(x1 * scale),
                    "y1": int(y1 * scale),
                    "x2": int(x2 * scale),
                    "y2": int(y2 * scale),
                }
                for (x1, y1, x2, y2) in midlines
            ]
            return {"png": npimg_to_png_bytes(canvas), "json": beams_json}
        return npimg_to_png_bytes(canvas)

    # run in threadpool to avoid blocking event loop
    result = await run_blocking(_process, img)

    if isinstance(result, dict):
        # return multipart? simpler: return json payload with base64 PNG
        import base64

        png_b64 = base64.b64encode(result["png"]).decode("ascii")
        return json_response({"png_base64": png_b64, "beams": result["json"]})
    else:
        return Response(content=result, media_type="image/png")


@router.post("/ocr")
async def ocr_endpoint(file: UploadFile = File(...)):
    if not TESSERACT_OK:
        return Response(
            content=error_image_bytes("pytesseract not installed on server"),
            media_type="image/png",
        )

    # set provided tesseract path
    pytesseract.pytesseract.tesseract_cmd = (
        r"C:\Program Files\Tesseract-OCR\tesseract.exe"
    )

    data = await file.read()
    arr = np.frombuffer(data, dtype=np.uint8)
    img = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if img is None:
        return Response(
            content=error_image_bytes("Failed to read image"), media_type="image/png"
        )

    @safe_run
    def process(img):
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        text = pytesseract.image_to_string(gray)

        h, w = gray.shape[:2]
        pil = Image.new("RGB", (w, h), (255, 255, 255))
        draw = ImageDraw.Draw(pil)
        try:
            font = ImageFont.truetype("arial.ttf", 14)
        except Exception:
            font = ImageFont.load_default()
        y = 8
        for line in text.splitlines():
            draw.text((8, y), line, fill=(0, 0, 0), font=font)
            y += 18
        return pil_image_to_png_bytes(pil)

    png = process(img)
    return Response(content=png, media_type="image/png")


@router.post("/columns")
@router.get("/columns")
async def columns_endpoint(
    file: UploadFile = File(None),
    file_id: str = Query(None),
    confidence: float = Query(0.5),
    json_out: bool = Query(False),
):
    if YOLO_MODEL is None:
        if not YOLO_OK:
            return Response(
                content=error_image_bytes("ultralytics YOLO not installed"),
                media_type="image/png",
            )
        return Response(
            content=error_image_bytes(
                "YOLO model file (best.pt) not found or failed to load"
            ),
            media_type="image/png",
        )

    img = await load_image(file, file_id)
    if img is None:
        return Response(
            content=error_image_bytes("Failed to read image"), media_type="image/png"
        )

    def _process(img):
        pil = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))
        results = YOLO_MODEL.predict(pil, conf=confidence, verbose=False)
        if not results:
            return (
                npimg_to_png_bytes(np.ones_like(img) * 255)
                if not json_out
                else {
                    "png": npimg_to_png_bytes(np.ones_like(img) * 255),
                    "detections": [],
                }
            )

        det = results[0]
        h, w = img.shape[:2]
        canvas = np.ones((h, w, 3), np.uint8) * 255
        detections = []
        # ultralytics Results.boxes is iterable and each box has xyxy, conf, cls
        for box in getattr(det, "boxes", []):
            try:
                xyxy = (
                    box.xyxy.cpu().numpy().astype(int)[0]
                    if hasattr(box.xyxy, "cpu")
                    else np.array(box.xyxy).astype(int).flatten()
                )
            except Exception:
                # older API yields .xyxy[0] as Tensor, new API may be different
                xyxy = np.array(box.xyxy).astype(int).flatten()
            x1, y1, x2, y2 = int(xyxy[0]), int(xyxy[1]), int(xyxy[2]), int(xyxy[3])
            cls_idx = int(box.cls if hasattr(box, "cls") else box.cls.cpu().numpy()[0])
            cls_name = (
                YOLO_MODEL.names.get(cls_idx, str(cls_idx))
                if isinstance(YOLO_MODEL.names, dict)
                else YOLO_MODEL.names[cls_idx]
            )
            conf_val = float(
                box.conf
                if hasattr(box, "conf")
                else (box.conf.cpu().numpy()[0] if hasattr(box.conf, "cpu") else 0.0)
            )
            if cls_name.lower() == "column":
                # AutoCAD Black for Columns
                cv2.rectangle(canvas, (x1, y1), (x2, y2), (0, 0, 0), thickness=-1)
            detections.append(
                {"class": cls_name, "conf": conf_val, "bbox": [x1, y1, x2, y2]}
            )

        if json_out:
            import base64

            return {"png": npimg_to_png_bytes(canvas), "detections": detections}
        return npimg_to_png_bytes(canvas)

    result = await run_blocking(_process, img)

    if isinstance(result, dict):
        import base64

        return json_response(
            {
                "png_base64": base64.b64encode(result["png"]).decode("ascii"),
                "detections": result["detections"],
            }
        )
    return Response(content=result, media_type="image/png")
