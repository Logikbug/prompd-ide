# PowerShell script to combine individual ICO files into a single multi-size ICO
# This creates the optimal ICO file to prevent blurry taskbar icons

param(
    [string]$IconDir = "..\appicons\use",
    [string]$OutputFile = "prompd-ide-combined.ico"
)

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Combining Individual ICOs into Multi-Size" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Check if directory exists
if (-not (Test-Path $IconDir)) {
    Write-Host "ERROR: Icon directory not found: $IconDir" -ForegroundColor Red
    exit 1
}

# Define the sizes we need (in order of importance for Windows)
$requiredSizes = @(
    @{Size=16; File="prompd-icon-16x16.ico"},
    @{Size=24; File="prompd-icon-24x24.ico"},
    @{Size=32; File="prompd-icon-32x32.ico"},
    @{Size=48; File="prompd-icon-48x48.ico"},
    @{Size=64; File="prompd-icon-64x64.ico"},
    @{Size=128; File="prompd-icon-128x128.ico"},
    @{Size=256; File="prompd-icon-256x256.ico"}
)

# Check which files exist
$existingFiles = @()
Write-Host "Checking for icon files..." -ForegroundColor Yellow
foreach ($icon in $requiredSizes) {
    $path = Join-Path $IconDir $icon.File
    if (Test-Path $path) {
        $existingFiles += $path
        Write-Host "  [OK] Found $($icon.Size)x$($icon.Size) icon" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $($icon.Size)x$($icon.Size) icon not found" -ForegroundColor Red
    }
}

if ($existingFiles.Count -eq 0) {
    Write-Host "ERROR: No icon files found!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "Found $($existingFiles.Count) icon files" -ForegroundColor Green
Write-Host ""

# Method 1: Try using ImageMagick
$magickPath = Get-Command magick -ErrorAction SilentlyContinue
if ($magickPath) {
    Write-Host "Using ImageMagick to combine icons..." -ForegroundColor Cyan
    
    $fileList = $existingFiles -join " "
    $cmd = "magick convert $fileList `"$OutputFile`""
    
    Invoke-Expression $cmd
    
    if (Test-Path $OutputFile) {
        Write-Host "SUCCESS: Created $OutputFile" -ForegroundColor Green
    } else {
        Write-Host "ERROR: Failed to create combined ICO" -ForegroundColor Red
    }
} else {
    Write-Host "ImageMagick not found. Trying alternative method..." -ForegroundColor Yellow
    
    # Method 2: Try using .NET if available (Windows 10+)
    try {
        Add-Type -AssemblyName System.Drawing
        
        # This is a simplified approach - for production use a proper ICO library
        Write-Host "Using .NET System.Drawing..." -ForegroundColor Cyan
        
        # For now, just copy the main icon file if it exists
        $mainIcon = Join-Path $IconDir "prompd-icon.ico"
        if (Test-Path $mainIcon) {
            Copy-Item $mainIcon $OutputFile -Force
            Write-Host "Copied main icon file as $OutputFile" -ForegroundColor Green
        } else {
            # Use the largest available icon
            $largestIcon = $existingFiles | Select-Object -Last 1
            Copy-Item $largestIcon $OutputFile -Force
            Write-Host "WARNING: Using single-size icon. Install ImageMagick for proper multi-size ICO" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "ERROR: Could not create combined ICO file" -ForegroundColor Red
        Write-Host "Please install ImageMagick: https://imagemagick.org/script/download.php#windows" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Cyan
Write-Host "1. Run: rcedit prompd-ide.exe --set-icon $OutputFile" -ForegroundColor White
Write-Host "2. Copy $OutputFile to resources\win32\code.ico" -ForegroundColor White
Write-Host "3. Clear Windows icon cache and restart Explorer" -ForegroundColor White
Write-Host ""

# Display file info
if (Test-Path $OutputFile) {
    $fileInfo = Get-Item $OutputFile
    Write-Host "Output File Info:" -ForegroundColor Cyan
    Write-Host "  Path: $($fileInfo.FullName)" -ForegroundColor Gray
    Write-Host "  Size: $([math]::Round($fileInfo.Length/1KB, 2)) KB" -ForegroundColor Gray
}