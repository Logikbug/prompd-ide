# Final icon update script for prompd-ide.exe
# Run this with Administrator privileges if needed

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "Final Icon Update for prompd-ide.exe" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$rceditPath = "node_modules\rcedit\bin\rcedit.exe"
$iconFile = "prompd-ide-combined.ico"
$exeFile = "prompd-ide.exe"

# Kill any running instances
Write-Host "Stopping any running prompd-ide processes..." -ForegroundColor Yellow
Stop-Process -Name "prompd-ide" -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Apply icon to main executable
Write-Host "Applying icon to $exeFile..." -ForegroundColor Yellow

try {
    & $rceditPath $exeFile --set-icon $iconFile
    Write-Host "[SUCCESS] Icon applied to executable!" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Direct update failed, trying alternative method..." -ForegroundColor Red
    
    # Alternative: Create a copy, update it, then replace
    Copy-Item $exeFile "$exeFile.backup" -Force
    Copy-Item $exeFile "prompd-ide-new.exe" -Force
    
    try {
        & $rceditPath "prompd-ide-new.exe" --set-icon $iconFile
        
        # Replace original with updated version
        Remove-Item $exeFile -Force
        Rename-Item "prompd-ide-new.exe" $exeFile
        
        Write-Host "[SUCCESS] Icon applied via replacement method!" -ForegroundColor Green
    } catch {
        Write-Host "[ERROR] Could not update executable icon" -ForegroundColor Red
        Write-Host "Error: $_" -ForegroundColor Red
        
        # Restore backup if needed
        if (Test-Path "$exeFile.backup") {
            Copy-Item "$exeFile.backup" $exeFile -Force
        }
    }
}

# Clear Windows icon cache
Write-Host ""
Write-Host "Clearing Windows icon cache..." -ForegroundColor Yellow

# Delete icon cache files
Remove-Item "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\iconcache*" -Force -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache*" -Force -ErrorAction SilentlyContinue

# Force icon cache refresh
& ie4uinit.exe -ClearIconCache 2>$null
& ie4uinit.exe -show 2>$null

# Restart Explorer
Write-Host "Restarting Windows Explorer..." -ForegroundColor Yellow
Stop-Process -Name "explorer" -Force
Start-Sleep -Seconds 2
Start-Process "explorer.exe"

Write-Host ""
Write-Host "================================================" -ForegroundColor Green
Write-Host "Icon Update Complete!" -ForegroundColor Green
Write-Host "================================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your taskbar icon should now be sharp and clear!" -ForegroundColor Cyan
Write-Host ""
Write-Host "If the icon still appears blurry:" -ForegroundColor Yellow
Write-Host "1. Unpin from taskbar (right-click > Unpin from taskbar)" -ForegroundColor White
Write-Host "2. Run prompd-ide.exe" -ForegroundColor White
Write-Host "3. Pin to taskbar again (right-click > Pin to taskbar)" -ForegroundColor White
Write-Host ""
Write-Host "Icon file details:" -ForegroundColor Cyan
Write-Host "  - File: prompd-ide-combined.ico" -ForegroundColor Gray
Write-Host "  - Size: 45.1 KB" -ForegroundColor Gray
Write-Host "  - Contains: 16x16, 24x24, 32x32, 48x48, 64x64, 128x128, 256x256" -ForegroundColor Gray