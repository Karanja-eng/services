from transformers import AutoProcessor, AutoModelForCausalLM, AutoConfig
import torch

model_path = r"C:/Users/HP/Phi-3.5-vision-instruct"

# ✅ Load config first and override attention implementation
config = AutoConfig.from_pretrained(model_path, trust_remote_code=True)
config._attn_implementation = "eager"
config.attn_implementation = "eager"

# ✅ Load processor
processor = AutoProcessor.from_pretrained(model_path, trust_remote_code=True)

# ✅ CPU-safe model load
model = AutoModelForCausalLM.from_pretrained(
    model_path,
    config=config,
    trust_remote_code=True,
    device_map="cpu",  # Force CPU
    torch_dtype=torch.float32,  # Best stability for CPU
)

model.eval()

# ✅ Optional for small speed boost during inference
torch.set_num_threads(6)  # Adjust if needed based on CPU core count


def get_model():
    return model, processor
