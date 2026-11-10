# Installs the offline video maker for Moundshroud (Studio > AI art > Video, and the video step in Chat > Swarm).
# Downloads about 6.7 GB once: the Wan 2.1 text-to-video model (1.3 billion parameters, Apache 2.0 licence), its picture
# decoder and its text reader. It is run by the same stable-diffusion.cpp program as the pictures, so run
# install-art-model.ps1 first if you have not. After this, short silent clips are made on your own PC with no internet.
#   powershell -ExecutionPolicy Bypass -File install-video-model.ps1
$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path; $d = Join-Path $root 'imggen\models\video'; New-Item -ItemType Directory -Force $d | Out-Null
if (-not (Test-Path (Join-Path $root 'imggen\bin\sd-cli.exe'))) { Write-Host 'The picture program is missing. Run install-art-model.ps1 first.' -ForegroundColor Red; exit 1 }
$hf = 'https://huggingface.co'
$files = @(
  @{ name = 'wan_2.1_vae.safetensors';          gb = 0.24; url = "$hf/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/vae/wan_2.1_vae.safetensors" },
  @{ name = 'wan2.1_t2v_1.3B_fp16.safetensors'; gb = 2.64; url = "$hf/Comfy-Org/Wan_2.1_ComfyUI_repackaged/resolve/main/split_files/diffusion_models/wan2.1_t2v_1.3B_fp16.safetensors" },
  @{ name = 'umt5-xxl-encoder-Q5_K_M.gguf';     gb = 3.86; url = "$hf/city96/umt5-xxl-encoder-gguf/resolve/main/umt5-xxl-encoder-Q5_K_M.gguf" }
)
$ok = $true
foreach ($f in $files) {
  $p = Join-Path $d $f.name
  # a file within 2% of its full size is taken as complete; anything smaller is resumed
  if ((Test-Path $p) -and (Get-Item $p).Length -ge ($f.gb * 1GB * 0.98)) { Write-Host "$($f.name) is already here."; continue }
  Write-Host "Downloading $($f.name) (about $($f.gb) GB) from huggingface.co ..."
  & curl.exe -L --fail -C - --retry 5 --retry-delay 5 -o $p $f.url
  if ($LASTEXITCODE -ne 0 -or -not (Test-Path $p) -or (Get-Item $p).Length -lt ($f.gb * 1GB * 0.98)) { Write-Host "$($f.name) did not finish downloading." -ForegroundColor Yellow; $ok = $false }
}
if ($ok) { Write-Host 'Done. Open Moundshroud > Studio > AI art > Video.' -ForegroundColor Green } else { Write-Host 'Something is missing; run this again and it carries on where it stopped.' -ForegroundColor Red }
