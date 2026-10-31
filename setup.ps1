# Moundshroud first-time setup. Double-click Setup-Moundshroud.bat (it runs this). Safe to run again: it only does what is still missing.
#   -Auto          answer every question with the default (no prompts)
#   -NoLaunch      do not start Moundshroud at the end
#   -SkipInstalls  never install Node.js or Ollama (only check for them)
#   -SkipModels    do not download an AI model
#   -KiwixZip      use this local file (or web address) instead of the default kiwix-tools download
#   -ShortcutDir   put the shortcuts here instead of the Desktop and Start menu
param([switch]$Auto, [switch]$NoLaunch, [switch]$SkipInstalls, [switch]$SkipModels, [string]$KiwixZip = '', [string]$ShortcutDir = '')
$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$problems = @()
function Say($m, $c = 'Gray') { Write-Host $m -ForegroundColor $c }
function Step($m) { Write-Host ''; Write-Host "== $m" -ForegroundColor Cyan }
function Ask($q, $def = 'Y') { if ($Auto) { return ($def -eq 'Y') }; $a = Read-Host "$q [$def]"; if (-not $a) { $a = $def }; return ($a -match '^[Yy]') }
function RefreshPath { $env:Path = [Environment]::GetEnvironmentVariable('Path', 'Machine') + ';' + [Environment]::GetEnvironmentVariable('Path', 'User') }
function Winget($id) { if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { return $false }; & winget install --id $id -e --accept-package-agreements --accept-source-agreements --silent; RefreshPath; return $true }

Write-Host ''; Write-Host '   MOUNDSHROUD  -  a private assistant that lives on your PC' -ForegroundColor Magenta; Say "   Setting up in $root"

Step '1. Checking the files'
try { Get-ChildItem $root -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue } catch { }
foreach ($f in 'server.js', 'open-moundshroud.ps1', 'Listener.cs', 'web\index.html') { if (-not (Test-Path (Join-Path $root $f))) { $problems += "Missing $f. Unzip Part 1 completely into this folder." } }
if (-not (Test-Path (Join-Path $root 'web\data\bible-web.json'))) { Say 'Part 2 (the Bibles, recipes and star data) is not here yet.' Yellow; $problems += 'Unzip the Moundshroud ...-part2-data.zip file into the SAME folder (choose "Replace" or "Merge" if asked), then run setup again.' } else { Say 'All the files are here.' Green }
New-Item -ItemType Directory -Force (Join-Path $root 'data'), (Join-Path $root 'nomad\library') | Out-Null

Step '2. Node.js (runs the Moundshroud server)'
RefreshPath; $node = (Get-Command node -ErrorAction SilentlyContinue)
if (-not $node -and (Test-Path 'C:\Program Files\nodejs\node.exe')) { $node = 'C:\Program Files\nodejs\node.exe' }
if (-not $node) {
  Say 'Node.js is not installed. It is a free, standard program from nodejs.org.' Yellow
  if (-not $SkipInstalls -and (Ask 'Install Node.js now?') -and (Winget 'OpenJS.NodeJS.LTS')) { $node = (Get-Command node -ErrorAction SilentlyContinue); if (-not $node -and (Test-Path 'C:\Program Files\nodejs\node.exe')) { $node = 'C:\Program Files\nodejs\node.exe' } }
  if (-not $node) { $problems += 'Install Node.js (https://nodejs.org, the LTS button), then run Setup-Moundshroud.bat again.'; if (-not $Auto) { Start-Process 'https://nodejs.org' } }
}
if ($node) { Say ('Node.js found: ' + (& $(if ($node -is [string]) { $node } else { $node.Source }) --version)) Green }

Step '3. Ollama (runs the AI on your PC)'
$ollama = Join-Path $env:LOCALAPPDATA 'Programs\Ollama\ollama.exe'
if (-not (Test-Path $ollama)) {
  Say 'Ollama is not installed. It is the free program that runs the AI model on your own computer.' Yellow
  if (-not $SkipInstalls -and (Ask 'Install Ollama now?') -and (Winget 'Ollama.Ollama')) { Start-Sleep -Seconds 2 }
  if (-not (Test-Path $ollama)) { $problems += 'Install Ollama (https://ollama.com/download), then run Setup-Moundshroud.bat again.'; if (-not $Auto -and -not $SkipInstalls) { Start-Process 'https://ollama.com/download' } }
}
if (Test-Path $ollama) {
  Say 'Ollama found.' Green
  if (-not $SkipModels) {
    $have = ''; try { $have = (& $ollama list 2>$null) -join ' ' } catch { }
    if ($have -match 'qwen3\.5') { Say 'An AI model is already installed.' Green }
    else {
      Say 'Moundshroud needs at least one AI model. Choose one (you can add more later):'; Say '   1  Small  (about 2.5 GB)  works on almost any PC  [recommended to start]'; Say '   2  Standard  (about 6 GB)  smarter, wants a graphics card with 8 GB or more'; Say '   3  Both'; Say '   4  Skip for now'
      $c = if ($Auto) { '1' } else { Read-Host 'Your choice [1]' }; if (-not $c) { $c = '1' }
      $tags = switch ($c) { '2' { @('qwen3.5:9b') } '3' { @('qwen3.5:2b', 'qwen3.5:9b') } '4' { @() } default { @('qwen3.5:2b') } }
      if ($tags.Count) {
        try { Invoke-WebRequest 'http://127.0.0.1:11434' -UseBasicParsing -TimeoutSec 2 | Out-Null } catch { Start-Process $ollama -ArgumentList 'serve' -WindowStyle Hidden; for ($i = 0; $i -lt 30; $i++) { Start-Sleep -Milliseconds 500; try { Invoke-WebRequest 'http://127.0.0.1:11434' -UseBasicParsing -TimeoutSec 2 | Out-Null; break } catch { } } }
        foreach ($t in $tags) { Say "Downloading $t (this can take a while)..." Yellow; & $ollama pull $t; if ($LASTEXITCODE -ne 0) { $problems += "The model $t did not download. Run:  ollama pull $t  later." } }
      }
    }
  }
}

