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
if (-not (Test-Path $model)) {
  Write-Host 'Downloading the SDXL-Turbo model (about 6.5 GB, several minutes)...'
  & curl.exe -L -C - --retry 5 -o $model 'https://huggingface.co/stabilityai/sdxl-turbo/resolve/main/sd_xl_turbo_1.0_fp16.safetensors'
}
if ((Test-Path $exe) -and (Test-Path $model)) { Write-Host 'Done. Open Moundshroud > Studio > AI art.' -ForegroundColor Green } else { Write-Host 'Something is missing; run this again.' -ForegroundColor Red }

