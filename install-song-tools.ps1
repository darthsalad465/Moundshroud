# Installs the Converter's sound and video tools into the Moundshroud folder (about 600 MB, once):
#   songtools\venv        Python with basic-pitch (turns a song into MIDI notes) and imageio-ffmpeg
#   songtools\ffmpeg.exe  a current ffmpeg, copied out of imageio-ffmpeg (sound and video conversion)
# Everything comes from PyPI. Nothing outside the Moundshroud folder is changed. Run it again to repair.
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$st = Join-Path $root 'songtools'; $venv = Join-Path $st 'venv'; $py = Join-Path $venv 'Scripts\python.exe'
New-Item -ItemType Directory -Force $st | Out-Null
if (-not (Test-Path $py)) {
  $base = (Get-Command python -ErrorAction SilentlyContinue).Source
  if (-not $base) { Write-Host 'Python 3.10 or 3.11 is needed first (python.org).'; exit 1 }
  Write-Host 'Making songtools\venv ...'; & $base -m venv $venv
}
& $py -m pip install --upgrade pip --quiet
Write-Host 'Installing basic-pitch and imageio-ffmpeg (a few minutes) ...'
& $py -m pip install basic-pitch imageio-ffmpeg
$ff = & $py -c "import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())"
if ($ff -and (Test-Path $ff)) { Copy-Item $ff (Join-Path $st 'ffmpeg.exe') -Force; Write-Host ('ffmpeg: ' + (Join-Path $st 'ffmpeg.exe')) }
& $py -c "import basic_pitch; print('basic-pitch ready')"
Write-Host 'Done. Restart Moundshroud, then use Tools > Converter.'