Step '4. The offline library reader (kiwix)'
$kdir = Join-Path $root 'nomad\kiwix-tools'
if (Test-Path (Join-Path $kdir 'kiwix-serve.exe')) { Say 'Already there.' Green }
else {
  Say 'This small tool (17 MB, from download.kiwix.org) lets Moundshroud read the offline libraries (Wikipedia and more).' Yellow
  if (Ask 'Download it now?') {
    try {
      $tmp = Join-Path ([IO.Path]::GetTempPath()) ('kiwix-' + [guid]::NewGuid().ToString('N')); New-Item -ItemType Directory $tmp | Out-Null; $zip = Join-Path $tmp 'k.zip'
      if ($KiwixZip -and (Test-Path $KiwixZip)) { Copy-Item $KiwixZip $zip } else { $u = if ($KiwixZip) { $KiwixZip } else { 'https://download.kiwix.org/release/kiwix-tools/kiwix-tools_win-x86_64-3.8.1.zip' }; Invoke-WebRequest $u -OutFile $zip -UseBasicParsing }
      Expand-Archive $zip -DestinationPath (Join-Path $tmp 'x') -Force; $exe = Get-ChildItem (Join-Path $tmp 'x') -Recurse -Filter 'kiwix-serve.exe' | Select-Object -First 1
      if (-not $exe) { throw 'kiwix-serve.exe was not inside the download.' }
      New-Item -ItemType Directory -Force $kdir | Out-Null; Copy-Item (Join-Path $exe.DirectoryName '*') $kdir -Recurse -Force; Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue; Say 'Installed.' Green
    } catch { $problems += 'The library reader could not be downloaded (' + $_.Exception.Message + '). Moundshroud still works; the offline libraries need it. Run setup again when online.' }
  } else { $problems += 'Skipped the library reader. Run setup again later if you want the offline libraries.' }
}

Step '5. The hotkey and reminder helper'
$exeL = Join-Path $root 'assistant-listener.exe'
if (Test-Path $exeL) { Say 'Already built.' Green }
else {
  $csc = @("$env:WINDIR\Microsoft.NET\Framework64\v4.0.30319\csc.exe", "$env:WINDIR\Microsoft.NET\Framework\v4.0.30319\csc.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $csc) { $problems += 'Could not build the hotkey helper (Windows .NET compiler not found). Moundshroud still works from its shortcut.' }
  else { Say 'Building it from its source code on this PC (so nothing unknown is run)...'; & $csc /nologo /target:winexe "/out:$exeL" /r:System.Windows.Forms.dll /r:System.Drawing.dll (Join-Path $root 'Listener.cs') | Out-Null; if (Test-Path $exeL) { Say 'Built.' Green } else { $problems += 'The hotkey helper did not build. Moundshroud still works from its shortcut.' } }
}

Step '6. Shortcuts'
try {
  $ws = New-Object -ComObject WScript.Shell; $dirs = @(); if ($ShortcutDir) { New-Item -ItemType Directory -Force $ShortcutDir | Out-Null; $dirs += $ShortcutDir } else { $dirs += [Environment]::GetFolderPath('Desktop'); $dirs += (Join-Path ([Environment]::GetFolderPath('Programs')) '') }
  foreach ($d in $dirs) { $l = $ws.CreateShortcut((Join-Path $d 'Moundshroud.lnk')); $l.TargetPath = "$env:WINDIR\System32\WindowsPowerShell\v1.0\powershell.exe"; $l.Arguments = "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$root\open-moundshroud.ps1`""; $l.WorkingDirectory = $root; if (Test-Path "$root\web\moundshroud.ico") { $l.IconLocation = "$root\web\moundshroud.ico" }; $l.Description = 'Moundshroud, your private assistant'; $l.Save() }
  Say 'A "Moundshroud" shortcut is on your Desktop and in the Start menu.' Green
} catch { $problems += 'Could not make the shortcuts: ' + $_.Exception.Message }

Write-Host ''
if ($problems.Count) { Say '=== Almost there. Please take care of this:' Yellow; $problems | ForEach-Object { Say "  - $_" Yellow } }
else { Say '=== All set!' Green }
Say ''; Say 'How to open Moundshroud: the "Moundshroud" shortcut, or press Ctrl + Alt + A anywhere.'; Say 'Next: in Moundshroud open Settings > Run a self-test. For the offline libraries: Prepare > Stock up.'
if (-not $NoLaunch -and $node) { Say 'Starting Moundshroud...' Green; Start-Process powershell.exe -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', "`"$root\open-moundshroud.ps1`"" -WindowStyle Hidden }
if (-not $Auto) { Write-Host ''; Read-Host 'Press Enter to close this window' | Out-Null }
