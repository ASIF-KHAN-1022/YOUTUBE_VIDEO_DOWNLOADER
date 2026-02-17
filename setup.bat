@echo off
echo ================================
echo YouTube Downloader Setup Script
echo ================================
echo.

REM Check if Node.js is installed
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X Node.js is not installed. Please install Node.js first.
    echo   Download from: https://nodejs.org/
    pause
    exit /b 1
) else (
    echo + Node.js is installed
    node --version
)

REM Check if npm is installed
where npm >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X npm is not installed. Please install npm first.
    pause
    exit /b 1
) else (
    echo + npm is installed
    npm --version
)

REM Check if Python is installed
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo X Python is not installed. Please install Python first.
    echo   Download from: https://www.python.org/
    pause
    exit /b 1
) else (
    echo + Python is installed
    python --version
)

echo.
echo Installing Node.js dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo X Failed to install Node.js dependencies
    pause
    exit /b 1
)
echo + Node.js dependencies installed

echo.
echo Installing Python dependencies (yt-dlp)...
call pip install -r requirements.txt
if %ERRORLEVEL% NEQ 0 (
    echo X Failed to install Python dependencies
    pause
    exit /b 1
)
echo + Python dependencies installed

echo.
echo Verifying yt-dlp installation...
where yt-dlp >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo ! Warning: yt-dlp command not found in PATH
    echo   Try running: pip install --user yt-dlp
) else (
    echo + yt-dlp is installed
    yt-dlp --version
)

echo.
echo Creating downloads directory...
if not exist "downloads" mkdir downloads
echo + Downloads directory created

echo.
echo ==========================================
echo Setup complete!
echo.
echo To start the server, run:
echo   npm start
echo.
echo Or for development with auto-reload:
echo   npm run dev
echo.
echo Then open index.html in your browser
echo ==========================================
echo.
pause