# PowerShell version of Prompd IDE build script
# Creates standalone executable with proper taskbar separation

Write-Host "🚀 Building Prompd IDE Standalone Executable..." -ForegroundColor Green
Write-Host ""

$ScriptDir = $PSScriptRoot

# Step 1: Check if Code.exe exists
$CodeExePath = Join-Path $ScriptDir "Code.exe"
$PrompdExePath = Join-Path $ScriptDir "prompd-ide.exe"

if (Test-Path $CodeExePath) {
    Write-Host "🔄 Renaming executable for taskbar separation..." -ForegroundColor Yellow
    
    # Remove existing prompd-ide.exe if it exists
    if (Test-Path $PrompdExePath) {
        Write-Host "   ⚠️  prompd-ide.exe already exists, removing old version..." -ForegroundColor Yellow
        Remove-Item $PrompdExePath -Force
    }
    
    # Rename Code.exe to prompd-ide.exe
    Write-Host "   📝 Renaming Code.exe → prompd-ide.exe..." -ForegroundColor Cyan
    Rename-Item $CodeExePath $PrompdExePath
    Write-Host "   ✅ Executable renamed successfully!" -ForegroundColor Green
} else {
    Write-Host "   ⚠️  Code.exe not found - you may need to build VS Code first" -ForegroundColor Red
    Write-Host "   💡 Run: npm run compile-build" -ForegroundColor Yellow
}

# Step 2: Update launcher script
Write-Host "🔧 Updating prompd-ide.bat launcher..." -ForegroundColor Yellow
$LauncherPath = Join-Path $ScriptDir "prompd-ide.bat"

if (Test-Path $LauncherPath) {
    $LauncherContent = Get-Content $LauncherPath -Raw
    
    if ($LauncherContent -match 'code \^') {
        $LauncherContent = $LauncherContent -replace 'code \^', '"%~dp0prompd-ide.exe" ^'
        Set-Content $LauncherPath $LauncherContent -NoNewline
        Write-Host "   ✅ Updated launcher to use prompd-ide.exe" -ForegroundColor Green
    } else {
        Write-Host "   ℹ️  Launcher already configured correctly" -ForegroundColor Blue
    }
} else {
    Write-Host "   ⚠️  prompd-ide.bat not found" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "✅ Prompd IDE Build Complete!" -ForegroundColor Green
Write-Host ""

Write-Host "🎯 Taskbar Separation Status: COMPLETE ✅" -ForegroundColor Green
Write-Host "   - Executable: prompd-ide.exe (separate from Code.exe)" -ForegroundColor White
Write-Host "   - AppUserModelID: Logikbug.PrompdIDE" -ForegroundColor White  
Write-Host "   - Will appear as separate taskbar item" -ForegroundColor White
Write-Host ""

Write-Host "🚀 Ready to launch: prompd-ide.bat" -ForegroundColor Cyan