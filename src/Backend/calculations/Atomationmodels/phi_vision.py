# main.py
import uvicorn
from fastapi import APIRouter, File, Form, UploadFile
from fastapi.responses import JSONResponse
from PIL import Image
import io
from transformers import AutoConfig, AutoModelForCausalLM, AutoProcessor
import torch

router = APIRouter()

# --- Load model once at startup ---
@router.on_event("startup")
def load_model():
    global model, processor
    print("Loading Phi-3.5-vision model...")
    model_path = r"C:\Users\HP\Phi-3.5-vision-instruct"
    
    config = AutoConfig.from_pretrained(model_path, trust_remote_code=True)
    config._attn_implementation = "eager"
    
    model = AutoModelForCausalLM.from_pretrained(
        model_path,
        config=config,
        torch_dtype=torch.float32,
        device_map="cpu",  # or "cuda"
        trust_remote_code=True
    )
    processor = AutoProcessor.from_pretrained(model_path, trust_remote_code=True)
    model.eval()
    print("Model loaded.")

# --- Inference endpoint ---
@router.post("/generate")
async def generate(prompt: str = Form(...), image: UploadFile = File(None)):
    try:
        images = None
        if image:
            img_bytes = await image.read()
            images = [Image.open(io.BytesIO(img_bytes)).convert("RGB")]

        inputs = processor(text=prompt, images=images, return_tensors="pt")
        inputs = {k: v.to(model.device) for k, v in inputs.items()}

        with torch.no_grad():
            output = model.generate(
                **inputs,
                max_new_tokens=256,
                do_sample=True,
                temperature=0.7,
                pad_token_id=processor.tokenizer.eos_token_id
            )

        response = processor.decode(output[0], skip_special_tokens=True)
        # Remove prompt echo
        response = response.split(prompt)[-1].strip()

        return JSONResponse({"response": response})
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# Run: uvicorn main:app --reload