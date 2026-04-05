@echo off
REM Start backend and frontend services

echo ==========================================
echo Starting Student LMS...
echo ==========================================
echo.

REM Start backend in a new window
echo Starting Backend Server on http://localhost:3000...
start "Backend Server" cmd /k npm start

REM Wait a moment for backend to start
timeout /t 2 /nobreak

REM Start frontend in a new window
echo Starting Frontend on http://localhost:5000...
start "Frontend Server" cmd /k npm run frontend

echo.
echo ==========================================
echo Both services are now running!
echo Backend: http://localhost:3000
echo Frontend: http://localhost:5000
echo ==========================================
