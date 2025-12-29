from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import subprocess
import requests
import json
from typing import Optional, List

router = APIRouter()

class Prompt(BaseModel):
    text: str
    images: Optional[List[str]] = None  # Base64 encoded images
    mode: Optional[str] = "fast"       # "fast" or "thinking"

def preload_model():
    """
    Preloads the Qwen-3-4B model via Ollama HTTP API.
    """
    print("🧠 Preloading Qwen-3-4B model via HTTP API...")
    try:
        url = "http://localhost:11434/api/generate"
        payload = {
            "model": "qwen-3-4b-unsloth",
            "prompt": "hi",
            "stream": False,
            "keep_alive": 0 # Release RAM immediately after preloading
        }
        # Short timeout as we just want to trigger loading
        requests.post(url, json=payload, timeout=600)
        print("✅ Qwen-3-4B model preloaded successfully")
    except Exception as e:
        # We don't want to crash the app if Ollama isn't running yet
        print(f"⚠️  Preload notification: Ollama API might be initializing... ({str(e)})")

@router.post("/generate_stream")
def generate_stream(prompt: Prompt):
    try:
        url = "http://localhost:11434/api/generate"
        
        # Unsloth & CPU Optimized Parameters
        if prompt.mode == "thinking":
            options = {
                "temperature": 1.0,
                "top_p": 0.95,
                "top_k": 20,
                "min_p": 0.0,
                "num_thread": 6, # Optimized for Core i7
                "num_ctx": 4096  # Cap context to save RAM
            }
        else: # Default "fast" mode
            options = {
                "temperature": 0.7,
                "top_p": 0.8,
                "top_k": 20,
                "presence_penalty": 1.5,
                "num_thread": 6,
                "num_ctx": 2048
            }

        payload = {
            "model": "qwen-3-4b-unsloth",
            "prompt": prompt.text,
            "images": prompt.images,
            "stream": True,
            "options": options,
            "keep_alive": 0 # Release RAM immediately after request
        }

        def stream():
            with requests.post(url, json=payload, stream=True) as response:
                if response.status_code != 200:
                    yield f"Error: Ollama returned {response.status_code}\n"
                    return

                for line in response.iter_lines():
                    if line:
                        chunk = json.loads(line)
                        if "response" in chunk:
                            yield chunk["response"]
                        if chunk.get("done"):
                            break

        return StreamingResponse(stream(), media_type="text/plain")

    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))