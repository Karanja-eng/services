from fastapi import HTTPException, APIRouter
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import subprocess
import sys
import os

router = APIRouter()


class Prompt(BaseModel):
    text: str


@router.post("/generate")
def generate(prompt: Prompt):
    try:
        result = subprocess.run(
            ["ollama", "run", "phi:latest", prompt.text],
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            timeout=300,
        )
        if result.returncode != 0:
            raise HTTPException(status_code=500, detail=result.stderr.strip())

        return {"response": result.stdout.strip()}

    except subprocess.TimeoutExpired:
        raise HTTPException(status_code=504, detail="Model timed out")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
