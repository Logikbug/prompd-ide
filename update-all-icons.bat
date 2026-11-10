@echo off
REM Script to update all prompd-ide icons to fix blurry taskbar issue
REM Uses the ICO files from ..\appicons\use\

echo ======================================
echo Updating prompd-ide Icons
echo ======================================
echo.

REM Set paths
set ICON_DIR=..\appicons\use
set MAIN_ICO=%ICON_DIR%\prompd-icon.ico

REM Check if main multi-size ICO exists
if not exist "%MAIN_ICO%" (
    echo ERROR: Main icon file not found: %MAIN_ICO%
    echo Creating multi-size ICO from individual files...
    
    REM Create multi-size ICO using ImageMagick (if available)
    where magick >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        echo Combining individual ICO files into single multi-size ICO...
        magick convert ^
            %ICON_DIR%\prompd-icon-16x16.ico ^
            %ICON_DIR%\prompd-icon-24x24.ico ^
            %ICON_DIR%\prompd-icon-32x32.ico ^
            %ICON_DIR%\prompd-icon-48x48.ico ^
            %ICON_DIR%\prompd-icon-64x64.ico ^
            %ICON_DIR%\prompd-icon-128x128.ico ^
            %ICON_DIR%\prompd-icon-256x256.ico ^
            prompd-icon-multisize.ico
        set MAIN_ICO=prompd-icon-multisize.ico
    ) else (
        echo WARNING: ImageMagick not found. Using existing prompd-icon.ico
    )
)

echo.
echo Step 1: Updating main executable icon...
echo ----------------------------------------

REM Check if rcedit exists
where rcedit >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: rcedit not found in PATH
    echo Please install rcedit from: https://github.com/electron/rcedit
    echo Or run: npm install -g rcedit
    pause
    exit /b 1
)

REM Update the main executable icon
echo Updating prompd-ide.exe icon...
rcedit "prompd-ide.exe" --set-icon "%MAIN_ICO%"
if %ERRORLEVEL% EQU 0 (
    echo [OK] Main executable icon updated
) else (
    echo [FAILED] Could not update main executable icon
)

echo.
echo Step 2: Updating resource icons...
echo ----------------------------------------

REM Replace the main code.ico in resources
echo Copying main icon to resources\win32\code.ico...
copy /Y "%MAIN_ICO%" "resources\win32\code.ico" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] resources\win32\code.ico updated
) else (
    echo [FAILED] Could not update resources\win32\code.ico
)

REM Replace app resources icon if it exists
if exist "resources\app\resources\win32\code.ico" (
    echo Copying main icon to resources\app\resources\win32\code.ico...
    copy /Y "%MAIN_ICO%" "resources\app\resources\win32\code.ico" >nul
    if %ERRORLEVEL% EQU 0 (
        echo [OK] resources\app\resources\win32\code.ico updated
    ) else (
        echo [FAILED] Could not update resources\app\resources\win32\code.ico
    )
)

echo.
echo Step 3: Updating PNG files for Windows tiles...
echo ----------------------------------------

REM Update PNG files for Windows tiles
if exist "%ICON_DIR%\prompd-icon-256x256.png" (
    echo Updating tile images...
    copy /Y "%ICON_DIR%\prompd-icon-128x128.png" "resources\win32\code_150x150.png" >nul 2>nul
    copy /Y "%ICON_DIR%\prompd-icon-64x64.png" "resources\win32\code_70x70.png" >nul 2>nul
    echo [OK] Tile images updated
)

echo.
echo Step 4: Updating root directory icons...
echo ----------------------------------------

REM Update root directory icons
echo Copying main icon to prompd-ide.ico...
copy /Y "%MAIN_ICO%" "prompd-ide.ico" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] prompd-ide.ico updated
) else (
    echo [FAILED] Could not update prompd-ide.ico
)

echo Copying main icon to prompd-icon.ico...
copy /Y "%MAIN_ICO%" "prompd-icon.ico" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] prompd-icon.ico updated
) else (
    echo [FAILED] Could not update prompd-icon.ico
)

echo.
echo Step 5: Clearing Windows icon cache...
echo ----------------------------------------

REM Clear Windows icon cache to force refresh
echo Clearing icon cache...
ie4uinit.exe -show >nul 2>nul
taskkill /IM explorer.exe /F >nul 2>nul
timeout /t 2 /nobreak >nul
start explorer.exe

echo.
echo ======================================
echo Icon Update Complete!
echo ======================================
echo.
echo IMPORTANT: 
echo 1. The taskbar icon should now appear sharp and clear
echo 2. If the icon still appears blurry:
echo    - Right-click the taskbar icon and unpin it
echo    - Launch prompd-ide.exe again
echo    - Pin it to the taskbar again
echo 3. You may need to restart Windows for all changes to take effect
echo.
pause