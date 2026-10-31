# Installs a Moundshroud update that lib\update.js has already downloaded, checked and unpacked into -Stage.
# Started by the server, which then stops itself. This script:
#   1. waits for the old server to finish closing
#   2. copies aside every file it is about to replace, into data\update-backup\<old version>
#   3. copies the new files in. The data folder is never overwritten: it holds your notes, chats, passwords and settings
#      (a new file the update brings into data\ is added only if it is not there yet)
#   4. starts the new version and waits for it to answer
#   5. if it does not, puts every replaced file back and starts the old version again
# What happened is written to data\update-result.json (the app shows it) and data\update-log.txt.
param([Parameter(Mandatory)][string]$Root, [Parameter(Mandatory)][string]$Stage, [string]$Work = '', [int]$ServerPid = 0, [int]$Port = 47231, [string]$OldVersion = '', [string]$NewVersion = '')
$ErrorActionPreference = 'Stop'; $ProgressPreference = 'SilentlyContinue'
$data = Join-Path $Root 'data'; New-Item -ItemType Directory -Force $data | Out-Null
$log = Join-Path $data 'update-log.txt'
function Log($m) { Add-Content $log ((Get-Date -Format 'yyyy-MM-dd HH:mm:ss') + '  ' + $m) -Encoding UTF8 }
function Result($ok, $msg) { @{ ok = $ok; from = $OldVersion; to = $NewVersion; at = [DateTimeOffset]::Now.ToUnixTimeMilliseconds(); message = $msg } | ConvertTo-Json | Set-Content (Join-Path $data 'update-result.json') -Encoding UTF8 }
function Up($want) { try { $r = Invoke-RestMethod "http://127.0.0.1:$Port/api/about" -TimeoutSec 2; return (-not $want) -or ($r.version -eq $want) } catch { return $false } }
function StartServer {
  $node = @('C:\Program Files\nodejs\node.exe', 'C:\Program Files (x86)\nodejs\node.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $node) { $node = (Get-Command node -ErrorAction SilentlyContinue).Source }
  if (-not $node) { throw 'Node.js was not found.' }
  $env:MOUNDSHROUD_PORT = "$Port"
  Start-Process $node -ArgumentList "`"$(Join-Path $Root 'server.js')`"" -WorkingDirectory $Root -WindowStyle Hidden
}
function StopServerOnPort {
  # the server that answers on our port (the new one, if it half-started): found by its port, never by name
  try { Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction Stop | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue } } catch { }
}

Log "Updating $OldVersion -> $NewVersion"
# 1. the old server stops itself just after starting this script
if ($ServerPid) { for ($i = 0; $i -lt 60 -and (Get-Process -Id $ServerPid -ErrorAction SilentlyContinue); $i++) { Start-Sleep -Milliseconds 500 }; Stop-Process -Id $ServerPid -Force -ErrorAction SilentlyContinue }
Start-Sleep -Milliseconds 500

$stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
$backup = Join-Path $data ("update-backup\" + ($OldVersion -replace '[^0-9A-Za-z._-]', '') + "-$stamp")
$replaced = New-Object System.Collections.Generic.List[string]; $added = New-Object System.Collections.Generic.List[string]
$stageFull = (Resolve-Path $Stage).Path.TrimEnd('\')
try {
  # 2 and 3. copy aside, then copy in
  foreach ($f in Get-ChildItem $stageFull -Recurse -File) {
    $rel = $f.FullName.Substring($stageFull.Length + 1)
    $dest = Join-Path $Root $rel
    if ($rel -like 'data\*') { if (Test-Path $dest) { continue } }               # never replace anything in data\
    if ($rel -like 'edge-profile\*' -or $rel -like '_snapshots\*') { continue }
    if (Test-Path $dest) {
      $b = Join-Path $backup $rel; New-Item -ItemType Directory -Force (Split-Path $b) | Out-Null
      Copy-Item -LiteralPath $dest $b -Force; $replaced.Add($rel)
    } else { $added.Add($rel) }
    New-Item -ItemType Directory -Force (Split-Path $dest) | Out-Null
    Copy-Item -LiteralPath $f.FullName $dest -Force
  }
  Log ("Copied {0} replaced and {1} new files; the replaced ones are kept in {2}" -f $replaced.Count, $added.Count, $backup)
  # 4. start the new version and wait for it to answer with its new version number
  StartServer
  # by the clock: on Windows each refused connection can itself take two seconds
  $ok = $false; $until = (Get-Date).AddSeconds(45); while ((Get-Date) -lt $until) { Start-Sleep -Milliseconds 500; if (Up $NewVersion) { $ok = $true; break } }
  if (-not $ok) { throw "the new version did not start" }
  Log "Version $NewVersion is running."
  Result $true "Updated to $NewVersion."
} catch {
  # 5. put the old version back exactly as it was
  $why = $_.Exception.Message; Log "Problem: $why. Putting $OldVersion back."
  StopServerOnPort; Start-Sleep -Milliseconds 800
  foreach ($rel in $replaced) { try { Copy-Item -LiteralPath (Join-Path $backup $rel) (Join-Path $Root $rel) -Force } catch { Log "Could not restore $rel" } }
  foreach ($rel in $added) { try { Remove-Item -LiteralPath (Join-Path $Root $rel) -Force -ErrorAction SilentlyContinue } catch { } }
  try { StartServer; $until = (Get-Date).AddSeconds(45); while ((Get-Date) -lt $until -and -not (Up $OldVersion)) { Start-Sleep -Milliseconds 500 } } catch { Log "Could not restart: $($_.Exception.Message)" }
  Log ($(if (Up $OldVersion) { "Version $OldVersion is running again." } else { "Version $OldVersion did not answer yet; opening Moundshroud from its shortcut will start it." }))
  Result $false "The update to $NewVersion did not work ($why), so version $OldVersion was put back. Nothing of yours was changed."
}
# keep the three most recent sets of replaced files; tidy the download
try { Get-ChildItem (Join-Path $data 'update-backup') -Directory | Sort-Object Name -Descending | Select-Object -Skip 3 | Remove-Item -Recurse -Force } catch { }
if ($Work -and (Test-Path $Work) -and $Work -like "$([IO.Path]::GetTempPath())*") { Start-Sleep -Seconds 1; Remove-Item $Work -Recurse -Force -ErrorAction SilentlyContinue }
