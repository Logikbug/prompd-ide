# Setup script to create prompd-ide.exe from existing VS Code installation
# This provides true taskbar separation by using a different executable name

Write-Host "🔧 Setting up Prompd IDE executable..." -ForegroundColor Blue
Write-Host ""

$ScriptDir = $PSScriptRoot

# Try to find VS Code executable in common locations
$VSCodePaths = @(
    "${env:LOCALAPPDATA}\Programs\Microsoft VS Code\Code.exe"
    "${env:ProgramFiles}\Microsoft VS Code\Code.exe" 
    "${env:ProgramFiles(x86)}\Microsoft VS Code\Code.exe"
    "C:\Program Files\Microsoft VS Code\Code.exe"
    "C:\Program Files (x86)\Microsoft VS Code\Code.exe"
)

$CodeExePath = $null
foreach ($path in $VSCodePaths) {
    if (Test-Path $path) {
        $CodeExePath = $path
        Write-Host "✅ Found VS Code at: $path" -ForegroundColor Green
        break
    }
}

if (-not $CodeExePath) {
    Write-Host "❌ VS Code executable not found in standard locations" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please install VS Code or specify the path manually:" -ForegroundColor Yellow
    Write-Host "Copy-Item 'C:\path\to\Code.exe' '$ScriptDir\prompd-ide.exe'" -ForegroundColor Gray
    exit 1
}

$PrompdExePath = Join-Path $ScriptDir "prompd-ide.exe"

# Copy VS Code executable to create prompd-ide.exe
try {
    if (Test-Path $PrompdExePath) {
        Write-Host "⚠️  Removing existing prompd-ide.exe..." -ForegroundColor Yellow
        Remove-Item $PrompdExePath -Force
    }
    
    Write-Host "📋 Copying VS Code executable..." -ForegroundColor Cyan
    Copy-Item $CodeExePath $PrompdExePath -Force
    
    Write-Host "✅ Created prompd-ide.exe successfully!" -ForegroundColor Green
    
    # Update the batch launcher
    $LauncherPath = Join-Path $ScriptDir "prompd-ide.bat"
    if (Test-Path $LauncherPath) {
        $LauncherContent = Get-Content $LauncherPath -Raw
        $LauncherContent = $LauncherContent -replace 'code \^', '"%~dp0prompd-ide.exe" ^'
        Set-Content $LauncherPath $LauncherContent -NoNewline
        Write-Host "✅ Updated prompd-ide.bat launcher" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "🎯 Taskbar Separation Setup Complete!" -ForegroundColor Green
    Write-Host "   - Executable: prompd-ide.exe (separate from Code.exe)" -ForegroundColor White
    Write-Host "   - AppUserModelID: Logikbug.PrompdIDE" -ForegroundColor White
    Write-Host "   - Custom product configuration" -ForegroundColor White
    Write-Host ""
    Write-Host "🚀 Launch with: prompd-ide.bat" -ForegroundColor Cyan
    Write-Host "   This should now appear as a separate taskbar item!" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Failed to create prompd-ide.exe: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}