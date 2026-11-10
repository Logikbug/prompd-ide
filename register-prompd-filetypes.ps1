# PowerShell script to register Prompd file types with Windows
# Run as Administrator: PowerShell -ExecutionPolicy Bypass -File "register-prompd-filetypes.ps1"

param(
    [switch]$Unregister = $false
)

# Get the path to Prompd IDE executable
$prompdIdePath = "$PSScriptRoot\prompd-ide.exe"

# Check if Prompd IDE executable exists
if (-not (Test-Path $prompdIdePath)) {
    Write-Error "Prompd IDE executable not found at: $prompdIdePath"
    Write-Host "Please ensure prompd-ide.exe exists in the same directory as this script."
    exit 1
}

Write-Host "Prompd File Type Registration Script" -ForegroundColor Cyan
Write-Host "====================================" -ForegroundColor Cyan

if ($Unregister) {
    Write-Host "Unregistering Prompd file types..." -ForegroundColor Yellow
    
    # Remove registry entries
    $registryKeys = @(
        "HKCR:\.prompd",
        "HKCR:\.prompdflow", 
        "HKCR:\.prompdproj",
        "HKCR:\PrompdFile",
        "HKCR:\PrompdFlow",
        "HKCR:\PrompdProject",
        "HKCR:\*\shell\PrompdIDE"
    )
    
    foreach ($key in $registryKeys) {
        try {
            if (Test-Path $key) {
                Remove-Item -Path $key -Recurse -Force
                Write-Host "  Removed: $key" -ForegroundColor Green
            }
        }
        catch {
            Write-Host "  Failed to remove: $key - $($_.Exception.Message)" -ForegroundColor Red
        }
    }
    
    Write-Host "File type unregistration completed!" -ForegroundColor Green
}
else {
    Write-Host "Registering Prompd file types with Windows..." -ForegroundColor Green
    Write-Host "Prompd IDE Path: $prompdIdePath" -ForegroundColor Gray
    
    # Create registry entries
    try {
        # .prompdproj files
        Write-Host "Registering .prompdproj files..." -ForegroundColor Yellow
        
        New-Item -Path "HKCR:\.prompdproj" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\.prompdproj" -Name "(Default)" -Value "PrompdProject"
        Set-ItemProperty -Path "HKCR:\.prompdproj" -Name "Content Type" -Value "text/x-prompdproj"
        
        New-Item -Path "HKCR:\.prompdproj\OpenWithProgids" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\.prompdproj\OpenWithProgids" -Name "PrompdProject" -Value ""
        
        New-Item -Path "HKCR:\PrompdProject" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\PrompdProject" -Name "(Default)" -Value "Prompd Project File"
        Set-ItemProperty -Path "HKCR:\PrompdProject" -Name "FriendlyTypeName" -Value "Prompd Project File"
        
        New-Item -Path "HKCR:\PrompdProject\DefaultIcon" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\PrompdProject\DefaultIcon" -Name "(Default)" -Value "`"$prompdIdePath`",1"
        
        New-Item -Path "HKCR:\PrompdProject\shell" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\PrompdProject\shell" -Name "(Default)" -Value "open"
        
        New-Item -Path "HKCR:\PrompdProject\shell\open" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\PrompdProject\shell\open" -Name "(Default)" -Value "&Open with Prompd IDE"
        
        New-Item -Path "HKCR:\PrompdProject\shell\open\command" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\PrompdProject\shell\open\command" -Name "(Default)" -Value "`"$prompdIdePath`" `"%1`""
        
        # .prompd files
        Write-Host "Registering .prompd files..." -ForegroundColor Yellow
        
        New-Item -Path "HKCR:\.prompd" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\.prompd" -Name "(Default)" -Value "PrompdFile"
        Set-ItemProperty -Path "HKCR:\.prompd" -Name "Content Type" -Value "text/x-prompd"
        
        New-Item -Path "HKCR:\.prompd\OpenWithProgids" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\.prompd\OpenWithProgids" -Name "PrompdFile" -Value ""
        
        New-Item -Path "HKCR:\PrompdFile" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\PrompdFile" -Name "(Default)" -Value "Prompd Prompt Definition File"
        Set-ItemProperty -Path "HKCR:\PrompdFile" -Name "FriendlyTypeName" -Value "Prompd Prompt Definition File"
        
        New-Item -Path "HKCR:\PrompdFile\DefaultIcon" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\PrompdFile\DefaultIcon" -Name "(Default)" -Value "`"$prompdIdePath`",2"
        
        New-Item -Path "HKCR:\PrompdFile\shell" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\PrompdFile\shell" -Name "(Default)" -Value "open"
        
        New-Item -Path "HKCR:\PrompdFile\shell\open" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\PrompdFile\shell\open" -Name "(Default)" -Value "&Open with Prompd IDE"
        
        New-Item -Path "HKCR:\PrompdFile\shell\open\command" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\PrompdFile\shell\open\command" -Name "(Default)" -Value "`"$prompdIdePath`" `"%1`""
        
        # .prompdflow files
        Write-Host "Registering .prompdflow files..." -ForegroundColor Yellow
        
        New-Item -Path "HKCR:\.prompdflow" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\.prompdflow" -Name "(Default)" -Value "PrompdFlow"
        Set-ItemProperty -Path "HKCR:\.prompdflow" -Name "Content Type" -Value "application/x-prompdflow"
        
        New-Item -Path "HKCR:\.prompdflow\OpenWithProgids" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\.prompdflow\OpenWithProgids" -Name "PrompdFlow" -Value ""
        
        New-Item -Path "HKCR:\PrompdFlow" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\PrompdFlow" -Name "(Default)" -Value "Prompd Workflow File"
        Set-ItemProperty -Path "HKCR:\PrompdFlow" -Name "FriendlyTypeName" -Value "Prompd Workflow File"
        
        New-Item -Path "HKCR:\PrompdFlow\DefaultIcon" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\PrompdFlow\DefaultIcon" -Name "(Default)" -Value "`"$prompdIdePath`",3"
        
        New-Item -Path "HKCR:\PrompdFlow\shell" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\PrompdFlow\shell" -Name "(Default)" -Value "open"
        
        New-Item -Path "HKCR:\PrompdFlow\shell\open" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\PrompdFlow\shell\open" -Name "(Default)" -Value "&Open with Prompd IDE"
        
        New-Item -Path "HKCR:\PrompdFlow\shell\open\command" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\PrompdFlow\shell\open\command" -Name "(Default)" -Value "`"$prompdIdePath`" `"%1`""
        
        # Add to "Open with" context menu
        Write-Host "Adding context menu entries..." -ForegroundColor Yellow
        
        New-Item -Path "HKCR:\*\shell\PrompdIDE" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\*\shell\PrompdIDE" -Name "(Default)" -Value "Open with Prompd IDE"
        Set-ItemProperty -Path "HKCR:\*\shell\PrompdIDE" -Name "AppliesTo" -Value "System.FileName:`"*.prompd`" OR System.FileName:`"*.prompdflow`" OR System.FileName:`"*.prompdproj`""
        
        New-Item -Path "HKCR:\*\shell\PrompdIDE\command" -Force | Out-Null
        Set-ItemProperty -Path "HKCR:\*\shell\PrompdIDE\command" -Name "(Default)" -Value "`"$prompdIdePath`" `"%1`""
        
        Write-Host ""
        Write-Host "✅ File type registration completed successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "The following file types are now registered with Prompd IDE:" -ForegroundColor Cyan
        Write-Host "  • .prompdproj (Prompd Project File)" -ForegroundColor White
        Write-Host "  • .prompd (Prompd Prompt Definition File)" -ForegroundColor White  
        Write-Host "  • .prompdflow (Prompd Workflow File)" -ForegroundColor White
        Write-Host ""
        Write-Host "You can now:" -ForegroundColor Cyan
        Write-Host "  • Double-click any of these file types to open in Prompd IDE" -ForegroundColor White
        Write-Host "  • Right-click and select 'Open with Prompd IDE'" -ForegroundColor White
        Write-Host "  • See custom icons in Windows Explorer" -ForegroundColor White
        Write-Host ""
        Write-Host "Note: You may need to refresh Windows Explorer or restart it to see the changes." -ForegroundColor Yellow
        
    }
    catch {
        Write-Error "Failed to register file types: $($_.Exception.Message)"
        Write-Host "Make sure you're running this script as Administrator." -ForegroundColor Red
        exit 1
    }
}

# Refresh the shell to apply changes immediately
Write-Host "Refreshing Windows shell..." -ForegroundColor Gray
try {
    $SHCNE_ASSOCCHANGED = 0x08000000
    $SHCNF_IDLIST = 0x0000
    Add-Type -TypeDefinition @"
        using System;
        using System.Runtime.InteropServices;
        public class Win32 {
            [DllImport("shell32.dll", CharSet = CharSet.Auto, SetLastError = true)]
            public static extern void SHChangeNotify(int wEventId, int uFlags, IntPtr dwItem1, IntPtr dwItem2);
        }
"@
    [Win32]::SHChangeNotify($SHCNE_ASSOCCHANGED, $SHCNF_IDLIST, [IntPtr]::Zero, [IntPtr]::Zero)
    Write-Host "Shell refresh completed." -ForegroundColor Green
}
catch {
    Write-Host "Could not refresh shell automatically. Please restart Windows Explorer." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Registration complete! Test by double-clicking a .prompdproj file." -ForegroundColor Green