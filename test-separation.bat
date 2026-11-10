@echo off
echo ============================================
echo Testing Taskbar Separation
echo ============================================
echo.

echo 1. Launching regular VS Code...
start "VS Code" code --new-window
timeout /t 3

echo 2. Launching Prompd IDE...
start "Prompd IDE" prompd-ide.exe --product "product.prompd.json" --user-data-dir "%USERPROFILE%\.prompd-ide" --new-window

echo.
echo Both applications should now be running.
echo Check your taskbar - they should appear as separate items.
echo.
echo VS Code should show: Microsoft.VisualStudioCode
echo Prompd IDE should show: Logikbug.PrompdIDE
echo.

pause