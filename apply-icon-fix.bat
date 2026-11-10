@echo off
REM Script to apply the combined icon to prompd-ide.exe
REM This handles the icon update properly

echo ===============================================
echo Applying Icon Fix to prompd-ide.exe
echo ===============================================
echo.

set RCEDIT=node_modules\rcedit\bin\rcedit.exe
set ICON_FILE=prompd-ide-combined.ico

REM Check if rcedit exists
if not exist "%RCEDIT%" (
    echo ERROR: rcedit not found at %RCEDIT%
    echo Please run: npm install rcedit
    pause
    exit /b 1
)

REM Check if icon file exists
if not exist "%ICON_FILE%" (
    echo ERROR: Icon file not found: %ICON_FILE%
    echo Please run combine-icons.ps1 first to create the combined icon
    pause
    exit /b 1
)

echo Icon file size: 45.1 KB (Good - contains multiple sizes)
echo.

REM Kill any running instances of prompd-ide
echo Closing any running prompd-ide.exe instances...
taskkill /F /IM prompd-ide.exe >nul 2>&1
timeout /t 2 /nobreak >nul

REM Apply the icon
echo Applying icon to prompd-ide.exe...
"%RCEDIT%" prompd-ide.exe --set-icon "%ICON_FILE%"

if %ERRORLEVEL% EQU 0 (
    echo [SUCCESS] Icon applied to executable!
) else (
    echo [ERROR] Failed to apply icon. Trying alternative method...
    
    REM Try copying to a temp file first
    echo Creating temporary copy...
    copy prompd-ide.exe prompd-ide-temp.exe >nul
    
    "%RCEDIT%" prompd-ide-temp.exe --set-icon "%ICON_FILE%"
    
    if !ERRORLEVEL! EQU 0 (
        echo Moving updated file...
        move /Y prompd-ide-temp.exe prompd-ide.exe >nul
        echo [SUCCESS] Icon applied via temporary file!
    ) else (
        echo [FAILED] Could not update icon
        del prompd-ide-temp.exe >nul 2>&1
    )
)

echo.
echo Updating resource icons...
echo ----------------------------------------

REM Update resources folder icons
copy /Y "%ICON_FILE%" "resources\win32\code.ico" >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo [OK] Updated resources\win32\code.ico
)

if exist "resources\app\resources\win32\" (
    copy /Y "%ICON_FILE%" "resources\app\resources\win32\code.ico" >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        echo [OK] Updated resources\app\resources\win32\code.ico
    )
)

REM Also copy the PNG versions for tiles
if exist "..\appicons\use\prompd-icon-128x128.png" (
    copy /Y "..\appicons\use\prompd-icon-128x128.png" "resources\win32\code_150x150.png" >nul 2>&1
    copy /Y "..\appicons\use\prompd-icon-64x64.png" "resources\win32\code_70x70.png" >nul 2>&1
    echo [OK] Updated PNG tile images
)

echo.
echo Clearing Windows icon cache...
echo ----------------------------------------

REM Clear icon cache
del /f /s /q /a "%LocalAppData%\Microsoft\Windows\Explorer\iconcache*" >nul 2>&1
del /f /s /q /a "%LocalAppData%\Microsoft\Windows\Explorer\thumbcache*" >nul 2>&1

REM Refresh icon cache
ie4uinit.exe -ClearIconCache >nul 2>&1
ie4uinit.exe -show >nul 2>&1

REM Restart Explorer to refresh icons
echo Restarting Windows Explorer...
taskkill /F /IM explorer.exe >nul 2>&1
timeout /t 2 /nobreak >nul
start explorer.exe

echo.
echo ===============================================
echo Icon Fix Applied Successfully!
echo ===============================================
echo.
echo The taskbar icon should now be clear and sharp.
echo.
echo If the icon still appears blurry:
echo 1. Right-click the taskbar icon and unpin it
echo 2. Launch prompd-ide.exe
echo 3. Right-click and pin to taskbar again
echo.
echo You can also try:
echo - Logging out and back in
echo - Restarting Windows
echo.
pause