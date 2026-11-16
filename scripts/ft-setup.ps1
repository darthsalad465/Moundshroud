# One-time setup for real fine-tuning: a Python 3.11 virtual environment with a Blackwell-capable PyTorch (CUDA 12.8)
# and the training libraries, plus llama.cpp's GGUF converter. Writes runtime\ft-ready when it finishes. Safe to re-run.
$ErrorActionPreference = 'Continue'
$root = Split-Path $PSScriptRoot -Parent
$venv = Join-Path $root 'runtime\ftenv'
$py = Join-Path $venv 'Scripts\python.exe'
$ready = Join-Path $root 'runtime\ft-ready'
function Log($m) { Write-Output ("[{0}] {1}" -f (Get-Date -Format HH:mm:ss), $m) }

if (Test-Path $ready) { Remove-Item $ready -Force }
if (-not (Test-Path $py)) {
  Log "Creating the Python 3.11 environment..."
  & py -3.11 -m venv $venv
}
if (-not (Test-Path $py)) { Log "FAILED: could not create the environment (is Python 3.11 installed?)"; exit 1 }

Log "Upgrading pip..."
& $py -m pip install --upgrade pip wheel setuptools

Log "Installing PyTorch for CUDA 12.8 (Blackwell). This is the big download, a few GB..."
& $py -m pip install torch --index-url https://download.pytorch.org/whl/cu128
if ($LASTEXITCODE -ne 0) { Log "cu128 wheel failed; trying cu124..."; & $py -m pip install torch --index-url https://download.pytorch.org/whl/cu124 }

Log "Installing the training libraries..."
& $py -m pip install "transformers>=4.44" "peft>=0.13" "trl>=0.12" datasets accelerate sentencepiece protobuf gguf
Log "Installing bitsandbytes (4-bit loading)..."
& $py -m pip install "bitsandbytes>=0.45"

$conv = Join-Path $root 'scripts\convert_hf_to_gguf.py'
if (-not (Test-Path $conv)) {
  Log "Downloading the GGUF converter from llama.cpp..."
  try { Invoke-WebRequest -Uri 'https://raw.githubusercontent.com/ggml-org/llama.cpp/b4991/convert_hf_to_gguf.py' -OutFile $conv -UseBasicParsing } catch { Log ("converter download failed: " + $_.Exception.Message) }
}

Log "Checking the GPU is visible to PyTorch..."
$check = & $py -c "import torch;print('CUDA', torch.cuda.is_available(), torch.cuda.get_device_name(0) if torch.cuda.is_available() else '')" 2>&1
Log $check

if (($check -match 'CUDA True') -and (Test-Path $conv)) {
  Set-Content -Path $ready -Value (Get-Date -Format o) -Encoding ascii
  Log "DONE. Fine-tuning is ready."
} else {
  Log "SETUP INCOMPLETE: the GPU was not visible to PyTorch, or the converter is missing. See the lines above."
}
