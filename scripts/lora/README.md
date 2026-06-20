# Freightcode LoRA Pipeline

This pipeline trains the cloudagent advisory classifier used by `/classify-gir`.

It does not replace HMRC/CDS declaration validation, XML mapping, submission,
tariff duty, VAT, or any deterministic compliance calculation. Model output is
advisory text for human review only.

## Dataset

Generate and validate:

```bash
npm run lora:prepare
```

The prepare step:

- builds `lora-dataset/train.csv` and `lora-dataset/eval.csv`
- uses UK Trade Tariff-backed commodity codes from the local mirror
- optionally ingests `goods_items/documents.jsonl` when present
- keeps eval canonical records held out from train
- rejects duplicate prompts in strict validation
- verifies every `HS_CODE` against the tariff-code cache
- converts both splits for HF AutoTrain

Quality gates:

- `HS_CODE` is exactly 10 digits
- `CONFIDENCE` is two-decimal `0.00` to `1.00`
- representation aligns with indirect representation
- reason origin matches the Product block
- train unique prompts are at least 90% of row count
- train unique HS codes are at least 200
- eval prompt overlap with train is zero

The tariff cache is written to `lora-dataset/.tariff-codes.json` and is ignored
by git.

## RunPod

Required environment variables are read from `.env.local` by
`scripts/lora/env.py`; do not commit secrets.

```bash
RUNPOD_API_KEY=...
RUNPOD_GPU_TYPE=NVIDIA GeForce RTX 4090
RUNPOD_IMAGE=runpod/pytorch:2.4.0-py3.11-cuda12.4.1-devel-ubuntu22.04
RUNPOD_VOLUME_GB=20
RUNPOD_MAX_WAIT_MINUTES=180
HF_TOKEN=... # optional, speeds model download
```

Commands:

```bash
python scripts/lora/runpod/runpod_train.py prepare
python scripts/lora/runpod/runpod_train.py launch
python scripts/lora/runpod/runpod_train.py status
python scripts/lora/runpod/runpod_train.py download
python scripts/lora/runpod/runpod_train.py teardown
python scripts/lora/runpod/runpod_train.py all
```

NPM shortcuts:

```bash
npm run lora:runpod:prepare
npm run lora:runpod:launch
npm run lora:runpod:download
npm run lora:runpod
```

`all` runs prepare, launch, wait, download, and teardown. Teardown runs in a
`finally` block after a successful launch to reduce runaway billing risk.

Default launch mode is on-demand, not spot. RTX 4090 on-demand pods are commonly
around $0.50-$0.80/hr; verify current RunPod pricing before starting training.

Adapters download to `lora-output/`:

- `adapter_model.safetensors`
- `adapter_config.json`

If SSH/SCP is unavailable, use the RunPod web file browser to download
`/workspace/lora-output/` manually.

## Combined V2 Classification + Reasoning Pass

The first dataset proves broad classification coverage. The combined v2 set
trains the live `/classify-gir` JSON shape while tying product classification
and explanation together. It includes hard positives and wrong-code negatives,
for example laptop `8471300000` rejecting poultry code `0105110000`.

```bash
npm run lora:prepare:v2
```

This creates `lora-dataset-v2/` with exact `/classify-gir` JSON outputs,
classification hard cases, cross-category wrong-code negatives, ambiguous
contradiction cases, short product-specific rationale, and v2 metadata checked
by `HMRC-AI-TRAINING-STANDARD.md`.

Train one short pass with the same RunPod path by pointing the bundle at the v2
data and setting one epoch:

```bash
$env:LORA_DATA_DIR="C:\Users\jason\trader-app\lora-dataset-v2"
$env:LORA_EPOCHS="1"
python scripts/lora/runpod/runpod_train.py prepare
python scripts/lora/runpod/runpod_train.py launch
```

## Deploy

After adapters are present locally:

```bash
npm run lora:deploy
```

This uploads `hs-classifier-v1` for the existing Cloudflare Workers AI
cloudagent integration.
