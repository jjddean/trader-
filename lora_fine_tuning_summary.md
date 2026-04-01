# Research Summary: LLM Fine-Tuning with AutoTrain & Cloudflare Workers AI Inference

This document summarizes the process of fine-tuning Large Language Models (LLMs) using Hugging Face AutoTrain and deploying them for inference on Cloudflare Workers AI using LoRA (Low-Rank Adaptation) adapters.

---

## 1. Fine-Tuning with Hugging Face AutoTrain

AutoTrain Advanced provides a low-code way to fine-tune LLMs. The provided Colab notebook demonstrates a streamlined workflow:

### Key Requirements
- **Data**: A `train.csv` file containing a `text` column, placed in a `data/` folder.
- **Environment**: Requires `autotrain-advanced` package and a GPU (e.g., NVIDIA T4 in Colab).

### Configuration (`conf.yaml`)
The fine-tuning process is driven by a YAML configuration. For LoRA-based training, ensure:
- `task`: `llm-sft` (Supervised Fine-Tuning).
- `peft`: `True` (Enables Parameter-Efficient Fine-Tuning / LoRA).
- `lora_r`: Typically set to 16 or 32 (Note: Cloudflare supports up to 32).
- `lora_alpha`: Typically double the rank (e.g., 32 or 64).
- `mixed_precision`: `fp16` or `bf16`.

> [!WARNING]
> **Quantization Conflict**: While AutoTrain often uses `int4` or `int8` quantization to save VRAM during training, Cloudflare Workers AI currently requires **non-quantized** base models for LoRA adapter compatibility.

### Execution
```bash
autotrain --config conf.yaml
```

---

## 2. Deploying LoRAs to Cloudflare Workers AI

Cloudflare Workers AI allows you to "hot-swap" fine-tuned LoRA adapters onto base models at inference time.

### Compatibility & Limitations
- **Supported Models**: Mistral-7B, Gemma-7B, Llama-2-7B (Check the [Cloudflare Models catalog](https://developers.cloudflare.com/workers-ai/models/?capabilities=LoRA) for the latest list).
- **Rank Limit**: Rank `r` must be $\le 32$.
- **File Size**: Adapter files must be $< 300\text{MB}$.
- **Naming Convention**: Files must be named exactly:
  - `adapter_config.json`
  - `adapter_model.safetensors`

### 🛠️ Step-by-Step Deployment

#### 1. Prepare `adapter_config.json`
You **must** manually add a `model_type` field to your `adapter_config.json` before uploading. Supported types: `mistral`, `gemma`, `llama`.

```json
{
  "model_type": "mistral",
  "base_model_name_or_path": "...",
  "r": 16,
  "target_modules": ["q_proj", "v_proj"],
  ...
}
```

#### 2. Upload via Wrangler
Use the Wrangler CLI to create the fine-tune entry and upload your adapter files:
```bash
npx wrangler ai finetune create <base_model_name> <your_finetune_name> <folder_containing_files>
```
*Example:*
```bash
npx wrangler ai finetune create @cf/mistral/mistral-7b-instruct-v0.2-lora my-loratune ./my-adapter-folder
```

#### 3. Run Inference
In your Worker code, reference the fine-tune ID or name in the `lora` property:

```javascript
const response = await env.AI.run("@cf/mistral/mistral-7b-instruct-v0.2-lora", {
  messages: [{ role: "user", content: "Tell me a story." }],
  lora: "my-loratune", // Finetune name or ID
  raw: true           // Optional: Skip default chat template
});
```

---

## 🏗️ Integration Workflow (AutoTrain -> Cloudflare)

1.  **Train**: Use AutoTrain Advanced to train a LoRA adapter on a compatible base model (ensure no quantization if possible, or verify compatibility).
2.  **Export**: Download the `adapter_model.safetensors` and `adapter_config.json`.
3.  **Patch**: Add `"model_type": "..."` to `adapter_config.json`.
4.  **Upload**: Use `wrangler ai finetune create` to push to Cloudflare.
5.  **Serve**: Call `env.AI.run` with the `lora` parameter in your Cloudflare Worker.

> [!TIP]
> For testing, Cloudflare maintains a [Hugging Face Collection](https://huggingface.co/collections/Cloudflare/workers-ai-compatible-loras-6608dd9f8d305a46e355746e) of pre-validated compatible LoRA adapters.
