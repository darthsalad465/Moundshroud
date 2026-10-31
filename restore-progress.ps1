# Keeps and restores your Moundshroud progress (notes, chats, flashcards, quizzes, reminders, chess study,
# household prep, and the progress kept inside the window: ratings, journal, favourites, Bible notes, playlists).
# Works on its own - you do not need Moundshroud to be running or even starting.
#
#   .\restore-progress.ps1 -List                   see the copies you have (newest first)
#   .\restore-progress.ps1 -Backup                 make a fresh copy now
#   .\restore-progress.ps1 -Name latest            put the newest copy back
#   .\restore-progress.ps1 -Name progress-2026-10-26
#   .\restore-progress.ps1 -Name latest -Force     also restore window progress while Moundshroud is open
#
# A restore first saves what is there now as before-restore-YYYY-MM-DD_HHmmss, so it can be undone.
# Copies live in Documents\Moundshroud Backups. Close Moundshroud before restoring window progress.
param([string]$Name, [switch]$List, [switch]$Backup, [switch]$Force)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$docs = @((Join-Path $HOME 'OneDrive\Documents'), (Join-Path $HOME 'Documents')) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $docs) { $docs = $HOME }
$notes = Join-Path $docs 'Assistant Notes'
# where the copies go is the same choice the app uses (dataackup-place.json): this PC only unless you picked OneDrive
$place = 'local'; try { $p = Get-Content (Join-Path $root 'dataackup-place.json') -Raw | ConvertFrom-Json; if ($p.place -eq 'onedrive') { $place = 'onedrive' } } catch { }
$dest = if ($place -eq 'onedrive') { Join-Path $docs 'Moundshroud Backups' } else { Join-Path $HOME 'Moundshroud Backups' }
$older = Join-Path $docs 'Moundshroud Backups'
if ($place -eq 'local' -and -not (Test-Path $dest) -and (Test-Path $older)) { Write-Host "No copies on this PC yet; using the older ones in $older"; $dest = $older }
$data = Join-Path $root 'data'
$profileDir = Join-Path $root 'edge-profile'
$progress = Join-Path $dest ('progress-' + (Get-Date -Format 'yyyy-MM-dd'))
$keep = 10

function Get-Dirs { if (-not (Test-Path $dest)) { return @() } @(Get-ChildItem $dest -Directory | Where-Object { $_.Name -like 'progress-*' -or $_.Name -like 'before-restore-*' } | Sort-Object Name -Descending) }

function Copy-Progress([string]$into, [switch]$Quiet) {
  $n = 0; $d = 0; $s = 0
  New-Item -ItemType Directory -Force (Join-Path $into 'notes') | Out-Null
  New-Item -ItemType Directory -Force (Join-Path $into 'data') | Out-Null
  New-Item -ItemType Directory -Force (Join-Path $into 'window-progress\Local Storage\leveldb') | Out-Null
  if (Test-Path $notes) { Get-ChildItem $notes -Filter *.md -File | ForEach-Object { Copy-Item $_.FullName (Join-Path $into 'notes') -Force; $n++ } }
  if (Test-Path $data) {
    Get-ChildItem $data -File | Where-Object { $_.Name -notmatch '^index\.db|\.db-(shm|wal)$|^cmudict\.dict$|^clip-on$' -and $_.Length -le 24MB } |
      ForEach-Object { Copy-Item $_.FullName (Join-Path $into 'data') -Force; $d++ }
  }
  $lvl = Join-Path $profileDir 'Default\Local Storage\leveldb'
  if (Test-Path $lvl) {
    Get-ChildItem $lvl -File | Where-Object { $_.Name -notmatch '^LOCK$' } | ForEach-Object {
      try { Copy-Item $_.FullName (Join-Path $into 'window-progress\Local Storage\leveldb') -Force -ErrorAction Stop; $s++ } catch { }
    }
  }
  $pref = Join-Path $profileDir 'Default\Preferences'
  if (Test-Path $pref) { try { Copy-Item $pref (Join-Path $into 'window-progress') -Force -ErrorAction Stop } catch { } }
  if (-not $Quiet) { Write-Host ("  saved your notes and " + $d + " data files, and " + $s + " files of window progress") }
  return @{ notes = $n; data = $d; store = $s }
}

