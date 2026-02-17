# YouTube Downloader - YT Ripper

A modern, full-stack YouTube video downloader with a sleek UI and powerful backend.

## Features

- 🎬 Download videos in 1080p and 720p HD quality
- 🎵 Extract audio as MP3
- 🎥 Download video without audio
- 🖼️ Download high-resolution thumbnails
- 📝 Download subtitles in SRT format
- ⚡ Fast downloads with progress tracking
- 🔒 No registration or login required
- 📱 Fully responsive design

## Tech Stack

**Frontend:**
- HTML5, CSS3, JavaScript
- Custom animations and gradient effects
- Google Fonts (Space Mono, DM Sans)

**Backend:**
- Node.js with Express
- yt-dlp (Python tool for downloading)
- CORS enabled for cross-origin requests

## Prerequisites

Before running this application, make sure you have:

1. **Node.js** (v14 or higher)
   - Download from [nodejs.org](https://nodejs.org/)

2. **Python** (v3.6 or higher)
   - Download from [python.org](https://www.python.org/)

3. **yt-dlp** (YouTube downloader)
   ```bash
   pip install yt-dlp
   ```
   Or update if already installed:
   ```bash
   pip install --upgrade yt-dlp
   ```

## Installation

1. **Clone or download this project**

2. **Install Node.js dependencies**
   ```bash
   npm install
   ```

3. **Verify yt-dlp installation**
   ```bash
   yt-dlp --version
   ```
   You should see the version number if installed correctly.

## Running the Application

### Development Mode

1. **Start the backend server**
   ```bash
   npm start
   ```
   Or with auto-restart on changes:
   ```bash
   npm run dev
   ```

   The server will start on `http://localhost:3000`

2. **Open the frontend**
   - If you want to serve the frontend through Express, move `index.html` to a `public` folder
   - Or simply open `index.html` directly in your browser
   - Or use a simple HTTP server:
     ```bash
     # Python 3
     python -m http.server 8000
     
     # Then visit http://localhost:8000
     ```

3. **Update API URL (if needed)**
   - Open `index.html`
   - Find the line: `const API_URL = 'http://localhost:3000';`
   - Change it to your server URL if different

## Project Structure

```
youtube-downloader/
├── server.js           # Express backend server
├── package.json        # Node.js dependencies
├── index.html          # Frontend application
├── downloads/          # Downloaded files (auto-created)
└── README.md          # This file
```

## API Endpoints

### GET `/api/health`
Check if the server is running
```json
{ "status": "ok", "message": "YouTube Downloader API is running" }
```

### POST `/api/video-info`
Get video information
```json
{
  "url": "https://www.youtube.com/watch?v=..."
}
```

### POST `/api/download`
Download video in specified format
```json
{
  "url": "https://www.youtube.com/watch?v=...",
  "format": "1080p" // or "720p", "mp3", "no-audio", "thumbnail", "subtitle"
}
```

### GET `/api/check-ytdlp`
Verify yt-dlp installation

## Configuration

### Change Download Directory
In `server.js`, modify:
```javascript
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
```

### Change Port
In `server.js`, modify:
```javascript
const PORT = process.env.PORT || 3000;
```

Or set environment variable:
```bash
PORT=5000 npm start
```

### File Cleanup
Downloaded files are automatically deleted after 1 hour. Modify in `server.js`:
```javascript
const oneHour = 60 * 60 * 1000; // Change to desired milliseconds
```

## Deployment

### Deploy to Heroku

1. **Create a Heroku app**
   ```bash
   heroku create your-app-name
   ```

2. **Add Python buildpack** (for yt-dlp)
   ```bash
   heroku buildpacks:add --index 1 heroku/python
   heroku buildpacks:add --index 2 heroku/nodejs
   ```

3. **Create `requirements.txt`**
   ```
   yt-dlp
   ```

4. **Create `Procfile`**
   ```
   web: node server.js
   ```

5. **Deploy**
   ```bash
   git push heroku main
   ```

### Deploy to VPS (Ubuntu/Debian)

1. **Install dependencies**
   ```bash
   sudo apt update
   sudo apt install nodejs npm python3 python3-pip ffmpeg
   pip3 install yt-dlp
   ```

2. **Clone your repository**
   ```bash
   git clone <your-repo>
   cd youtube-downloader
   npm install
   ```

3. **Use PM2 for process management**
   ```bash
   npm install -g pm2
   pm2 start server.js --name youtube-downloader
   pm2 save
   pm2 startup
   ```

4. **Setup Nginx reverse proxy**
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

## Troubleshooting

### "yt-dlp not found" error
Install or update yt-dlp:
```bash
pip install --upgrade yt-dlp
```

### Downloads fail with permission error
Make sure the downloads directory is writable:
```bash
chmod 755 downloads/
```

### CORS errors in browser
Make sure the backend server is running and CORS is enabled in `server.js`

### Large video downloads timeout
Increase the buffer size in `server.js`:
```javascript
execAsync(command, { maxBuffer: 1024 * 1024 * 200 }); // 200MB
```

## Legal Notice

This tool is for educational purposes only. Users are responsible for:
- Respecting copyright laws
- Following YouTube's Terms of Service
- Only downloading content they have permission to use
- Complying with local laws regarding content downloads

## License

MIT License - Feel free to use and modify for your projects.

## Contributing

Contributions are welcome! Feel free to:
- Report bugs
- Suggest new features
- Submit pull requests

## Credits

- Built with Express.js and yt-dlp
- Design inspired by modern cyberpunk aesthetics
- Icons: Unicode emojis

---

Made with 💚 | YT Ripper © 2026