@echo off
title Prompd IDE Uninstaller

echo ========================================
echo    Prompd IDE Uninstaller
echo ========================================
echo.

set /p CONFIRM="Are you sure you want to uninstall Prompd IDE? (y/N): "
if /i not "%CONFIRM%"=="y" (
    echo Uninstall cancelled.
    pause
    exit /b 0
)

echo.
echo Removing shortcuts...
del "%USERPROFILE%\Desktop\Prompd IDE.lnk" 2>nul
rd /s /q "%APPDATA%\Microsoft\Windows\Start Menu\Programs\Prompd IDE" 2>nul

echo Removing file associations...
reg delete "HKCU\Software\Classes\.prompd" /f 2>nul
reg delete "HKCU\Software\Classes\Prompd.File" /f 2>nul
reg delete "HKCU\Software\Classes\.prompdflow" /f 2>nul
reg delete "HKCU\Software\Classes\PrompdFlow.File" /f 2>nul

echo.
echo Uninstall complete!
echo Note: User data in %USERPROFILE%\.prompd-ide was preserved.
echo.
pause
