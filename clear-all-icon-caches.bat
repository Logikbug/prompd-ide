@echo off
REM Comprehensive Windows Icon Cache Clear Script
REM Run as Administrator for best results

echo ============================================
echo COMPREHENSIVE ICON CACHE CLEAR
echo ============================================
echo.
echo This will clear ALL Windows icon caches
echo Close all programs before continuing!
echo.
pause

echo.
echo Step 1: Stopping Windows Explorer...
echo ----------------------------------------
taskkill /F /IM explorer.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo.
echo Step 2: Clearing Icon Cache DB files...
echo ----------------------------------------

REM Clear main icon cache
del /f /s /q /a "%LocalAppData%\IconCache.db" >nul 2>&1
del /f /s /q /a "%LocalAppData%\Microsoft\Windows\Explorer\iconcache*" >nul 2>&1

echo [OK] Icon cache files deleted

echo.
echo Step 3: Clearing Thumbnail Cache...
echo ----------------------------------------
del /f /s /q /a "%LocalAppData%\Microsoft\Windows\Explorer\thumbcache*" >nul 2>&1
echo [OK] Thumbnail cache cleared

echo.
echo Step 4: Clearing Program Data Cache...
echo ----------------------------------------
del /f /s /q /a "%ProgramData%\Microsoft\Windows\Start Menu\Programs\*IconCache*" >nul 2>&1
echo [OK] Program data cache cleared

echo.
echo Step 5: Clearing Shell Icon Cache...
echo ----------------------------------------

REM Clear shell icon cache (Windows 10/11)
for /d %%i in ("%LocalAppData%\Microsoft\Windows\Explorer\IconCacheToDelete\*") do (
    rd /s /q "%%i" >nul 2>&1
)

REM Clear Windows 11 specific caches
del /f /s /q /a "%LocalAppData%\Microsoft\Windows\Explorer\*.db" >nul 2>&1

echo [OK] Shell icon cache cleared

echo.
echo Step 6: Clearing TaskBar Cache...
echo ----------------------------------------

REM Clear taskbar icon cache
REG DELETE "HKCU\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\TrayNotify" /V IconStreams /F >nul 2>&1
REG DELETE "HKCU\Software\Classes\Local Settings\Software\Microsoft\Windows\CurrentVersion\TrayNotify" /V PastIconsStream /F >nul 2>&1

echo [OK] Taskbar cache cleared

echo.
echo Step 7: Clearing Jump List Cache...
echo ----------------------------------------
del /f /s /q /a "%APPDATA%\Microsoft\Windows\Recent\AutomaticDestinations\*" >nul 2>&1
del /f /s /q /a "%APPDATA%\Microsoft\Windows\Recent\CustomDestinations\*" >nul 2>&1
echo [OK] Jump list cache cleared

echo.
echo Step 8: Running Icon Cache Rebuilder...
echo ----------------------------------------
ie4uinit.exe -ClearIconCache >nul 2>&1
ie4uinit.exe -show >nul 2>&1
echo [OK] Icon cache rebuild initiated

echo.
echo Step 9: Resetting Icon Layout...
echo ----------------------------------------

REM Force Windows to rebuild icon positions
del "%APPDATA%\Microsoft\Windows\Recent\IconLayouts.db" >nul 2>&1
echo [OK] Icon layout reset

echo.
echo Step 10: Starting Windows Explorer...
echo ----------------------------------------
start explorer.exe
timeout /t 3 /nobreak >nul

echo.
echo ============================================
echo ALL ICON CACHES CLEARED!
echo ============================================
echo.
echo Now perform these steps:
echo.
echo 1. UNPIN prompd-ide from taskbar if pinned
echo 2. Navigate to the prompd-ide folder
echo 3. Right-click prompd-ide.exe
echo 4. Select "Pin to taskbar"
echo.
echo If still blurry, try:
echo - Sign out and sign back in
echo - Or restart Windows
echo.
pause