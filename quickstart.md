# 🚀 Quick Start Guide

Get your YouTube Downloader running in 5 minutes!

## Prerequisites

You need to have these installed on your system:

1. **Node.js** (v14 or higher) - [Download here](https://nodejs.org/)
2. **Python** (v3.6 or higher) - [Download here](https://www.python.org/)

## Option 1: Automated Setup (Recommended)

### On Windows:
```bash
setup.bat
```

### On Mac/Linux:
```bash
chmod +x setup.sh
./setup.sh
```

The script will automatically:
- Check if Node.js and Python are installed
- Install all npm packages
- Install yt-dlp (YouTube downloader)
- Create necessary directories
- Verify everything is working

## Option 2: Manual Setup

### Step 1: Install Dependencies

```bash
# Install Node.js packages
npm install

# Install yt-dlp (YouTube downloader)
pip install yt-dlp

# OR on some systems:
pip3 install yt-dlp
```

### Step 2: Create Downloads Folder

```bash
mkdir downloads
```

## Running the Application

### Start the Backend Server

```bash
npm start
```

The server will start on `http://localhost:3000`

You should see:
```
YouTube Downloader API running on http://localhost:3000
✓ yt-dlp is installed and ready
```

### Open the Frontend

**Option A: Direct file access**
- Simply double-click `index.html` to open it in your browser

**Option B: Serve through Express**
1. Create a `public` folder
2. Move `index.html` into the `public` folder
3. Update `server.js` to serve static files (already configured)
4. Visit `http://localhost:3000`

**Option C: Use a simple HTTP server**
```bash
# Python 3
python -m http.server 8000

# Then visit http://localhost:8000
```

## Testing It Out

1. **Copy a YouTube URL**
   - Example: `https://www.youtube.com/watch?v=dQw4w9WgXcQ`

2. **Paste it into the input field**
   - The app will automatically fetch video info
   - You'll see a preview with thumbnail and details

3. **Choose your format**
   - 1080p HD Video
   - 720p HD Video
   - MP3 Audio
   - Video without Audio
   - Thumbnail Image
   - Subtitles (SRT)

4. **Click "Download Now"**
   - Wait for processing
   - File will automatically download to your browser's download folder

## Troubleshooting

### "yt-dlp not found" error

**Solution:**
```bash
pip install --upgrade yt-dlp

# Or if you need to add it to PATH:
pip install --user yt-dlp
```

### Backend server won't start

**Check if port 3000 is already in use:**
```bash
# Windows
netstat -ano | findstr :3000

# Mac/Linux
lsof -i :3000
```

**Change the port in server.js:**
```javascript
const PORT = 5000; // Or any other port
```

### CORS errors in browser

Make sure:
1. Backend server is running (`npm start`)
2. Update the API_URL in `index.html` if you changed the port:
   ```javascript
   const API_URL = 'http://localhost:3000';
   ```

### Downloads fail

1. **Check yt-dlp version:**
   ```bash
   yt-dlp --version
   ```

2. **Update yt-dlp:**
   ```bash
   pip install --upgrade yt-dlp
   ```

3. **Check if ffmpeg is installed** (needed for some formats):
   ```bash
   # Mac
   brew install ffmpeg

   # Ubuntu/Debian
   sudo apt install ffmpeg

   # Windows
   # Download from https://ffmpeg.org/
   ```

## Project Structure

```
youtube-downloader/
├── index.html          # Frontend UI
├── server.js           # Backend API
├── package.json        # Node.js dependencies
├── requirements.txt    # Python dependencies
├── downloads/          # Downloaded files (auto-created)
├── setup.sh           # Mac/Linux setup script
├── setup.bat          # Windows setup script
├── README.md          # Full documentation
└── QUICKSTART.md      # This file
```

## Next Steps

- Read `README.md` for deployment options (Heroku, VPS, etc.)
- Customize the design in `index.html`
- Add authentication if needed
- Implement rate limiting for production use

## Common Use Cases

### Download Music Videos as MP3
1. Paste YouTube music video URL
2. Select "MP3 Audio" format
3. Download

### Save Video for Offline Viewing
1. Paste YouTube video URL
2. Select "1080p HD" or "720p HD"
3. Download

### Get Video Thumbnail
1. Paste YouTube video URL
2. Select "Thumbnail" format
3. Download high-res image

### Download Subtitles
1. Paste YouTube video URL
2. Select "Subtitles" format
3. Download SRT file

## Support

If you encounter issues:
1. Check the console (F12 in browser) for errors
2. Check the terminal where `npm start` is running
3. Ensure all prerequisites are installed
4. Try updating yt-dlp: `pip install --upgrade yt-dlp`

---

**Happy Downloading! 🎉**

Made with 💚 | YT Ripper © 2026