# PowerShell launcher for Prompd IDE with proper taskbar separation
# This creates a separate process identity for Windows taskbar grouping

param(
    [string]$WorkspaceFile = "sample-flow.prompdflow"
)

# Set console title
$Host.UI.RawUI.WindowTitle = "Prompd IDE Launcher"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "    PROMPD IDE - Standalone Launch" -ForegroundColor Blue  
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Set environment variables
$env:PROMPD_IDE_HOME = $PSScriptRoot
$env:PROMPD_PROFILE = "$env:USERPROFILE\.prompd-ide"

# Create profile directory
if (!(Test-Path $env:PROMPD_PROFILE)) {
    New-Item -ItemType Directory -Path $env:PROMPD_PROFILE -Force | Out-Null
}

Write-Host "Starting Prompd IDE (Standalone Mode)..." -ForegroundColor Green
Write-Host "Profile: $env:PROMPD_PROFILE" -ForegroundColor Gray
Write-Host ""

# Import Windows API to set AppUserModelID
Add-Type -TypeDefinition @"
    using System;
    using System.Runtime.InteropServices;
    public class Shell32 {
        [DllImport("shell32.dll")]
        public static extern int SetCurrentProcessExplicitAppUserModelID(
            [MarshalAs(UnmanagedType.LPWStr)] string AppID);
    }
"@

# Set the AppUserModelID for this PowerShell process
try {
    $result = [Shell32]::SetCurrentProcessExplicitAppUserModelID("Logikbug.PrompdIDE")
    if ($result -eq 0) {
        Write-Host "✅ AppUserModelID set successfully" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Could not set AppUserModelID: $($_.Exception.Message)" -ForegroundColor Yellow
}

# Build VS Code arguments
$arguments = @(
    "--product", "`"$PSScriptRoot\product.prompd.json`""
    "--user-data-dir", "`"$env:PROMPD_PROFILE`""
    "--disable-extensions"
    "--disable-extension-gallery" 
    "--disable-marketplace"
    "--disable-update-check"
    "--disable-workspace-trust"
    "--disable-crash-reporter"
    "--disable-telemetry"
    "--extensions-dir", "`"$PSScriptRoot\extensions`""
    "--builtin-extensions-dir", "`"$PSScriptRoot\extensions`""
    "--new-window"
    "--title", "`"Prompd IDE - Enterprise Prompt Engineering`""
    "`"$PSScriptRoot\$WorkspaceFile`""
)

# Launch VS Code process
try {
    Write-Host "🚀 Launching Prompd IDE..." -ForegroundColor Cyan
    
    # Start VS Code as a child process but with our AppUserModelID
    $process = Start-Process -FilePath "code" -ArgumentList $arguments -PassThru -WindowStyle Normal
    
    if ($process) {
        Write-Host "✅ Prompd IDE launched successfully (PID: $($process.Id))" -ForegroundColor Green
        Write-Host ""
        Write-Host "Prompd IDE is now running in standalone mode!" -ForegroundColor Green
        Write-Host "This instance should appear separately in the taskbar." -ForegroundColor Gray
        Write-Host ""
        
        # Wait for user input before closing launcher
        Write-Host "Press any key to close this launcher (VS Code will continue running)..." -ForegroundColor Yellow
        $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    } else {
        Write-Host "❌ Failed to launch Prompd IDE" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Error launching Prompd IDE: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "Make sure VS Code is installed and accessible via 'code' command" -ForegroundColor Yellow
    Write-Host "Press any key to exit..." -ForegroundColor Yellow
    $null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
    exit 1
}