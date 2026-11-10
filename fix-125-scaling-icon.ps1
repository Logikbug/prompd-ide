# Fix icon for 125% display scaling (40x40 size needed)

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Fixing Icon for 125% Display Scaling" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "Your display is at 125% scaling" -ForegroundColor Yellow
Write-Host "Windows taskbar needs a 40x40 pixel icon" -ForegroundColor Yellow
Write-Host ""

# Check if we have the source files
$iconDir = "..\appicons\use"

# Create 40x40 if we have the tools
$magick = Get-Command magick -ErrorAction SilentlyContinue

if ($magick) {
    Write-Host "Creating optimized icon with 40x40 size..." -ForegroundColor Cyan
    
    # Create 40x40 from 48x48 source
    if (Test-Path "$iconDir\prompd-icon-48x48.png") {
        Write-Host "Generating 40x40 icon..." -ForegroundColor Yellow
        & magick convert "$iconDir\prompd-icon-48x48.png" -resize 40x40 -sharpen 0x1.0 "prompd-icon-40x40.png"
    }
    
    # Create 20x20 for 125% small icons
    if (Test-Path "$iconDir\prompd-icon-24x24.png") {
        Write-Host "Generating 20x20 icon..." -ForegroundColor Yellow
        & magick convert "$iconDir\prompd-icon-24x24.png" -resize 20x20 -sharpen 0x1.0 "prompd-icon-20x20.png"
    }
    
    # Combine all sizes including the new 40x40
    Write-Host ""
    Write-Host "Creating new combined ICO with 40x40 size..." -ForegroundColor Cyan
    
    $iconFiles = @()
    
    # Add files in specific order for Windows
    if (Test-Path "$iconDir\prompd-icon-16x16.ico") { $iconFiles += "$iconDir\prompd-icon-16x16.ico" }
    if (Test-Path "prompd-icon-20x20.png") { $iconFiles += "prompd-icon-20x20.png" }
    if (Test-Path "$iconDir\prompd-icon-24x24.ico") { $iconFiles += "$iconDir\prompd-icon-24x24.ico" }
    if (Test-Path "$iconDir\prompd-icon-32x32.ico") { $iconFiles += "$iconDir\prompd-icon-32x32.ico" }
    if (Test-Path "prompd-icon-40x40.png") { $iconFiles += "prompd-icon-40x40.png" }
    if (Test-Path "$iconDir\prompd-icon-48x48.ico") { $iconFiles += "$iconDir\prompd-icon-48x48.ico" }
    if (Test-Path "$iconDir\prompd-icon-64x64.ico") { $iconFiles += "$iconDir\prompd-icon-64x64.ico" }
    if (Test-Path "$iconDir\prompd-icon-128x128.ico") { $iconFiles += "$iconDir\prompd-icon-128x128.ico" }
    if (Test-Path "$iconDir\prompd-icon-256x256.ico") { $iconFiles += "$iconDir\prompd-icon-256x256.ico" }
    
    $fileList = $iconFiles -join " "
    & magick convert $iconFiles "prompd-ide-125-fixed.ico"
    
    Write-Host "[SUCCESS] Created prompd-ide-125-fixed.ico with 40x40 size!" -ForegroundColor Green
    
    # Update all locations
    Write-Host ""
    Write-Host "Updating icon files..." -ForegroundColor Yellow
    Copy-Item "prompd-ide-125-fixed.ico" "prompd-ide.ico" -Force
    Copy-Item "prompd-ide-125-fixed.ico" "prompd-icon.ico" -Force
    Copy-Item "prompd-ide-125-fixed.ico" "resources\win32\code.ico" -Force
    
    Write-Host "[OK] Icon files updated" -ForegroundColor Green
    
} else {
    Write-Host "ImageMagick not found!" -ForegroundColor Red
    Write-Host ""
    Write-Host "To fix the blurry icon at 125% scaling, you need:" -ForegroundColor Yellow
    Write-Host "1. Install ImageMagick from: https://imagemagick.org/script/download.php#windows" -ForegroundColor White
    Write-Host "2. Run this script again" -ForegroundColor White
    Write-Host ""
    Write-Host "OR manually create a 40x40 pixel icon and add it to your ICO file" -ForegroundColor White
}

Write-Host ""
Write-Host "Alternative Quick Fix:" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "1. Change Windows display scaling to 100%" -ForegroundColor White
Write-Host "   Settings > System > Display > Scale = 100%" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Or change to 150% (uses 48x48 which you have)" -ForegroundColor White
Write-Host "   Settings > System > Display > Scale = 150%" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Clear icon cache after any changes:" -ForegroundColor White
Write-Host "   Run: clear-all-icon-caches.bat" -ForegroundColor Gray