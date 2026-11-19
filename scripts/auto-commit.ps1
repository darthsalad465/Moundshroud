# Auto-commit the working tree. Safe to run often: it commits only when there are changes and no merge,
# rebase or cherry-pick is in progress, and it never pushes or switches branches. Wired to the Stop hook in .dev/settings.json
# (every session's turn end) and runnable by hand. Nothing is lost: each run is one snapshot commit.
$ErrorActionPreference = 'SilentlyContinue'
$repo = Split-Path -Parent $PSScriptRoot
Set-Location $repo

# never commit in the middle of a git operation
$g = Join-Path $repo '.git'
foreach ($f in 'MERGE_HEAD','REBASE_HEAD','CHERRY_PICK_HEAD','rebase-merge','rebase-apply') {
  if (Test-Path (Join-Path $g $f)) { exit 0 }
}

# turned off from Moundshroud (Settings > Backup & data): the flag file is written by the app
if (Test-Path (Join-Path $repo 'data\autocommit.off')) { exit 0 }

# nothing changed -> nothing to do
$dirty = git status --porcelain
if ([string]::IsNullOrWhiteSpace($dirty)) { exit 0 }

$stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss'
git add -A 2>$null
# --no-verify so a slow pre-commit hook cannot stall a turn; this is a snapshot, not a reviewed commit
git commit --no-verify -q -m "auto-commit: working tree snapshot $stamp" 2>$null
exit 0