if ($List) {
  $all = Get-Dirs
  if (-not $all) { Write-Host "No progress copies yet in $dest"; return }
  Write-Host ("Progress copies in " + $dest + " (newest first)")
  Write-Host '  progress-...        a copy to restore from'
  Write-Host '  before-restore-...  saved automatically just before a restore, so a restore can be undone'
  $all | ForEach-Object {
    $sz = (Get-ChildItem $_.FullName -Recurse -File | Measure-Object Length -Sum).Sum
    $tag = if ($_.Name -like 'before-restore-*') { '  (undo)' } else { '' }
    '{0}{1}   {2,8:N1} MB' -f $_.Name, $tag, ($sz / 1MB)
  }
  return
}

if ($Backup) {
  New-Item -ItemType Directory -Force $progress | Out-Null
  Write-Host ("Saving your progress into " + $progress)
  $c = Copy-Progress $progress
  foreach ($old in (Get-Dirs | Select-Object -Skip $keep)) { Remove-Item $old.FullName -Recurse -Force; Write-Host ("  tidied up " + $old.Name) }
  return
}

if (-not $Name) {
  Write-Host 'Usage: .\restore-progress.ps1 -List | -Backup | -Name latest [-Force]'
  Write-Host 'Run .\restore-progress.ps1 -List first to see what you have.'
  return
}

$all = Get-Dirs
if (-not $all) { Write-Host "No progress copies found in $dest"; return }
$pick = if ($Name -eq 'latest') { $all[0] } else { $all | Where-Object { $_.Name -eq $Name -or $_.Name -like "*$Name*" } | Select-Object -First 1 }
if (-not $pick) { Write-Host ("No copy matches '" + $Name + "'. Use -List to see them."); return }

# is Moundshroud (or its window) up? then window progress cannot be written back safely
$running = $false
try { if (Get-NetTCPConnection -LocalPort 47231 -State Listen -ErrorAction SilentlyContinue) { $running = $true } } catch { }
if (-not $running) { try { if (Get-Process msedge -ErrorAction SilentlyContinue) { $running = $true } } catch { } }

Write-Host ("Restoring " + $pick.Name)
$undo = Join-Path $dest ('before-restore-' + (Get-Date -Format 'yyyy-MM-dd_HHmmss'))
New-Item -ItemType Directory -Force $undo | Out-Null
Copy-Progress $undo -Quiet | Out-Null
Write-Host ("  first saved what you have now into " + (Split-Path $undo -Leaf) + " (restore again with -Name " + (Split-Path $undo -Leaf) + ")")

$n = 0; $d = 0
New-Item -ItemType Directory -Force $notes | Out-Null
foreach ($f in (Get-ChildItem (Join-Path $pick.FullName 'notes') -File -ErrorAction SilentlyContinue)) { Copy-Item $f.FullName $notes -Force; $n++ }
New-Item -ItemType Directory -Force $data | Out-Null
foreach ($f in (Get-ChildItem (Join-Path $pick.FullName 'data') -File -ErrorAction SilentlyContinue)) { Copy-Item $f.FullName $data -Force; $d++ }
Write-Host ("  put back " + $n + " notes and " + $d + " data files (chats, cards, quizzes, reminders, chess study, prep)")

$src = Join-Path $pick.FullName 'window-progress'
if (Test-Path $src) {
  if ($running -and -not $Force) {
    Write-Host '  window progress (ratings, journal, favourites, Bible notes, playlists) was NOT restored:'
    Write-Host '  Moundshroud or its window is still open, and it would be overwritten again on close.'
    Write-Host '  Close Moundshroud (right-click the tray icon, Quit), then run this command again.'
  } else {
    if ($running) { Write-Host '  Moundshroud is open, so window progress may be replaced again when it closes.' }
    $t = Join-Path $profileDir 'Default\Local Storage\leveldb'
    New-Item -ItemType Directory -Force $t | Out-Null
    $s = 0
    foreach ($f in (Get-ChildItem (Join-Path $src 'Local Storage\leveldb') -File -ErrorAction SilentlyContinue)) { try { Copy-Item $f.FullName $t -Force -ErrorAction Stop; $s++ } catch { } }
    New-Item -ItemType Directory -Force (Join-Path $profileDir 'Default') | Out-Null
    $pf = Join-Path $src 'Preferences'
    if (Test-Path $pf) { try { Copy-Item $pf (Join-Path $profileDir 'Default') -Force -ErrorAction Stop } catch { } }
    Write-Host ("  put back " + $s + " files of window progress")
    Write-Host '  Start Moundshroud and check: your ratings, journal, favourites and notes should be there.'
  }
}
Write-Host 'Done.'
