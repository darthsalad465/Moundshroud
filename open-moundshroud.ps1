# Opens Moundshroud (used by the desktop shortcut): starts the hotkey listener and the server if they are not running, then shows the window.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$url = 'http://127.0.0.1:47231'
function Up { try { (Invoke-WebRequest "$url/api/status" -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200 } catch { $false } }

if (-not (Get-Process assistant-listener -ErrorAction SilentlyContinue)) { Start-Process explorer.exe "`"$root\assistant-listener.exe`""; Start-Sleep -Milliseconds 600 }

if (-not (Up)) {
  $node = @('C:\Program Files\nodejs\node.exe', 'C:\Program Files (x86)\nodejs\node.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1
  if (-not $node) { $node = 'node' }
  Start-Process $node -ArgumentList "`"$root\server.js`"" -WorkingDirectory $root -WindowStyle Hidden
  for ($i = 0; $i -lt 40 -and -not (Up); $i++) { Start-Sleep -Milliseconds 250 }
}

Add-Type -Namespace W -Name U -MemberDefinition '[DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h,int c); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern bool IsIconic(IntPtr h);'
$win = Get-Process msedge -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle -match 'Offline Assistant|Moundshroud' } | Select-Object -First 1
if ($win) {
  if ([W.U]::IsIconic($win.MainWindowHandle)) { [W.U]::ShowWindow($win.MainWindowHandle, 9) | Out-Null }
  [W.U]::SetForegroundWindow($win.MainWindowHandle) | Out-Null
} else {
  $edge = @('C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe', 'C:\Program Files\Microsoft\Edge\Application\msedge.exe') | Where-Object { Test-Path $_ } | Select-Object -First 1
  if ($edge) {
    Add-Type -AssemblyName System.Windows.Forms
    $wa = [System.Windows.Forms.Screen]::PrimaryScreen.WorkingArea
    $w = [Math]::Min(720, $wa.Width - 40); $h = [Math]::Min(800, $wa.Height - 40); $x = [Math]::Max(0, $wa.Right - $w - 24); $y = [Math]::Max(0, $wa.Bottom - $h - 24)
    Start-Process $edge -ArgumentList "--app=$url", "--user-data-dir=`"$root\edge-profile`"", "--window-size=$w,$h", "--window-position=$x,$y", '--no-first-run', '--no-default-browser-check', '--disable-background-mode', '--disable-background-networking', '--disable-component-update', '--disable-domain-reliability', '--no-pings', '--disable-breakpad', '--no-report-upload', '--metrics-recording-only', '--disable-default-apps', '--disable-features=Translate,MediaRouter,DialMediaRouteProvider,OptimizationHints,AutofillServerCommunication,msEdgeShoppingUI,msUndersideButton,msShowCopilotButtonInToolbar,msEdgeEnhanceImages,msSpeechRecognitionOnline'
  }
}
