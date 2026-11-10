@echo off
echo ========================================
echo     PROMPD IDE - Standalone Launch
echo ========================================
echo.

REM Set custom environment for Prompd IDE
set PROMPD_IDE_HOME=%~dp0
set PROMPD_PROFILE=%USERPROFILE%\.prompd-ide

REM Create Prompd IDE profile directory
if not exist "%PROMPD_PROFILE%" mkdir "%PROMPD_PROFILE%"

echo Starting Prompd IDE (Standalone Mode)...
echo Profile: %PROMPD_PROFILE%
echo Extensions Dir: %~dp0extensions
echo Test File: %~dp0..\prompd-dev-workspace\test-drag-drop.pdflow
echo.

REM Launch with complete VS Code isolation:
REM - Custom product configuration
REM - Isolated user data
REM - All external services disabled
REM - Only Prompd extension loaded
REM - Custom branding and title
"%~dp0prompd-ide.exe" ^
  --product "%~dp0product.prompd.json" ^
  --user-data-dir "%PROMPD_PROFILE%" ^
  --disable-extensions ^
  --disable-extension-gallery ^
  --disable-marketplace ^
  --disable-update-check ^
  --disable-workspace-trust ^
  --disable-crash-reporter ^
  --disable-telemetry ^
  --extensions-dir "%~dp0extensions" ^
  --builtin-extensions-dir "%~dp0extensions" ^
  --new-window ^
  --title "Prompd IDE - Enterprise Prompt Engineering" ^
  "..\prompd-dev-workspace\test-drag-drop.pdflow"

echo.
echo Prompd IDE is now running in standalone mode!
echo This instance is completely isolated from VS Code.
echo.
pause
