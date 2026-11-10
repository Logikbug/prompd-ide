@echo off
echo ========================================
echo    PROMPD IDE - Fresh Launch
echo ========================================
echo.

REM Kill any existing instances
taskkill //F //IM prompd-ide.exe 2>nul

REM Clear cache to force rebranding
rd /s /q "%USERPROFILE%\.prompd-ide\CachedData" 2>nul
rd /s /q "%USERPROFILE%\.prompd-ide\logs" 2>nul

echo Starting Prompd IDE with fresh configuration...
echo.

REM Launch with minimal flags for clean start
start "Prompd IDE" prompd-ide.exe --user-data-dir "%USERPROFILE%\.prompd-ide" --extensions-dir "extensions"

echo.
echo Prompd IDE should now be starting with proper branding!
echo Check your taskbar for the separate Prompd IDE application.
echo.