# Saves a dated zip of the Moundshroud app (code + small settings/data files) into _snapshots, so any change can be rolled back.
#   .\snapshot.ps1 -Label "before voice changes"     make a snapshot
#   .\snapshot.ps1 -List                              list snapshots (newest first)
# Not included (huge or rebuildable): web\music (recorded piano and Mozart), nomad libraries, voice model, pyenv, edge-profile, index.db, previews, tmp, lo-profile, _snapshots.
param([string]$Label = 'manual', [switch]$List, [int]$Keep = 40)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$dir = Join-Path $root '_snapshots'
New-Item -ItemType Directory -Force $dir | Out-Null

if ($List) {
  Get-ChildItem $dir -Filter *.zip | Sort-Object Name -Descending | ForEach-Object { '{0}  {1,7:N0} KB' -f $_.Name, ($_.Length / 1KB) }
  return
}

$stamp = Get-Date -Format 'yyyy-MM-dd_HHmmss'
$safe = ($Label -replace '[^\w\- ]', '' -replace '\s+', '-').Trim('-'); if (-not $safe) { $safe = 'manual' }
$zip = Join-Path $dir "$stamp`_$safe.zip"
$stage = Join-Path ([IO.Path]::GetTempPath()) ("moundshroud-snap-" + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Force $stage | Out-Null
try {
  # code and scripts
  foreach ($f in 'server.js', 'Listener.cs', 'assistant-listener.exe', 'ocr.ps1', 'pc-volume.ps1', 'snapshot.ps1', 'restore-snapshot.ps1', 'make-release.ps1', 'setup.ps1', 'Setup-Moundshroud.bat', 'START-HERE.txt', 'README.md', 'VERSION', 'index.html', 'SNAPSHOTS.txt') {
    $p = Join-Path $root $f; if (Test-Path $p) { Copy-Item $p (Join-Path $stage $f) -Force }
  }
  foreach ($d in 'lib', 'web', 'py') {
    $p = Join-Path $root $d; if (Test-Path $p) { Copy-Item $p (Join-Path $stage $d) -Recurse -Force }
    if ($d -eq 'web') { Remove-Item (Join-Path $stage 'web\music') -Recurse -Force -ErrorAction SilentlyContinue }   # recorded music is big and re-downloadable
  }
  # small user data (settings, chats, flashcards, quizzes, prompts, reminders, notes pointers) - not the search index
  $dd = Join-Path $root 'data'
  if (Test-Path $dd) {
    New-Item -ItemType Directory -Force (Join-Path $stage 'data') | Out-Null
    Get-ChildItem $dd -File | Where-Object { $_.Extension -in '.json', '.tsv', '.jsonl' -or $_.Name -eq 'clip-on' } | Copy-Item -Destination (Join-Path $stage 'data') -Force
  }
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  [IO.Compression.ZipFile]::CreateFromDirectory($stage, $zip, [IO.Compression.CompressionLevel]::Optimal, $false)
} finally { Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue }

# keep the newest $Keep snapshots
Get-ChildItem $dir -Filter *.zip | Sort-Object Name -Descending | Select-Object -Skip $Keep | Remove-Item -Force
$n = (Get-ChildItem $dir -Filter *.zip).Count
Write-Output ("Saved snapshot: {0} ({1:N0} KB). {2} snapshots kept." -f (Split-Path $zip -Leaf), ((Get-Item $zip).Length / 1KB), $n)
