@echo off
title Fox Hollow
cd /d "%~dp0"

echo Starting Fox Hollow...
echo Keep this window open while you play. Close it to stop the server.
echo.

start "" "http://127.0.0.1:8765/"

where python >nul 2>&1
if %errorlevel%==0 (
  python -m http.server 8765
) else (
  py -m http.server 8765
)

echo.
echo Server stopped.
pause
