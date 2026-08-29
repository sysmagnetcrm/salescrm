@echo off
echo ========================================
echo  Lead Distribution CRM - Quick Start
echo ========================================
echo.

echo Checking if dependencies are installed...
echo.

cd server
if not exist "node_modules" (
    echo Installing server dependencies...
    call npm install
) else (
    echo Server dependencies already installed.
)
echo.

cd ../client
if not exist "node_modules" (
    echo Installing client dependencies...
    call npm install
) else (
    echo Client dependencies already installed.
)
echo.

cd ..

echo ========================================
echo  Starting CRM Application
echo ========================================
echo.
echo Backend will run on: http://localhost:5000
echo Frontend will run on: http://localhost:3000
echo.
echo Press Ctrl+C to stop the servers
echo.

start cmd /k "cd server && npm run dev"
timeout /t 3 /nobreak > nul
start cmd /k "cd client && npm run dev"

echo.
echo ========================================
echo  Servers are starting...
echo  Check the new terminal windows
echo ========================================
echo.
pause
