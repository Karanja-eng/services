from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import subprocess
import requests
import json
from typing import Optional, List
import urllib3

# Disable SSL warnings for ngrok/development tunnels
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# Use a session for more robust streaming connections
session = requests.Session()
session.verify = False
# session.headers.update({"ngrok-skip-browser-warning": "true"})

router = APIRouter()

class Prompt(BaseModel):
    text: str
    images: Optional[List[str]] = None  # Base64 encoded images
    mode: Optional[str] = "fast"       # "fast" or "thinking"

def preload_model():
    """
    Preloads the Gemma3 model via local Ollama HTTP API.
    """
    print("🧠 Preloading Gemma3-1B model via Local HTTP API...")
    try:
        url = "http://localhost:11434/api/generate"
        # url = "https://lorrie-hideless-niko.ngrok-free.dev/generate" # COLAB_FALLBACK
        payload = {
            "model": "gemma3:1b-it-qat",
            "prompt": "hi",
            "stream": False,
            "keep_alive": -1 # Keep model loaded in RAM
        }
        # Short timeout as we just want to trigger loading
        requests.post(url, json=payload, timeout=6)
        print("✅ Gemma3-1B model preloaded and ready")
    except Exception as e:
        print(f"⚠️  Preload notification: Ollama API might be initializing... ({str(e)})")

@router.get("/status")
def get_status():
    """
    Checks if the local AI model endpoint is reachable.
    """
    url = "http://localhost:11434/api/generate"
    try:
        # Increased timeout to 15s to allow for model loading/wake-up
        response = requests.post(url, json={"model": "gemma3:1b-it-qat", "prompt": "hi", "stream": False}, timeout=15)
        if response.status_code == 200:
            print(f"✅ AI Live at {url}")
            return {"status": "live", "message": "Local Gemma3 model found"}
    except Exception as e:
        print(f"⚠️ Local AI Status Check Failed: {str(e)}")
            
    return {"status": "offline", "message": "Local AI model not found"}

@router.post("/generate_stream")
def generate_stream(prompt: Prompt):
    try:
        url = "http://localhost:11434/api/generate"
        # url = "https://lorrie-hideless-niko.ngrok-free.dev/generate" # COLAB_FALLBACK
        
        # Build payload for local Ollama
        payload = {
            "model": "gemma3:1b-it-qat",
            "prompt": prompt.text,
            "stream": True,
            "options": {
                "temperature": 0.7,
                "top_p": 0.9,
                "num_thread": 6,
                "num_ctx": 4096
            }
        }

        def stream():
            try:
                # with session.post(url, json=payload, stream=True, timeout=600, verify=False) as response: # COLAB_STYLE
                with requests.post(url, json=payload, stream=True, timeout=600) as response:
                    if response.status_code != 200:
                        error_detail = response.text
                        print(f"❌ Ollama error {response.status_code}: {error_detail}")
                        yield f"Error: Ollama returned {response.status_code}. Details: {error_detail}\n"
                        return

                    # Handling local Ollama stream chunks
                    for line in response.iter_lines():
                        if line:
                            try:
                                chunk = json.loads(line)
                                if "response" in chunk:
                                    yield chunk["response"]
                                if chunk.get("done"):
                                    break
                            except:
                                yield line.decode('utf-8')

            except Exception as stream_error:
                print(f"❌ Streaming error: {str(stream_error)}")
                yield f"Error: {str(stream_error)}\n"

        return StreamingResponse(stream(), media_type="text/plain")

    except Exception as e:
        print(f"❌ Generate stream error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))