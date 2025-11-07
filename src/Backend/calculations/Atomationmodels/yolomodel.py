# backend/main.py
from fastapi import FastAPI, UploadFile, File, APIRouter
from ultralytics import YOLO
from PIL import Image
import io
import base64

router = APIRouter()
app = FastAPI()
# Load YOLO model once at startup
MODEL_PATH = r"src\Backend\calculations\Atomationmodels\best.pt"  # Fix full path

@app.on_event("startup")
def load_yolo():
    global model
    try:
        model = YOLO(MODEL_PATH)
        print(f"YOLO model loaded from {MODEL_PATH}")
    except Exception as e:
        print(f"Failed to load YOLO model: {e}")
        raise

@router.post("/detect")
async def detect_objects(
    file: UploadFile = File(...), 
    confidence: float = 0.5, 
    labels: list[str] = None
):
    img_bytes = await file.read()
    img = Image.open(io.BytesIO(img_bytes)).convert("RGB")

    results = model.predict(img, conf=confidence)
    detections = results[0]

    # Filter by labels
    filtered_boxes = detections.boxes
    if labels:
        filtered_boxes = [
            box for box in detections.boxes 
            if model.names[int(box.cls)] in labels
        ]

    # Count objects
    counts = {}
    for box in filtered_boxes:
        label = model.names[int(box.cls)]
        counts[label] = counts.get(label, 0) + 1

    # Plot + encode image
    img_plot = detections.plot()
    img_rgb = Image.fromarray(img_plot[..., ::-1])  # BGR → RGB
    buf = io.BytesIO()
    img_rgb.save(buf, format="PNG")
    img_b64 = base64.b64encode(buf.getvalue()).decode()

    return {"counts": counts, "image": img_b64}