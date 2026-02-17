#!/bin/bash

echo "🚀 YouTube Downloader Setup Script"
echo "=================================="
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    echo "   Download from: https://nodejs.org/"
    exit 1
else
    echo "✓ Node.js is installed ($(node --version))"
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
else
    echo "✓ npm is installed ($(npm --version))"
fi

# Check if Python is installed
if ! command -v python3 &> /dev/null && ! command -v python &> /dev/null; then
    echo "❌ Python is not installed. Please install Python first."
    echo "   Download from: https://www.python.org/"
    exit 1
else
    if command -v python3 &> /dev/null; then
        echo "✓ Python is installed ($(python3 --version))"
    else
        echo "✓ Python is installed ($(python --version))"
    fi
fi

# Install Node.js dependencies
echo ""
echo "📦 Installing Node.js dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install Node.js dependencies"
    exit 1
fi
echo "✓ Node.js dependencies installed"

# Install Python dependencies
echo ""
echo "📦 Installing Python dependencies (yt-dlp)..."
if command -v pip3 &> /dev/null; then
    pip3 install -r requirements.txt
elif command -v pip &> /dev/null; then
    pip install -r requirements.txt
else
    echo "❌ pip is not installed. Please install pip first."
    exit 1
fi

if [ $? -ne 0 ]; then
    echo "❌ Failed to install Python dependencies"
    exit 1
fi
echo "✓ Python dependencies installed"

# Verify yt-dlp installation
echo ""
echo "🔍 Verifying yt-dlp installation..."
if command -v yt-dlp &> /dev/null; then
    echo "✓ yt-dlp is installed ($(yt-dlp --version))"
else
    echo "⚠️  Warning: yt-dlp command not found in PATH"
    echo "   Try running: pip3 install --user yt-dlp"
    echo "   Or: pip3 install --upgrade yt-dlp"
fi

# Create downloads directory
echo ""
echo "📁 Creating downloads directory..."
mkdir -p downloads
echo "✓ Downloads directory created"

echo ""
echo "=========================================="
echo "✅ Setup complete!"
echo ""
echo "To start the server, run:"
echo "  npm start"
echo ""
echo "Or for development with auto-reload:"
echo "  npm run dev"
echo ""
echo "Then open index.html in your browser"
echo "=========================================="