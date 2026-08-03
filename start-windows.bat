@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>&1
if errorlevel 1 (
  echo Node.js was not found. Install Node.js 20.19+ or a current LTS version, then run this file again.
  pause
  exit /b 1
)
if not exist node_modules (
  echo Installing dependencies for first run...
  call npm install
  if errorlevel 1 (
    echo npm install failed.
    pause
    exit /b 1
  )
)
echo Starting PlantUML Local Studio...
call npm run dev
