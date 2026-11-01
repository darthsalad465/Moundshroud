# Installs the offline AI music maker for Moundshroud (Studio > Music studio > "Compose from words").
# Downloads about 4 GB once: PyTorch + transformers (installed into the private folder musicgen\venv, nothing system-wide)
# and Meta's MusicGen-small model (300M parameters, CC-BY-NC 4.0 licence: free for personal, non-commercial use).
# After this, music is made on your own PC with no internet. If it is not installed, Qwen writes the song into the studio instead.
#   powershell -ExecutionPolicy Bypass -File install-music-model.ps1
$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path; $d = Join-Path $root 'musicgen'; New-Item -ItemType Directory -Force $d | Out-Null
$venv = Join-Path $d 'venv'; $py = Join-Path $venv 'Scripts\python.exe'; $model = Join-Path $d 'models\musicgen-small'
if (-not (Test-Path $py)) {
  $sys = (Get-Command python -ErrorAction SilentlyContinue); if (-not $sys) { throw 'Python 3.10 or newer is needed. Install it from python.org and run this again.' }
  Write-Host 'Creating a private Python environment...'; & $sys.Source -m venv $venv; if ($LASTEXITCODE) { throw 'Could not create the Python environment.' }
}
$haveTorch = $false; try { & $py -c 'import torch, transformers, scipy, accelerate' 2>$null; $haveTorch = ($LASTEXITCODE -eq 0) } catch { }
if (-not $haveTorch) {
  Write-Host 'Installing PyTorch (about 2.5 GB, several minutes)...'
  & $py -m pip install --disable-pip-version-check --quiet torch --index-url https://download.pytorch.org/whl/cu128; if ($LASTEXITCODE) { throw 'PyTorch did not install.' }
  Write-Host 'Installing transformers...'
  & $py -m pip install --disable-pip-version-check --quiet transformers scipy huggingface_hub accelerate; if ($LASTEXITCODE) { throw 'transformers did not install.' }
}
if (-not (Test-Path (Join-Path $model 'config.json'))) {
  Write-Host 'Downloading the MusicGen-small model (about 2.4 GB)...'
  & $py -c "from huggingface_hub import snapshot_download; snapshot_download('facebook/musicgen-small', local_dir=r'$model', allow_patterns=['*.json','*.safetensors','*.txt','*.model'])"; if ($LASTEXITCODE) { throw 'The model did not download.' }
  # store it at half precision (1.2 GB instead of 2.4 GB). It already runs at half precision on a graphics card, so songs come out the same
  Write-Host 'Making the model smaller (about a minute)...'
  & $py -c "import torch; from transformers import MusicgenForConditionalGeneration as M; m=M.from_pretrained(r'$model', torch_dtype=torch.float32, low_cpu_mem_usage=True).half(); m.save_pretrained(r'$model', safe_serialization=True)"
  if ($LASTEXITCODE) { Write-Host 'It could not be made smaller; the full-size model is kept and works the same.' -ForegroundColor Yellow }
}
if ((Test-Path $py) -and (Test-Path (Join-Path $model 'config.json'))) { Write-Host 'Done. Open Moundshroud > Studio > Music studio > Compose.' -ForegroundColor Green } else { Write-Host 'Something is missing; run this again.' -ForegroundColor Red }

