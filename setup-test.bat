@echo off
echo ========================================
echo  Setting up CRM for Quick Testing
echo ========================================
echo.

echo Creating environment files...

REM Create server .env
(
echo PORT=5000
echo NODE_ENV=development
echo JWT_SECRET=my_super_secret_jwt_key_12345_test
echo JWT_EXPIRE=7d
echo ADMIN_EMAIL=admin@crm.com
echo ADMIN_PASSWORD=admin123
echo MAX_FILE_SIZE=5242880
) > server\.env

echo ✅ Server .env created

REM Create client .env
(
echo VITE_API_URL=http://localhost:5000/api
) > client\.env

echo ✅ Client .env created
echo.

echo Modifying database config for SQLite...

REM Backup original database config
copy server\config\database.js server\config\database-postgres-backup.js > nul

REM Use SQLite config
copy server\config\database-sqlite.js server\config\database.js > nul

echo ✅ Database configured for SQLite
echo.

echo ========================================
echo  Setup Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Open TWO terminal windows
echo 2. In first terminal: cd server && npm run dev
echo 3. In second terminal: cd client && npm run dev
echo 4. Open browser: http://localhost:3000
echo 5. Login: admin@crm.com / admin123
echo.
pause
