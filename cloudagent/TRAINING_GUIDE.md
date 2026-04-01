# HS Code LoRA Training & Deployment Guide

Follow these steps to train and deploy your specialized HS Code classification model for the `cloudagent` Worker.

## Step 1: Prepare Your Training Data (CSV)
Create a file named `train.csv` with one column named `text`.

**Format for HS code classification (Using Mistral's [INST] format):**
```csv
text
"[INST] Classify this product using GIRs 1-6: Men's leather work boots, steel toe cap, rubber sole [/INST] 6403400000"
"[INST] Classify this product using GIRs 1-6: Cotton t-shirt, short sleeve, white, 100% cotton [/INST] 6109100000"
```
> [!TIP]
> Use the provided `scripts/generate-training-data.ts` to automatically generate this from your historical declarations.

---

## Step 2: Open the AutoTrain Notebook
1.  Go to: [HuggingFace AutoTrain Advanced Notebook](https://colab.research.google.com/github/huggingface/autotrain-advanced/blob/main/colab/AutoTrain_LLM.ipynb)
2.  **Change Runtime**: Runtime → Change runtime type → Select **A100 GPU** (Recommended).
3.  **Configure**:
    *   `project_name`: `hs-classifier-v1`
    *   `model_name`: `mistralai/Mistral-7B-Instruct-v0.2`
    *   `quantization`: `"none"` (Must be string with quotes for Cloudflare compatibility).
    *   `lora_r`: `8`

---

## Step 3: Run Training & Export
1.  Upload `train.csv` to the `/data` folder in Colab.
2.  **Runtime → Run All**.
3.  After 1-2 hours, download:
    *   `adapter_model.safetensors`
    *   `adapter_config.json`

---

## Step 4: Patch for Cloudflare (CRITICAL)
Open `adapter_config.json` and add the `model_type` field:
```json
{
  "model_type": "mistral",
  "base_model_name_or_path": "...",
  ...
}
```

---

## Step 5: Upload to Cloudflare via Wrangler
```bash
# Register the fine-tune entry
npx wrangler ai finetune create hs-classifier-v1

# Upload your files
npx wrangler ai finetune upload hs-classifier-v1 ./adapter_model.safetensors
npx wrangler ai finetune upload hs-classifier-v1 ./adapter_config.json
```

---

## Step 6: Verify Inference
Once uploaded, the `cloudagent` will automatically use this LoRA when calling the `/classify-gir` endpoint or when the `LORA_ID` environment variable matches `hs-classifier-v1`.
