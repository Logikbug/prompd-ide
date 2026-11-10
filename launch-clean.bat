@echo off
echo ========================================
echo    prompd IDE - Clean Launch
echo ========================================
echo.

REM Create a temporary clean profile directory
set TEMP_PROFILE=%TEMP%\prompd-ide-profile-%RANDOM%
mkdir "%TEMP_PROFILE%" 2>NUL

echo Starting prompd IDE with clean profile...
echo Profile: %TEMP_PROFILE%
echo.

REM Launch prompd IDE with extensions enabled:
REM - Clean user data directory 
REM - All extensions enabled for full IDE experience
REM - Prompd extension in development mode
REM - Custom branding and isolated environment
code ^
  --user-data-dir "%TEMP_PROFILE%" ^
  --disable-workspace-trust ^
  --disable-update ^
  --disable-crash-reporter ^
  --extensionDevelopmentPath "%~dp0extensions\prompd" ^
  --new-window ^
  --title "prompd IDE - Professional Prompt Engineering" ^
  "..\prompd-dev-workspace"

echo.
echo prompd IDE launched!
echo To stop, close the VS Code window.
echo.
pause