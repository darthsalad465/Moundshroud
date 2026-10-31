# Builds the shareable copy of Moundshroud into releases\ :
#   Moundshroud-<ver>-part1-program.zip   the program, setup and docs  (small)
#   Moundshroud-<ver>-part2-data.zip      the Bibles, recipes, star data and other reference files
#   SHA256.txt                      checksums, and MESSAGE-FOR-DISCORD.txt  a ready-to-paste note for the person you send it to
# Each zip is kept under 10 MB so both fit Discord's free upload limit. Both unzip into the same "Moundshroud" folder.
# NOT included: anything personal (notes, chats, flashcards, reminders, settings, snapshots, the Moundshroud window profile), the offline libraries, the music, AI models,
# voice models, Python, the chess engine, and the built tray program (the friend's setup builds it from Listener.cs, so no unsigned .exe is sent).
#   .\make-release.ps1            build
#   .\make-release.ps1 -Verify    build, then act as the friend: unpack both parts elsewhere, run the setup there (no installs, no downloads) and start it
param([switch]$Verify)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$ver = (Get-Content (Join-Path $root 'VERSION') -Raw).Trim()
$out = Join-Path $root 'releases'; New-Item -ItemType Directory -Force $out | Out-Null
Get-ChildItem $out -File -ErrorAction SilentlyContinue | Remove-Item -Force
$stage = Join-Path ([IO.Path]::GetTempPath()) ('moundshroud-release-' + [guid]::NewGuid().ToString('N')); $pkg = Join-Path $stage 'Moundshroud'
New-Item -ItemType Directory -Force $pkg | Out-Null
Add-Type -AssemblyName System.IO.Compression, System.IO.Compression.FileSystem
function Zip($dest, $files) {                                      # entry by entry so paths use "/" (the zip standard)
  $fs = [IO.File]::Create($dest); $za = New-Object IO.Compression.ZipArchive($fs, [IO.Compression.ZipArchiveMode]::Create)
  try { foreach ($f in $files) { $rel = $f.FullName.Substring($stage.Length + 1).Replace('\', '/'); $en = $za.CreateEntry($rel, [IO.Compression.CompressionLevel]::Optimal); $en.LastWriteTime = $f.LastWriteTime; $es = $en.Open(); $in = [IO.File]::OpenRead($f.FullName); try { $in.CopyTo($es) } finally { $in.Dispose(); $es.Dispose() } } } finally { $za.Dispose(); $fs.Dispose() }
}
try {
  foreach ($f in 'server.js', 'Listener.cs', 'open-moundshroud.ps1', 'ocr.ps1', 'pc-volume.ps1', 'snapshot.ps1', 'restore-snapshot.ps1', 'apply-update.ps1', 'update.json', 'SNAPSHOTS.txt', 'README.md', 'LICENSE', 'START-HERE.txt', 'VERSION', 'setup.ps1', 'Setup-Moundshroud.bat') {
    $p = Join-Path $root $f; if (Test-Path $p) { Copy-Item $p (Join-Path $pkg $f) -Force } else { Write-Host "  (missing, skipped: $f)" -ForegroundColor Yellow }
  }
  foreach ($d in 'lib', 'py', 'web') { Copy-Item (Join-Path $root $d) (Join-Path $pkg $d) -Recurse -Force }
  Remove-Item (Join-Path $pkg 'web\music') -Recurse -Force -ErrorAction SilentlyContinue                      # the songs are large and are fetched separately
  Get-ChildItem (Join-Path $pkg 'py') -Recurse -Directory -Filter '__pycache__' | Remove-Item -Recurse -Force -ErrorAction SilentlyContinue
  New-Item -ItemType Directory -Force (Join-Path $pkg 'data') | Out-Null
  $dict = Join-Path $root 'data\cmudict.dict'; if (Test-Path $dict) { Copy-Item $dict (Join-Path $pkg 'data\cmudict.dict') }
  $dictLic = Join-Path $root 'data\cmudict-LICENSE.txt'; if (Test-Path $dictLic) { Copy-Item $dictLic (Join-Path $pkg 'data\cmudict-LICENSE.txt') }     # its licence travels with it
  New-Item -ItemType Directory -Force (Join-Path $pkg 'nomad\library') | Out-Null
  Set-Content (Join-Path $pkg 'nomad\library\PUT-ZIM-FILES-HERE.txt') "Offline libraries (Kiwix .zim files) go in this folder. Use Prepare > Stock up inside Moundshroud to download them." -Encoding UTF8
  # privacy scan: nothing personal may be in the package
  # the words to look for are your Windows user name plus any listed in data\private-words.txt (one per line; that file is never shared or committed)
  $pw = Join-Path $root 'data\private-words.txt'; $extra = if (Test-Path $pw) { Get-Content $pw | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') } } else { @() }
  $bad = @(); $names = @(@($env:USERNAME) + $extra) | Where-Object { $_ }
  Get-ChildItem $pkg -Recurse -File | Where-Object { $_.Extension -match '^\.(js|cs|ps1|bat|html|css|json|txt|md|py)$' -and $_.Length -lt 3MB } | ForEach-Object {
    $t = [IO.File]::ReadAllText($_.FullName)
    # the one allowed exception (your choice, Nov 2026): update.json names the public download repo, so the GitHub account name is in it.
    # It is skipped only while it holds nothing but that address (and an itch.io page)
    if ($_.FullName -eq (Join-Path $pkg 'update.json')) { try { $u = $t | ConvertFrom-Json; if (@($u.PSObject.Properties.Name | Where-Object { $_ -notin 'repo', 'itch' }).Count -eq 0 -and $u.repo -match '^[A-Za-z0-9-]+/[A-Za-z0-9._-]+$') { return } } catch { } }
    foreach ($n in $names) { if ($t.IndexOf($n, [StringComparison]::OrdinalIgnoreCase) -ge 0) { $bad += "$($_.FullName.Substring($pkg.Length + 1))  contains '$n'" } } }
  $bad | Select-Object -First 10 | ForEach-Object { Write-Host "  PRIVACY: $_" -ForegroundColor Yellow }
  if ($bad.Count) { throw "The package mentions personal details in $($bad.Count) file(s); fix those before shipping." }
  # split: part 2 = the bulky reference data
  $all = Get-ChildItem $pkg -Recurse -File; $isData = { param($f) $r = $f.FullName.Substring($pkg.Length + 1).Replace('\', '/'); $r -like 'web/data/*' -or $r -eq 'data/cmudict.dict' }
  $p2 = $all | Where-Object { & $isData $_ }; $p1 = $all | Where-Object { -not (& $isData $_) }
  $z1 = Join-Path $out "Moundshroud-$ver-part1-program.zip"; $z2 = Join-Path $out "Moundshroud-$ver-part2-data.zip"; Zip $z1 $p1; Zip $z2 $p2
  $lim = 10MB * 0.95; $sizes = @($z1, $z2) | ForEach-Object { (Get-Item $_).Length }
  $sums = @($z1, $z2) | ForEach-Object { (Get-FileHash $_ -Algorithm SHA256).Hash.ToLower() + '  ' + (Split-Path $_ -Leaf) }; Set-Content (Join-Path $out 'SHA256.txt') $sums -Encoding ASCII
  Write-Host ("Part 1: {0:N2} MB ({1} files)   Part 2: {2:N2} MB ({3} files)" -f ($sizes[0] / 1MB), @($p1).Count, ($sizes[1] / 1MB), @($p2).Count)
  if ($sizes | Where-Object { $_ -gt $lim }) { Write-Host '  WARNING: a part is close to or over Discord''s free 10 MB limit.' -ForegroundColor Yellow }
  $msg = @"
Hey! Here's Moundshroud, a private assistant that runs on your own PC (AI chat that works offline, a star chart, calendar, kitchen, garden, music, chess, a Bible and lots more). Nothing is sent to the internet.

What to do (about 10 minutes plus the AI download):
1. Download BOTH zip files I attached: part1-program and part2-data.
2. Unzip BOTH into the SAME new folder, for example C:\Moundshroud (not inside OneDrive, and not from inside the zip).
3. Open that folder and double-click  Setup-Moundshroud.bat
   - If Windows says "Windows protected your PC", click More info, then Run anyway. (It says that for anything not from a big company. The setup is plain text, so you can open it and read it.)
   - Say Yes when it offers to install Node.js and Ollama (both free and standard), and pick the Small AI model unless you have a graphics card with 8 GB or more.
4. Moundshroud opens. In future use the "Moundshroud" shortcut on your desktop, or press Ctrl+Alt+A.
5. In Moundshroud: gear icon > Settings > Run a self-test. It should be all green ticks.

START-HERE.txt in the folder has the same steps. Needs Windows 10 or 11. If anything goes wrong, take a screenshot and send it to me!

(Checksums, if you want to check the downloads arrived intact, are in the SHA-256 list below.)
$($sums -join "`n")
"@
  Set-Content (Join-Path $out 'MESSAGE-FOR-DISCORD.txt') $msg -Encoding UTF8
  # latest.json: what the in-app updater reads (published by publish-update.ps1). The notes are this version's lines from RELEASE-NOTES.txt
  $notesFile = Join-Path $root 'RELEASE-NOTES.txt'; $notes = @(); if (Test-Path $notesFile) { $notes = @(Get-Content $notesFile -Encoding UTF8 | ForEach-Object { $_.Trim() } | Where-Object { $_ -and -not $_.StartsWith('#') }) }
  $latest = [ordered]@{ version = $ver; date = (Get-Date -Format 'yyyy-MM-dd'); notes = $notes; files = @(@($z1, $z2) | ForEach-Object { [ordered]@{ name = (Split-Path $_ -Leaf); size = (Get-Item $_).Length; sha256 = (Get-FileHash $_ -Algorithm SHA256).Hash.ToLower() } }) }
  [IO.File]::WriteAllText((Join-Path $out 'latest.json'), ($latest | ConvertTo-Json -Depth 5), (New-Object Text.UTF8Encoding($false)))
  if ($Verify) {
    # a folder name with spaces, an accented letter and an apostrophe: the kind of path that breaks Windows scripts
    $chk = Join-Path ([IO.Path]::GetTempPath()) ("moundshroud verify " + [char]0x00FC + "'s " + [guid]::NewGuid().ToString('N').Substring(0, 8)); New-Item -ItemType Directory $chk | Out-Null
    $dir = Join-Path $chk 'Moundshroud'; $port = 47341
    # act as the friend: unzip both parts into the same folder (the second merges over the first)
    [IO.Compression.ZipFile]::ExtractToDirectory($z1, $chk); [IO.Compression.ZipFile]::ExtractToDirectory($z2, $chk)
    # a stand-in for the kiwix download, so no network is used: the local tools folder zipped inside one subfolder
    $fakeZip = $null; $kt = Join-Path $root 'nomad\kiwix-tools'; if (Test-Path (Join-Path $kt 'kiwix-serve.exe')) { $kd = Join-Path $chk 'fakekiwix\kiwix-tools_win-x86_64-test'; New-Item -ItemType Directory $kd -Force | Out-Null; Copy-Item (Join-Path $kt '*') $kd -Recurse; $fakeZip = Join-Path $chk 'kiwix-fake.zip'; [IO.Compression.ZipFile]::CreateFromDirectory((Join-Path $chk 'fakekiwix'), $fakeZip) }
    $sc = Join-Path $chk 'shortcuts'
    $args2 = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $dir 'setup.ps1'), '-Auto', '-NoLaunch', '-SkipInstalls', '-SkipModels', '-ShortcutDir', $sc); if ($fakeZip) { $args2 += @('-KiwixZip', $fakeZip) }
    $r = & powershell.exe @args2 2>&1 | Out-String; Write-Host ('Setup on the unpacked copy: ' + (($r -split "`n" | Where-Object { $_ -match '=== |Built|Installed|Already|shortcut' } | ForEach-Object { $_.Trim() }) -join ' | '))
    $facts = [ordered]@{ 'hotkey helper built' = Test-Path (Join-Path $dir 'assistant-listener.exe'); 'kiwix tool installed' = (-not $fakeZip) -or (Test-Path (Join-Path $dir 'nomad\kiwix-tools\kiwix-serve.exe')); 'shortcut made' = Test-Path (Join-Path $sc 'Moundshroud.lnk'); 'Bibles present (part 2)' = Test-Path (Join-Path $dir 'web\data\bible-web.json'); 'setup reports all set' = ($r -match '=== All set!') }
    $facts.GetEnumerator() | ForEach-Object { Write-Host ('  {0,-26} {1}' -f $_.Key, $(if ($_.Value) { 'yes' } else { 'NO' })) -ForegroundColor $(if ($_.Value) { 'Green' } else { 'Red' }) }
    $lib = Join-Path $chk 'emptylib'; New-Item -ItemType Directory $lib | Out-Null
    $env:MOUNDSHROUD_PORT = "$port"; $env:MOUNDSHROUD_KIWIX_PORT = '47342'; $env:MOUNDSHROUD_LIBDIR = $lib
    $p = Start-Process node -ArgumentList 'server.js' -WorkingDirectory $dir -WindowStyle Hidden -PassThru; Start-Sleep -Seconds 5
    try {
      $ok = @(); foreach ($u in '/', '/web/js/main.js', '/web/data/sky.json', '/web/data/recipes.json', '/api/storage', '/api/chats', '/api/status', '/web/js/vault.js', '/web/js/photos.js', '/web/js/mail.js', '/web/js/memory.js', '/api/vault', '/api/photos/stats', '/api/mail/accounts', '/api/kv?name=memory', '/api/tor') { try { $rr = Invoke-WebRequest "http://127.0.0.1:$port$u" -UseBasicParsing -TimeoutSec 8; $ok += "$u $($rr.StatusCode)" } catch { $ok += "$u FAILED" } }
      Write-Host ('Unpacked copy answers: ' + ($ok -join ', '))
      # a fresh copy must start empty: no vault, no mail accounts, no memories
      $fresh = (Invoke-RestMethod "http://127.0.0.1:$port/api/vault").exists -eq $false -and @((Invoke-RestMethod "http://127.0.0.1:$port/api/mail/accounts").accounts).Count -eq 0
      Write-Host ('  starts with nothing personal   ' + $(if ($fresh) { 'yes' } else { 'NO' })) -ForegroundColor $(if ($fresh) { 'Green' } else { 'Red' }); if (-not $fresh) { $ok += 'fresh FAILED' }
      if ($ok -match 'FAILED' -or ($facts.Values -contains $false)) { throw 'The unpacked release did not set up and start cleanly.' }
    } finally { Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue; Remove-Item Env:MOUNDSHROUD_PORT, Env:MOUNDSHROUD_KIWIX_PORT, Env:MOUNDSHROUD_LIBDIR -ErrorAction SilentlyContinue; Start-Sleep -Milliseconds 500; Remove-Item $chk -Recurse -Force -ErrorAction SilentlyContinue }
  }
} finally { Remove-Item $stage -Recurse -Force -ErrorAction SilentlyContinue }
