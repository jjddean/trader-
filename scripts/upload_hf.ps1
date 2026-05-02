<#
PowerShell helper to upload LoRA adapter files to Hugging Face and then push to Cloudflare via Wrangler.

This script prompts for your HF token and repo id at runtime (no tokens are saved to disk).
Usage: run in the folder that contains `adapter_model.safetensors` and `adapter_config.json`.
#>

param(
    [string]$ModelFile = "adapter_model.safetensors",
    [string]$ConfigFile = "adapter_config.json"
)

Function Read-Secret([string]$prompt) {
    $secure = Read-Host -AsSecureString $prompt
    $ptr = [System.Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    try { [System.Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) } finally { [System.Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

Write-Host "This script will upload your adapter to Hugging Face and then call Wrangler to register the finetune."

$hfToken = Read-Secret "Enter Hugging Face write token (will not be stored):"
$repoId = Read-Host "Enter Hugging Face repo id (e.g. username/hs-classifier-v1):"

if (-not (Test-Path $ModelFile)) { Write-Error "$ModelFile not found in current directory"; exit 1 }
if (-not (Test-Path $ConfigFile)) { Write-Error "$ConfigFile not found in current directory"; exit 1 }

Write-Host "Installing required Python packages and Git LFS (if needed)..."
python -m pip install --upgrade pip
pip install huggingface-hub git-lfs
git lfs install

Write-Host "Exporting token for this session..."
$env:HF_TOKEN = $hfToken

Write-Host "Uploading to Hugging Face repository $repoId..."
python .\scripts\upload_hf.py $repoId $ModelFile $ConfigFile

if ($LASTEXITCODE -ne 0) { Write-Error "Upload to Hugging Face failed"; exit 2 }

Write-Host "Registering on Cloudflare (Wrangler). Ensure you have run 'npx wrangler login' beforehand."
npx wrangler ai finetune create hs-classifier-v1 || Write-Host "Create may have failed or already exists — continuing"
npx wrangler ai finetune upload hs-classifier-v1 .\$ModelFile
npx wrangler ai finetune upload hs-classifier-v1 .\$ConfigFile

Write-Host "Done. Verify the model in Hugging Face and Cloudflare dashboard."
