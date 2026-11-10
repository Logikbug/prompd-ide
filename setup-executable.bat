@echo off
echo ========================================
echo    Prompd IDE Executable Setup
echo ========================================
echo.

set "PROMPD_DIR=%~dp0"
set "PROMPD_EXE=%PROMPD_DIR%prompd-ide.exe"

REM Try to find VS Code in common locations
set "CODE_EXE="
if exist "%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe" (
    set CODE_EXE=%LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe
    echo Found VS Code at: %LOCALAPPDATA%\Programs\Microsoft VS Code\Code.exe
) else if exist "%ProgramFiles%\Microsoft VS Code\Code.exe" (
    set CODE_EXE=%ProgramFiles%\Microsoft VS Code\Code.exe
    echo Found VS Code at: %ProgramFiles%\Microsoft VS Code\Code.exe
) else if exist "%ProgramFiles(x86)%\Microsoft VS Code\Code.exe" (
    set CODE_EXE=%ProgramFiles(x86)%\Microsoft VS Code\Code.exe
    echo Found VS Code at: %ProgramFiles(x86)%\Microsoft VS Code\Code.exe
) else (
    echo ERROR: VS Code executable not found in standard locations
    echo Please install VS Code or copy Code.exe manually to prompd-ide.exe
    pause
    exit /b 1
)

REM Remove existing prompd-ide.exe if it exists
if exist "%PROMPD_EXE%" (
    echo Removing existing prompd-ide.exe...
    del "%PROMPD_EXE%"
)

REM Copy VS Code executable to create prompd-ide.exe
echo Copying VS Code executable to create prompd-ide.exe...
copy /Y "%CODE_EXE%" "%PROMPD_EXE%"

if exist "%PROMPD_EXE%" (
    echo.
    echo SUCCESS: Created prompd-ide.exe
    echo.
    echo Taskbar Separation Status: COMPLETE
    echo   - Executable: prompd-ide.exe (separate from Code.exe)
    echo   - AppUserModelID: Logikbug.PrompdIDE
    echo   - Custom product configuration
    echo.
    echo Launch with: prompd-ide.bat
    echo This should now appear as a separate taskbar item!
) else (
    echo ERROR: Failed to create prompd-ide.exe
    pause
    exit /b 1
)

echo.
pause