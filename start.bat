@echo off
title Fox Hollow
cd /d "%~dp0"

echo Starting Fox Hollow...
echo Keep this window open while you play. Close it to stop the server.
echo.

set PORT=8765

for /f "tokens=5" %%P in ('netstat -ano ^| findstr /R /C:":%PORT% .*LISTENING"') do (
  echo Replacing the old server on port %PORT%...
  taskkill /PID %%P /F >nul 2>&1
)

set PY=
where python >nul 2>&1
if %errorlevel%==0 (
  set PY=python
) else (
  where py >nul 2>&1
  if %errorlevel%==0 set PY=py
)

if "%PY%"=="" (
  echo Python was not found. Install Python from python.org and try again.
  pause
  exit /b 1
)

start "" cmd /c "timeout /t 1 /nobreak >nul & start http://127.0.0.1:%PORT%/"
%PY% -m http.server %PORT% --bind 127.0.0.1

echo.
echo Server stopped.
pause
