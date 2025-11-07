from pathlib import Path
import os
from optimum.onnxruntime import ORTModelForCausalLM
from transformers import AutoConfig, AutoModelForCausalLM


MODEL_DIR = r"C:/Users/HP/Phi-3.5-vision-instruct"  # source HF repo
OUT_DIR = Path(r"C:/Users/HP/phi_onnx")
OUT_DIR.mkdir(parents=True, exist_ok=True)


# Load config override to avoid flash-attn
config = AutoConfig.from_pretrained(MODEL_DIR, trust_remote_code=True)
config._attn_implementation = "eager"
config.attn_implementation = "eager"


print("Loading PyTorch model (CPU)...")
pt_model = AutoModelForCausalLM.from_pretrained(
    MODEL_DIR, config=config, trust_remote_code=True, device_map="cpu", torch_dtype=None
)


print("Exporting to ONNX with Optimum (this can take a while)...")
# ORTModelForCausalLM.from_pretrained can accept a PyTorch model object OR a path in recent optimum versions.
# We try direct export using the model object and saving into OUT_DIR
ORTModelForCausalLM.from_pretrained(
    pt_model,
    save_dir=str(OUT_DIR),
    file_name="phi3_vision.onnx",
)


print("Export complete. ONNX saved to:", OUT_DIR)
