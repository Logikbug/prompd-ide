# PowerShell script to create proper multi-size ICO file for prompd-ide
# Requires ImageMagick to be installed

Write-Host "Creating proper multi-size ICO file for prompd-ide..." -ForegroundColor Cyan

# Define the sizes needed for Windows
$sizes = @(16, 20, 24, 32, 40, 48, 64, 96, 128, 256)

# Source PNG file (should be at least 256x256)
$sourcePng = "prompd-icon.png"
$outputIco = "prompd-ide-proper.ico"

# Check if source file exists
if (-not (Test-Path $sourcePng)) {
    Write-Host "Error: Source file $sourcePng not found!" -ForegroundColor Red
    Write-Host "Please ensure you have a high-quality PNG file (at least 256x256) named prompd-icon.png" -ForegroundColor Yellow
    exit 1
}

# Create temporary directory for individual sizes
$tempDir = "temp-icons"
if (-not (Test-Path $tempDir)) {
    New-Item -ItemType Directory -Path $tempDir | Out-Null
}

Write-Host "Generating individual icon sizes..." -ForegroundColor Green

# Generate each size
foreach ($size in $sizes) {
    $outputFile = "$tempDir\icon-${size}x${size}.png"
    
    # Use ImageMagick to resize
    # For sizes 48 and below, apply sharpening to prevent blurriness
    if ($size -le 48) {
        magick convert $sourcePng -resize ${size}x${size} -sharpen 0x1.0 $outputFile
    } else {
        magick convert $sourcePng -resize ${size}x${size} $outputFile
    }
    
    Write-Host "  Created ${size}x${size} icon" -ForegroundColor Gray
}

Write-Host "Combining into single ICO file..." -ForegroundColor Green

# Combine all sizes into a single ICO file
$iconFiles = $sizes | ForEach-Object { "$tempDir\icon-${_}x${_}.png" }
magick convert $iconFiles $outputIco

# Clean up temporary files
Remove-Item -Path $tempDir -Recurse -Force

Write-Host "Successfully created $outputIco with all required sizes!" -ForegroundColor Green
Write-Host ""
Write-Host "Icon sizes included:" -ForegroundColor Cyan
$sizes | ForEach-Object { Write-Host "  - ${_}x${_}" -ForegroundColor Gray }

Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Use rcedit to update the executable: rcedit prompd-ide.exe --set-icon $outputIco"
Write-Host "2. Replace resources/win32/code.ico with the new icon file"
Write-Host "3. Update any build scripts to use the proper icon"