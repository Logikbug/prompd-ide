@echo off
title Prompd IDE Installer

echo ========================================
echo    Prompd IDE Installation Wizard
echo ========================================
echo.

REM Get installation directory
set /p INSTALL_DIR="Install location [C:\Program Files\Prompd IDE]: "
if "%INSTALL_DIR%"=="" set INSTALL_DIR=C:\Program Files\Prompd IDE

echo.
echo Installing to: %INSTALL_DIR%
echo.

REM Create install directory
if not exist "%INSTALL_DIR%" (
    mkdir "%INSTALL_DIR%"
    if errorlevel 1 (
        echo ERROR: Could not create install directory. Run as administrator.
        pause
        exit /b 1
    )
)

REM Copy all files
echo Copying Prompd IDE files...
xcopy /E /Y /Q "%~dp0*" "%INSTALL_DIR%\" >nul
if errorlevel 1 (
    echo ERROR: Failed to copy files
    pause
    exit /b 1
)

REM Create desktop shortcut
echo Creating desktop shortcut...
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut([Environment]::GetFolderPath('Desktop') + '\Prompd IDE.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\prompd-ide.exe'; $Shortcut.Arguments = '--product "%INSTALL_DIR%\product.prompd.json" --user-data-dir "%USERPROFILE%\.prompd-ide" --extensions-dir "%INSTALL_DIR%\extensions" --builtin-extensions-dir "%INSTALL_DIR%\extensions" --disable-extension-gallery --disable-marketplace --disable-update-check --title "Prompd IDE"'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.IconLocation = '%INSTALL_DIR%\prompd-ide.exe,0'; $Shortcut.Description = 'Prompd IDE - Professional Prompt Engineering'; $Shortcut.Save()"

REM Create start menu shortcut
echo Creating start menu shortcut...
if not exist "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Prompd IDE" mkdir "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Prompd IDE"
powershell -Command "$WshShell = New-Object -comObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('%APPDATA%\Microsoft\Windows\Start Menu\Programs\Prompd IDE\Prompd IDE.lnk'); $Shortcut.TargetPath = '%INSTALL_DIR%\prompd-ide.exe'; $Shortcut.Arguments = '--product "%INSTALL_DIR%\product.prompd.json" --user-data-dir "%USERPROFILE%\.prompd-ide" --extensions-dir "%INSTALL_DIR%\extensions" --builtin-extensions-dir "%INSTALL_DIR%\extensions" --disable-extension-gallery --disable-marketplace --disable-update-check --title "Prompd IDE"'; $Shortcut.WorkingDirectory = '%INSTALL_DIR%'; $Shortcut.IconLocation = '%INSTALL_DIR%\prompd-ide.exe,0'; $Shortcut.Description = 'Prompd IDE - Professional Prompt Engineering'; $Shortcut.Save()"

REM Register file associations
echo Registering .prompd and .prompdflow file types...
reg add "HKCU\Software\Classes\.prompd" /ve /d "Prompd.File" /f >nul
reg add "HKCU\Software\Classes\Prompd.File" /ve /d "Prompd File" /f >nul
reg add "HKCU\Software\Classes\Prompd.File\DefaultIcon" /ve /d "%INSTALL_DIR%\prompd-ide.exe,0" /f >nul
reg add "HKCU\Software\Classes\Prompd.File\shell\open\command" /ve /d "\"%INSTALL_DIR%\prompd-ide.exe\" --product \"%INSTALL_DIR%\product.prompd.json\" --user-data-dir \"%USERPROFILE%\.prompd-ide\" --extensions-dir \"%INSTALL_DIR%\extensions\" \"%1\"" /f >nul

reg add "HKCU\Software\Classes\.prompdflow" /ve /d "PrompdFlow.File" /f >nul
reg add "HKCU\Software\Classes\PrompdFlow.File" /ve /d "Prompd Workflow File" /f >nul
reg add "HKCU\Software\Classes\PrompdFlow.File\DefaultIcon" /ve /d "%INSTALL_DIR%\prompd-ide.exe,0" /f >nul
reg add "HKCU\Software\Classes\PrompdFlow.File\shell\open\command" /ve /d "\"%INSTALL_DIR%\prompd-ide.exe\" --product \"%INSTALL_DIR%\product.prompd.json\" --user-data-dir \"%USERPROFILE%\.prompd-ide\" --extensions-dir \"%INSTALL_DIR%\extensions\" \"%1\"" /f >nul

echo.
echo ========================================
echo    Installation Complete!
echo ========================================
echo.
echo Prompd IDE has been installed to:
echo %INSTALL_DIR%
echo.
echo Shortcuts created:
echo - Desktop: Prompd IDE
echo - Start Menu: Programs > Prompd IDE
echo.
echo File associations registered:
echo - .prompd files
echo - .prompdflow files
echo.
echo You can now launch Prompd IDE from:
echo 1. Desktop shortcut
echo 2. Start menu
echo 3. Double-click .prompd/.prompdflow files
echo.
pause
