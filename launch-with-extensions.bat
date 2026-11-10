@echo off
echo ========================================
echo    Prompd IDE - Full Extensions Launch
echo ========================================
echo.

REM Create a dedicated profile directory for Prompd IDE with extensions
set PROMPD_PROFILE=%USERPROFILE%\.prompd-ide-dev
mkdir "%PROMPD_PROFILE%" 2>NUL

echo Starting Prompd IDE with all extensions enabled...
echo Profile: %PROMPD_PROFILE%
echo.

REM Launch Prompd IDE with extensions enabled:
REM - Uses persistent profile for extension storage
REM - Enables all user extensions
REM - Loads Prompd extension in development mode
REM - Custom branding and title
code ^
  --user-data-dir "%PROMPD_PROFILE%" ^
  --extensionDevelopmentPath "%~dp0extensions\prompd" ^
  --new-window ^
  --title "Prompd IDE - Professional Prompt Engineering" ^
  "..\prompd-dev-workspace"

echo.
echo Prompd IDE launched with all extensions enabled!
echo Your extensions are stored in: %PROMPD_PROFILE%\extensions
echo To stop, close the VS Code window.
echo.
pause