# Installs the offline picture maker for Moundshroud (Studio > AI art, and "Type it, get pixel art" in the Pixel art tool).
# Downloads about 6.5 GB once: the open-source stable-diffusion.cpp program (MIT) and the SDXL-Turbo model (Stability AI, free for personal use).
# After this, pictures are made on your own PC with no internet. Close Moundshroud first, run this, then open Moundshroud again.
#   powershell -ExecutionPolicy Bypass -File install-art-model.ps1
$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path; $d = Join-Path $root 'imggen'; New-Item -ItemType Directory -Force (Join-Path $d 'models') | Out-Null
$exe = Join-Path $d 'bin\sd-cli.exe'; $model = Join-Path $d 'models\sd_xl_turbo_1.0_fp16.safetensors'
if (-not (Test-Path $exe)) {
  Write-Host 'Downloading the picture program (about 28 MB)...'
  $rel = Invoke-RestMethod 'https://api.github.com/repos/leejet/stable-diffusion.cpp/releases/latest' -Headers @{ 'User-Agent' = 'moundshroud' }
  $asset = $rel.assets | Where-Object { $_.name -match 'bin-win-vulkan-x64\.zip$' } | Select-Object -First 1; if (-not $asset) { throw 'Could not find the Windows picture program on GitHub.' }
  $zip = Join-Path $d 'sd.zip'; Invoke-WebRequest $asset.browser_download_url -OutFile $zip; Expand-Archive $zip (Join-Path $d 'bin') -Force; Remove-Item $zip
}
$q8 = Join-Path $d 'models\sd_xl_turbo_1.0_q8_0.gguf'
if (-not (Test-Path $model) -and -not (Test-Path $q8)) {
  Write-Host 'Downloading the SDXL-Turbo model (about 6.5 GB, several minutes)...'
  & curl.exe -L -C - --retry 5 -o $model 'https://huggingface.co/stabilityai/sdxl-turbo/resolve/main/sd_xl_turbo_1.0_fp16.safetensors'
}
# keep a compact copy (about 3.9 GB instead of 6.5 GB; the pictures look the same) and drop the big download once it is made
if ((Test-Path $exe) -and (Test-Path $model) -and -not (Test-Path $q8)) {
  Write-Host 'Making the compact copy of the model (under a minute)...'
  & $exe -M convert -m $model -o $q8 --type q8_0 | Out-Null
  if ($LASTEXITCODE -eq 0 -and (Test-Path $q8) -and (Get-Item $q8).Length -gt 3GB) { Remove-Item $model } else { Remove-Item $q8 -ErrorAction SilentlyContinue; Write-Host 'The compact copy could not be made; the full model is kept and works the same.' -ForegroundColor Yellow }
}
if ((Test-Path $exe) -and ((Test-Path $q8) -or (Test-Path $model))) { Write-Host 'Done. Open Moundshroud > Studio > AI art.' -ForegroundColor Green } else { Write-Host 'Something is missing; run this again.' -ForegroundColor Red }

