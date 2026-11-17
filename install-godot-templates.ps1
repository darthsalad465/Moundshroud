<##
.SYNOPSIS
    Installs Godot 4.7 export templates for Web export

.DESCRIPTION
    Downloads the export templates matching the installed Godot engine version
    and places them in %APPDATA%\Godot\export_templates\<version>\ so that
    Studio > Game Studio can export games for the web (Arcade).

.NOTES
    Run from the Moundshroud root folder.
    Requires Godot engine to be installed first (run install-godot.ps1).
    Download is ~1 GB.
#>

param(
    [switch]$Force
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

$root = Split-Path -Parent $MyInvocation.MyCommand.Definition
$engineDir = Join-Path $root 'engines' 'godot'
$exePath = Join-Path $engineDir 'Godot_v4.7-stable_win64.exe'

Write-Host "Moundshroud Godot Export Templates Installer" -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# Find the engine
if (-not (Test-Path $exePath)) {
    Write-Error "Godot engine not found at $exePath"
    Write-Host "Run install-godot.ps1 first." -ForegroundColor Yellow
    exit 1
}

$ver = & $exePath --version 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Error "Could not get Godot version."
    exit 1
}

Write-Host "Found Godot: $ver" -ForegroundColor Green

# Parse version (e.g., "4.7.stable" from "Godot Engine v4.7.stable.official.xxxx")
$verMatch = [regex]::Match($ver, 'v?(\d+\.\d+(\.\w+)?)')
if (-not $verMatch.Success) {
    Write-Error "Could not parse version from: $ver"
    exit 1
}
$version = $verMatch.Groups[1].Value
Write-Host "Version string: $version" -ForegroundColor Gray

$templateDir = Join-Path $env:APPDATA 'Godot' 'export_templates' $version
if ((Test-Path $templateDir) -and -not $Force) {
    Write-Host "Export templates already installed at:" -ForegroundColor Green
    Write-Host "$templateDir" -ForegroundColor Gray
    Write-Host "Use -Force to reinstall." -ForegroundColor Yellow
    exit 0
}

# Download URL for export templates
$zipUrl = "https://github.com/godotengine/godot/releases/download/$version-stable/Godot_v${version}-stable_export_templates.tpz"
$zipPath = Join-Path $env:TEMP "Godot_templates_$version.tpz"

Write-Host "Downloading export templates (~1 GB)..." -ForegroundColor Yellow
Write-Host "URL: $zipUrl" -ForegroundColor Gray

try {
    Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
} catch {
    Write-Error "Failed to download export templates: $_"
    Write-Host "Make sure the version '$version' has export templates on GitHub." -ForegroundColor Yellow
    exit 1
}

Write-Host "Extracting to $templateDir ..." -ForegroundColor Yellow
if (-not (Test-Path $templateDir)) {
    New-Item -ItemType Directory -Path $templateDir -Force | Out-Null
}

Expand-Archive -Path $zipPath -DestinationPath $templateDir -Force

# Cleanup
Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

# Verify
$webTemplate = Join-Path $templateDir 'web' 'web_release.zip'
if (Test-Path $webTemplate) {
    Write-Host "Export templates installed successfully!" -ForegroundColor Green
    Write-Host "Location: $templateDir" -ForegroundColor Gray
    Write-Host ""
    Write-Host "You can now use 'Send to Arcade' in Studio > Game Studio." -ForegroundColor Cyan
    exit 0
} else {
    Write-Error "Installation verification failed. Expected $webTemplate"
    exit 1
}