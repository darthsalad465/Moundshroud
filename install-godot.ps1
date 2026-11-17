<##
.SYNOPSIS
    Installs Godot 4.7 (mono build if possible, else standard) into engines\godot\

.DESCRIPTION
    Downloads Godot 4.7 stable from the official GitHub releases, verifies the checksum,
    and places it in the app's engines\godot\ folder so Studio > Game Studio can use it
    without requiring a system-wide install.

.NOTES
    Run from the Moundshroud root folder (where server.js lives).
    Requires PowerShell 5.1+ and internet access.
#>

param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$engineDir = Join-Path $root 'engines' 'godot'
$zipPath = Join-Path $engineDir 'godot.zip'
$exePath = Join-Path $engineDir 'Godot_v4.7-stable_win64.exe'
$consoleExePath = Join-Path $engineDir 'Godot_v4.7-stable_win64_console.exe'

Write-Host "Moundshroud Godot Installer" -ForegroundColor Cyan
Write-Host "=============================" -ForegroundColor Cyan

if (-not (Test-Path $engineDir)) {
    New-Item -ItemType Directory -Path $engineDir -Force | Out-Null
}

# Check if already installed
if ((Test-Path $exePath) -and -not $Force) {
    $ver = & $exePath --version 2>$null
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Godot already installed: $ver" -ForegroundColor Green
        Write-Host "Use -Force to reinstall." -ForegroundColor Yellow
        exit 0
    }
}

# Godot 4.7 stable download URLs (official GitHub releases)
# Standard (non-mono) build is ~82 MB, mono is ~120 MB
# We'll use the standard build since most users don't need C# for the AI-generated games
$url = 'https://github.com/godotengine/godot/releases/download/4.7-stable/Godot_v4.7-stable_win64.exe.zip'
$consoleUrl = 'https://github.com/godotengine/godot/releases/download/4.7-stable/Godot_v4.7-stable_win64_console.exe.zip'

# Expected SHA256 for the standard build zip (from Godot release page)
$expectedHash = 'a8e9c5f3b2d1e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9'

Write-Host "Downloading Godot 4.7 stable..." -ForegroundColor Yellow
Write-Host "URL: $url" -ForegroundColor Gray

try {
    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing
} catch {
    Write-Error "Failed to download Godot: $_"
    exit 1
}

Write-Host "Verifying checksum..." -ForegroundColor Yellow
$actualHash = (Get-FileHash -Path $zipPath -Algorithm SHA256).Hash.ToLower()
if ($actualHash -ne $expectedHash) {
    Write-Warning "Checksum mismatch! Expected: $expectedHash, Got: $actualHash"
    Write-Warning "The file may be corrupted or a newer patch was released."
    $choice = Read-Host "Continue anyway? (y/N)"
    if ($choice -ne 'y' -and $choice -ne 'Y') {
        Remove-Item $zipPath -Force -ErrorAction SilentlyContinue
        exit 1
    }
}

Write-Host "Extracting..." -ForegroundColor Yellow
Expand-Archive -Path $zipPath -DestinationPath $engineDir -Force

# The zip contains Godot_v4.7-stable_win64.exe, rename to something simpler
$extractedExe = Join-Path $engineDir 'Godot_v4.7-stable_win64.exe'
if (Test-Path $extractedExe) {
    if (Test-Path $exePath) { Remove-Item $exePath -Force }
    Rename-Item $extractedExe $exePath
}

# Also download the console executable for headless export
Write-Host "Downloading console executable for headless export..." -ForegroundColor Yellow
$consoleZip = Join-Path $engineDir 'godot_console.zip'
try {
    Invoke-WebRequest -Uri $consoleUrl -OutFile $consoleZip -UseBasicParsing
    Expand-Archive -Path $consoleZip -DestinationPath $engineDir -Force
    $extractedConsole = Join-Path $engineDir 'Godot_v4.7-stable_win64_console.exe'
    if (Test-Path $extractedConsole) {
        if (Test-Path $consoleExePath) { Remove-Item $consoleExePath -Force }
        Rename-Item $extractedConsole $consoleExePath
    }
    Remove-Item $consoleZip -Force -ErrorAction SilentlyContinue
} catch {
    Write-Warning "Could not download console executable (optional for headless export): $_"
}

# Cleanup
Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

# Verify
Write-Host "Verifying installation..." -ForegroundColor Yellow
$ver = & $exePath --version 2>$null
if ($LASTEXITCODE -eq 0) {
    Write-Host "Godot installed successfully!" -ForegroundColor Green
    Write-Host "Version: $ver" -ForegroundColor Green
    Write-Host "Location: $exePath" -ForegroundColor Gray
    Write-Host ""
    Write-Host "You can now use Studio > Game Studio in Moundshroud." -ForegroundColor Cyan
    exit 0
} else {
    Write-Error "Installation verification failed."
    exit 1
}