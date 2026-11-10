# Script to verify icon structure and identify issues

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Icon Structure Verification" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Function to get icon info using certutil (built into Windows)
function Get-IconInfo {
    param($IconFile)
    
    Write-Host "Analyzing: $IconFile" -ForegroundColor Yellow
    
    if (Test-Path $IconFile) {
        $fileInfo = Get-Item $IconFile
        Write-Host "  File Size: $([math]::Round($fileInfo.Length/1KB, 2)) KB" -ForegroundColor Gray
        
        # Get first few bytes to check file type
        $bytes = Get-Content $IconFile -Encoding Byte -TotalCount 4
        if ($bytes[0] -eq 0 -and $bytes[1] -eq 0) {
            Write-Host "  Format: ICO (Windows Icon)" -ForegroundColor Green
        } elseif ($bytes[0] -eq 137 -and $bytes[1] -eq 80 -and $bytes[2] -eq 78 -and $bytes[3] -eq 71) {
            Write-Host "  Format: PNG (Incorrect - should be ICO!)" -ForegroundColor Red
            Write-Host "  ERROR: This is a PNG file, not a proper ICO file!" -ForegroundColor Red
        } else {
            Write-Host "  Format: Unknown" -ForegroundColor Yellow
        }
    } else {
        Write-Host "  FILE NOT FOUND" -ForegroundColor Red
    }
    Write-Host ""
}

# Check all icon files
Write-Host "Checking Icon Files..." -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan
Get-IconInfo "prompd-ide.exe"
Get-IconInfo "prompd-ide-combined.ico"
Get-IconInfo "prompd-ide.ico"
Get-IconInfo "prompd-icon.ico"
Get-IconInfo "resources\win32\code.ico"

# Check if ImageMagick is available for detailed analysis
$magick = Get-Command magick -ErrorAction SilentlyContinue
if ($magick) {
    Write-Host "Detailed Icon Analysis (via ImageMagick):" -ForegroundColor Cyan
    Write-Host "----------------------------------------" -ForegroundColor Cyan
    
    Write-Host "prompd-ide-combined.ico contains:" -ForegroundColor Yellow
    & magick identify "prompd-ide-combined.ico" 2>$null
    
    Write-Host ""
} else {
    Write-Host "Install ImageMagick for detailed icon analysis" -ForegroundColor Yellow
    Write-Host "Download from: https://imagemagick.org/script/download.php#windows" -ForegroundColor Gray
}

# Check Windows DPI setting
Write-Host ""
Write-Host "System DPI Settings:" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan

$dpi = (Get-ItemProperty -Path "HKCU:\Control Panel\Desktop\WindowMetrics" -Name AppliedDPI -ErrorAction SilentlyContinue).AppliedDPI
if ($dpi) {
    $scaling = [math]::Round($dpi / 96 * 100)
    Write-Host "  Display Scaling: $scaling%" -ForegroundColor Gray
    
    if ($scaling -eq 100) {
        Write-Host "  Taskbar needs: 32x32 icon" -ForegroundColor Green
    } elseif ($scaling -eq 125) {
        Write-Host "  Taskbar needs: 40x40 icon" -ForegroundColor Yellow
    } elseif ($scaling -eq 150) {
        Write-Host "  Taskbar needs: 48x48 icon" -ForegroundColor Yellow
    } elseif ($scaling -eq 175) {
        Write-Host "  Taskbar needs: 56x56 icon" -ForegroundColor Yellow
    } elseif ($scaling -eq 200) {
        Write-Host "  Taskbar needs: 64x64 icon" -ForegroundColor Yellow
    }
} else {
    Write-Host "  Could not determine display scaling" -ForegroundColor Red
}

Write-Host ""
Write-Host "Recommendations:" -ForegroundColor Cyan
Write-Host "----------------------------------------" -ForegroundColor Cyan
Write-Host "1. Ensure prompd-ide-combined.ico contains these sizes:" -ForegroundColor White
Write-Host "   16x16, 20x20, 24x24, 32x32, 40x40, 48x48, 64x64, 256x256" -ForegroundColor Gray
Write-Host ""
Write-Host "2. The 32x32 size is CRITICAL for taskbar clarity at 100% DPI" -ForegroundColor White
Write-Host ""
Write-Host "3. If icons are PNG format, they must be converted to ICO" -ForegroundColor White
Write-Host ""
Write-Host "4. Run clear-all-icon-caches.bat as Administrator after any changes" -ForegroundColor White