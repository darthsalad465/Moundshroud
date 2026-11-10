# Installs the Respan Gateway for Moundshroud: the open-source gateway (MIT) that every Claude request goes through
# (chat, the buddy, quizzes, documents, the chess coach), so one local place can route, retry and log them.
# https://github.com/respanai/respan-gateway - a few megabytes, no account and no Respan key: the gateway spends
# the Anthropic key you already saved in Moundshroud, which is handed to it in memory and never written to disk.
# It listens on 127.0.0.1 only. Without it, Claude requests go straight to Anthropic exactly as before.
# Close Moundshroud first, run this, then open Moundshroud again (it looks for the gateway when it starts).
#   powershell -ExecutionPolicy Bypass -File install-gateway.ps1
$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path; $venv = Join-Path $root '.venv'; $py = Join-Path $venv 'Scripts\python.exe'
$version = '0.3.0'
if (-not (Test-Path $py)) {
  $sys = (Get-Command python -ErrorAction SilentlyContinue); $sysExe = ''
  if ($sys) { $sysExe = $sys.Source } elseif (Test-Path (Join-Path $root 'pyenv\Scripts\python.exe')) { $sysExe = Join-Path $root 'pyenv\Scripts\python.exe' }
  if (-not $sysExe) { throw 'Python 3.10 or newer is needed. Install it from python.org and run this again.' }
  Write-Host 'Creating a private Python environment...'; & $sysExe -m venv $venv; if ($LASTEXITCODE) { throw 'Could not create the Python environment.' }
}
$v = & $py -c 'import sys; print(sys.version_info.major * 100 + sys.version_info.minor)'
if ([int]$v -lt 310) { throw 'The Respan Gateway needs Python 3.10 or newer, and this one is older.' }
$have = $false; try { & $py -c 'import respan_gateway' 2>$null; $have = ($LASTEXITCODE -eq 0) } catch { }
if (-not $have) {
  Write-Host ('Installing respan-gateway ' + $version + ' (a wheel, no account needed)...')
  & $py -m pip install --disable-pip-version-check --only-binary=:all: ('respan-gateway' + '==' + $version); if ($LASTEXITCODE) { throw 'The Respan Gateway did not install.' }
}
& $py -c 'import respan_gateway; print("respan-gateway " + respan_gateway.__version__ + " is ready in .venv")'
Write-Host 'Done. With an Anthropic key saved in Moundshroud, every Claude request now goes through the gateway.' -ForegroundColor Green
Write-Host 'To watch it by hand: .\.venv\Scripts\python.exe -m respan_gateway  (then http://127.0.0.1:8080/ui/)'
