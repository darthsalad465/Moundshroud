# Rolls the Moundshroud app back to a saved snapshot.
#   .\restore-snapshot.ps1 -Name latest            restore the newest snapshot
#   .\restore-snapshot.ps1 -Name 2026-10-21_...zip restore a specific one (see: .\snapshot.ps1 -List)
#   .\restore-snapshot.ps1 -Name latest -To C:\temp\check   only extract somewhere else, change nothing
# Before restoring, it saves the CURRENT state as a new snapshot ("before-restore"), so a restore can itself be undone.
param([string]$Name = 'latest', [string]$To = '')
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dir = Join-Path $root '_snapshots'
$all = Get-ChildItem $dir -Filter *.zip -ErrorAction SilentlyContinue | Sort-Object Name -Descending
if (-not $all) { throw 'No snapshots found.' }
$zip = if ($Name -eq 'latest') { $all[0] } else { $all | Where-Object { $_.Name -eq $Name -or $_.Name -like "*$Name*" } | Select-Object -First 1 }
if (-not $zip) { throw "No snapshot matches '$Name'. Run .\snapshot.ps1 -List" }

Add-Type -AssemblyName System.IO.Compression.FileSystem
if ($To) {
  New-Item -ItemType Directory -Force $To | Out-Null
  [IO.Compression.ZipFile]::ExtractToDirectory($zip.FullName, $To)
  Write-Output "Extracted $($zip.Name) to $To (nothing was changed)."
  return
}

& (Join-Path $root 'snapshot.ps1') -Label 'before-restore' | Out-Null
# stop the running app so files are not locked
Get-Process assistant-listener -ErrorAction SilentlyContinue | Stop-Process -Force
$p = (Get-NetTCPConnection -LocalPort 47231 -State Listen -ErrorAction SilentlyContinue).OwningProcess; if ($p) { Stop-Process -Id $p -Force }
Get-Process ollama, llama-server -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep 1

$tmp = Join-Path ([IO.Path]::GetTempPath()) ("moundshroud-restore-" + [guid]::NewGuid().ToString('N'))
try {
  [IO.Compression.ZipFile]::ExtractToDirectory($zip.FullName, $tmp)
  # remove code folders first so files added after the snapshot disappear, then copy everything back
  # web\music (recorded piano and Mozart, tens of MB) is not stored in snapshots: set it aside and put it back afterwards
  $musicNow = Join-Path $root 'web\music'; $musicKeep = Join-Path ([IO.Path]::GetTempPath()) ('moundshroud-music-' + [guid]::NewGuid().ToString('N')); if (Test-Path $musicNow) { Move-Item $musicNow $musicKeep }
  foreach ($d in 'lib', 'web', 'py') { Remove-Item (Join-Path $root $d) -Recurse -Force -ErrorAction SilentlyContinue }
  Copy-Item (Join-Path $tmp '*') $root -Recurse -Force
  if (Test-Path $musicKeep) { if (Test-Path $musicNow) { Remove-Item $musicKeep -Recurse -Force } else { New-Item -ItemType Directory -Force (Split-Path $musicNow) | Out-Null; Move-Item $musicKeep $musicNow } }
} finally { Remove-Item $tmp -Recurse -Force -ErrorAction SilentlyContinue }
Write-Output "Restored $($zip.Name). Press Ctrl+Alt+A to start Moundshroud again (the tray helper will relaunch with the next login, or run assistant-listener.exe)."
