# Makes 'mcode' work in every terminal on this PC.
#
# It adds this folder's bin\ to YOUR user PATH (never the system one) and then checks that the launcher really
# starts the agent. Running it twice is harmless: the folder is only ever added once.
#
#   .\install-mcode.ps1            set it up
#   .\install-mcode.ps1 -Remove    take it back out again
#
# After this, open a new terminal (an already-open one keeps the old PATH) and type:   mcode
param([switch]$Remove)
$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$bin = Join-Path $root 'bin'
$main = Join-Path $root 'lib\moundshroud-code.js'
if (-not (Test-Path $main)) { throw "Cannot find $main - run this from the Moundshroud folder." }

function Get-UserPath {
  $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
  if (-not $key) { return @{ Text = ''; Kind = 'String'; Key = $null } }
  $text = [string]$key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
  $kind = try { $key.GetValueKind('Path') } catch { [Microsoft.Win32.RegistryValueKind]::ExpandString }
  @{ Text = $text.TrimEnd(';'); Kind = $kind; Key = $key }
}
function Set-UserPath($text, $kind) {
  $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
  if (-not $key) { $key = [Microsoft.Win32.Registry]::CurrentUser.CreateSubKey('Environment') }
  $key.SetValue('Path', $text, $kind)
  $key.Close()
  # tell Windows the environment changed, so newly opened terminals pick it up without a sign-out
  try {
    Add-Type -Namespace Win32 -Name Env -MemberDefinition '[DllImport("user32.dll", CharSet=CharSet.Auto, SetLastError=true)] public static extern IntPtr SendMessageTimeout(IntPtr hWnd, uint Msg, UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out UIntPtr lpdwResult);'
    $out = [UIntPtr]::Zero
    [Win32.Env]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, 'Environment', 2, 5000, [ref]$out) | Out-Null
  } catch { }
}

$cur = Get-UserPath
$parts = @($cur.Text -split ';' | Where-Object { $_ -and $_.Trim() })
$same = { param($a, $b) ($a.TrimEnd('\') -ieq $b.TrimEnd('\')) }

if ($Remove) {
  $keep = @($parts | Where-Object { -not (& $same $_ $bin) })
  if ($keep.Count -eq $parts.Count) { Write-Host "'mcode' was not set up in this folder's bin, nothing to remove." -ForegroundColor Yellow }
  else {
    Set-UserPath ($keep -join ';') $cur.Kind
    Write-Host "Removed $bin from your PATH. Open a new terminal; 'mcode' will stop working there." -ForegroundColor Green
  }
  return
}

if ($parts | Where-Object { & $same $_ $bin }) {
  Write-Host "$bin is already on your PATH." -ForegroundColor Green
} else {
  $next = (@($parts) + $bin) -join ';'
  Set-UserPath $next $cur.Kind
  Write-Host "Added $bin to your PATH." -ForegroundColor Green
  Write-Host 'Open a new terminal window (or a new tab), then type:  mcode'
}

# prove the launcher hands over to the agent: 'mcode --help' prints the usage and exits 0
$cmd = Join-Path $bin 'mcode.cmd'
if (Test-Path $cmd) {
  $env:Path = "$env:Path;$bin"
  $out = & cmd.exe /c "`"$cmd`" --help" 2>&1 | Out-String
  if ($LASTEXITCODE -ne 0) { throw "The launcher ran but exited with code $LASTEXITCODE." }
  Write-Host ("Launcher works: " + (($out -split "`n" | Where-Object { $_ -match 'Usage|Moundshroud Code' } | Select-Object -First 2 | ForEach-Object { $_.Trim() }) -join ' | ')) -ForegroundColor Green
} else { throw "bin\mcode.cmd is missing." }
