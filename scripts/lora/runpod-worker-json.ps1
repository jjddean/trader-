param(
  [ValidateSet("Validate", "Prepare", "Launch")]
  [string]$Action = "Prepare",
  [string]$ConfirmSpend = "",
  [string]$BundlePath = "lora-runpod-worker-json-bundle",
  [string]$ZipPath = "lora-runpod-worker-json-bundle.zip"
)

$ErrorActionPreference = "Stop"

$RepoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$DataDir = Join-Path $RepoRoot "lora-dataset-worker-json-v2"
$BundleDir = Join-Path $RepoRoot $BundlePath
$BundleZip = Join-Path $RepoRoot $ZipPath

function Invoke-Checked {
  param([string[]]$Command)
  Write-Host "> $($Command -join ' ')"
  & $Command[0] $Command[1..($Command.Length - 1)]
  if ($LASTEXITCODE -ne 0) {
    throw "Command failed with exit code $LASTEXITCODE`: $($Command -join ' ')"
  }
}

function Test-WorkerJsonLocal {
  Invoke-Checked @("python", "scripts/lora/validate_worker_json_dataset.py", "lora-dataset-worker-json-v2")
  Invoke-Checked @("python", "scripts/lora/train_worker_json_unsloth.py")
}

function Write-WorkerJsonBootstrap {
  param([string]$Path)

  @(
    '#!/usr/bin/env bash',
    'set -euo pipefail',
    '',
    'cd /workspace',
    '',
    'export LORA_DATA_DIR="${LORA_DATA_DIR:-/workspace/lora-dataset-worker-json-v2}"',
    'export LORA_OUT_DIR="${LORA_OUT_DIR:-/workspace/lora-output-worker-json-v2}"',
    '',
    'python validate_worker_json_dataset.py "$LORA_DATA_DIR"',
    'python train_worker_json_unsloth.py --data-dir "$LORA_DATA_DIR" --out-dir "$LORA_OUT_DIR"',
    '',
    'if [[ "${LORA_ALLOW_WORKER_JSON_TRAIN:-}" != "1" ]]; then',
    '  echo "Worker-json RunPod bundle validated. Training is blocked until LORA_ALLOW_WORKER_JSON_TRAIN=1."',
    '  exit 0',
    'fi',
    '',
    'python -m pip install -q -r requirements-worker-json-runpod.txt',
    'python train_worker_json_unsloth.py --execute --data-dir "$LORA_DATA_DIR" --out-dir "$LORA_OUT_DIR" | tee /workspace/runpod-worker-json-train.log',
    '',
    'if [[ -n "${LORA_ADAPTER_PUT_URL:-}" ]]; then',
    '  curl -f -X PUT --upload-file "$LORA_OUT_DIR/adapter_model.safetensors" "$LORA_ADAPTER_PUT_URL"',
    'fi',
    '',
    'if [[ -n "${LORA_CONFIG_PUT_URL:-}" ]]; then',
    '  curl -f -X PUT --upload-file "$LORA_OUT_DIR/adapter_config.json" "$LORA_CONFIG_PUT_URL"',
    'fi',
    '',
    'if [[ -n "${LORA_COMPLETE_PUT_URL:-}" ]]; then',
    '  printf ''{"ok":true,"output":"%s"}\n'' "$LORA_OUT_DIR" > /workspace/lora-worker-json-complete.json',
    '  curl -f -X PUT --upload-file /workspace/lora-worker-json-complete.json "$LORA_COMPLETE_PUT_URL"',
    'fi'
  ) | Set-Content -Path $Path -Encoding ascii
}

function New-WorkerJsonBundle {
  Test-WorkerJsonLocal

  if (Test-Path $BundleDir) {
    Remove-Item -LiteralPath $BundleDir -Recurse -Force
  }
  if (Test-Path $BundleZip) {
    Remove-Item -LiteralPath $BundleZip -Force
  }

  New-Item -ItemType Directory -Path $BundleDir | Out-Null
  Copy-Item -Path $DataDir -Destination (Join-Path $BundleDir "lora-dataset-worker-json-v2") -Recurse
  Copy-Item -Path (Join-Path $RepoRoot "scripts/lora/train_worker_json_unsloth.py") -Destination (Join-Path $BundleDir "train_worker_json_unsloth.py")
  Copy-Item -Path (Join-Path $RepoRoot "scripts/lora/validate_worker_json_dataset.py") -Destination (Join-Path $BundleDir "validate_worker_json_dataset.py")

  @(
    "unsloth",
    "datasets",
    "trl"
  ) | Set-Content -Path (Join-Path $BundleDir "requirements-worker-json-runpod.txt") -Encoding ascii

  Write-WorkerJsonBootstrap -Path (Join-Path $BundleDir "pod_bootstrap_worker_json.sh")

  Compress-Archive -Path (Join-Path $BundleDir "*") -DestinationPath $BundleZip -Force

  Write-Host ""
  Write-Host "Prepared worker-json RunPod bundle:"
  Write-Host "  $BundleDir"
  Write-Host "  $BundleZip"
  Write-Host ""
  Write-Host "No pod was launched. No training was started."
}

function Start-WorkerJsonRunPodLaunch {
  if ($ConfirmSpend -ne "I_UNDERSTAND_THIS_SPENDS_MONEY") {
    throw "Refusing Launch: pass -ConfirmSpend I_UNDERSTAND_THIS_SPENDS_MONEY after local validation and cost review."
  }

  throw "Launch implementation is intentionally blocked until the local bundle is reviewed and RunPod API inputs are wired."
}

Set-Location $RepoRoot

switch ($Action) {
  "Validate" {
    Test-WorkerJsonLocal
    Write-Host "Worker-json RunPod launcher validation passed. No pod was launched. No training was started."
  }
  "Prepare" {
    New-WorkerJsonBundle
  }
  "Launch" {
    Start-WorkerJsonRunPodLaunch
  }
}

