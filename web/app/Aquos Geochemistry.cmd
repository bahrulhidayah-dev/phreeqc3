@echo off
rem Launcher for Aquos Geochemistry: starts the dev server if needed, then opens the browser.
cd /d "%~dp0"

netstat -ano | findstr :5173 | findstr LISTENING >nul
if %errorlevel%==0 goto open

start "Aquos Geochemistry server" /min cmd /c npm run dev

set /a tries=0
:wait
timeout /t 1 /nobreak >nul
netstat -ano | findstr :5173 | findstr LISTENING >nul
if %errorlevel%==0 goto open
set /a tries+=1
if %tries% lss 20 goto wait
echo Server did not start within 20 seconds. Check the "Aquos Geochemistry server" window.
pause
exit /b 1

:open
start "" http://localhost:5173/
