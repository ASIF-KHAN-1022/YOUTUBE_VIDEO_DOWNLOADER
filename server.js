const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // Serve frontend files

// Create downloads directory if it doesn't exist
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR);
}

// Clean up old files (older than 1 hour)
function cleanupOldFiles() {
    const files = fs.readdirSync(DOWNLOADS_DIR);
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;

    files.forEach(file => {
        const filePath = path.join(DOWNLOADS_DIR, file);
        const stats = fs.statSync(filePath);
        if (now - stats.mtimeMs > oneHour) {
            fs.unlinkSync(filePath);
            console.log(`Cleaned up old file: ${file}`);
        }
    });
}

// Run cleanup every 30 minutes
setInterval(cleanupOldFiles, 30 * 60 * 1000);

// Validate YouTube URL
function isValidYouTubeUrl(url) {
    const patterns = [
        /^(https?:\/\/)?(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /^(https?:\/\/)?(www\.)?youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
    ];
    return patterns.some(pattern => pattern.test(url));
}

// Extract video ID from URL
function extractVideoId(url) {
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
        /youtube\.com\/v\/([a-zA-Z0-9_-]{11})/
    ];
    
    for (let pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// Sanitize filename
function sanitizeFilename(filename) {
    return filename.replace(/[^a-z0-9_\-\.]/gi, '_');
}

// Get format string for yt-dlp based on user selection
function getFormatString(format) {
    switch(format) {
        case '1080p':
            // Download best video up to 1080p and best audio, then merge
            // Always merge video and audio into mp4
            return 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]';
        case '720p':
            // Download best video up to 720p and best audio, then merge
            // Always merge video and audio into mp4
            return 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]';
        case 'mp3':
            return 'bestaudio[ext=m4a]/bestaudio';
        case 'no-audio':
            return 'bestvideo[ext=mp4]/bestvideo';
        default:
            return 'best[ext=mp4]/best';
    }
}

// API endpoint to get video info
app.post('/api/video-info', async (req, res) => {
    try {
        const { url } = req.body;

        if (!url || !isValidYouTubeUrl(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        // Get video info using yt-dlp
        const command = `yt-dlp --dump-json "${url}"`;
        const { stdout } = await execAsync(command);
        const videoInfo = JSON.parse(stdout);

        res.json({
            title: videoInfo.title,
            duration: videoInfo.duration,
            thumbnail: videoInfo.thumbnail,
            uploader: videoInfo.uploader,
            view_count: videoInfo.view_count
        });

    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: 'Failed to fetch video information' });
    }
});

// API endpoint to download video with progress tracking
app.post('/api/download', async (req, res) => {
    try {
        const { url, format } = req.body;

        if (!url || !isValidYouTubeUrl(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        if (!format) {
            return res.status(400).json({ error: 'Format is required' });
        }

        const videoId = extractVideoId(url);
        const timestamp = Date.now();
        const outputTemplate = path.join(DOWNLOADS_DIR, `${videoId}_${timestamp}.%(ext)s`);

        let command;
        let expectedExtension;

        // Handle different format types
        if (format === 'thumbnail') {
            command = `yt-dlp --write-thumbnail --skip-download --convert-thumbnails jpg -o "${outputTemplate}" "${url}"`;
            expectedExtension = 'jpg';
        } else if (format === 'subtitle') {
            command = `yt-dlp --write-auto-sub --sub-lang en --skip-download --convert-subs srt -o "${outputTemplate}" "${url}"`;
            expectedExtension = 'srt';
        } else if (format === 'mp3') {
            // For MP3, download best audio and convert
            command = `yt-dlp -f "bestaudio" -x --audio-format mp3 --audio-quality 0 -o "${outputTemplate}" "${url}"`;
            expectedExtension = 'mp3';
        } else if (format === 'no-audio') {
            // Video only, no audio
            command = `yt-dlp -f "bestvideo[ext=mp4]" -o "${outputTemplate}" "${url}"`;
            expectedExtension = 'mp4';
        } else {
            // For video formats (1080p, 720p) - merge video and audio
            const formatString = getFormatString(format);
            // Force ffmpeg merging with absolute path
            // const ffmpegPath = 'C:\\Users\\Dell 5330\\Downloads\\ffmpeg-master-latest-win64-gpl-shared\\ffmpeg-master-latest-win64-gpl-shared\\bin\\ffmpeg.exe';
            //yt-dlp -f "${formatString}" --merge-output-format mp4 -o "${outputTemplate}" "${url}"
            // command = `yt-dlp -f "${formatString}" --merge-output-format mp4 --ffmpeg-location "${ffmpegPath}" -o "${outputTemplate}" "${url}"`;
            command = `yt-dlp -f "${formatString}" --merge-output-format mp4 -o "${outputTemplate}" "${url}"`;
            expectedExtension = 'mp4';
        // Check if ffmpeg is installed
        app.get('/api/check-ffmpeg', async (req, res) => {
            try {
                const { stdout } = await execAsync('ffmpeg -version');
                res.json({ installed: true, version: stdout.split('\n')[0] });
            } catch (error) {
                res.json({ installed: false, error: 'ffmpeg is not installed' });
            }
        });
        }

        console.log('Executing command:', command);

        // Execute yt-dlp command
        await execAsync(command, { maxBuffer: 1024 * 1024 * 200 }); // Increased buffer to 200MB

        // Wait a moment for file system to sync
        await new Promise(resolve => setTimeout(resolve, 500));

        // Find the downloaded file - look for the expected extension
        const files = fs.readdirSync(DOWNLOADS_DIR);
        const downloadedFile = files.find(file => 
            file.startsWith(`${videoId}_${timestamp}`) && file.endsWith(`.${expectedExtension}`)
        );

        if (!downloadedFile) {
            console.error('Downloaded files:', files.filter(f => f.startsWith(`${videoId}_${timestamp}`)));
            return res.status(500).json({ error: 'File download failed - file not found' });
        }

        const filePath = path.join(DOWNLOADS_DIR, downloadedFile);
        console.log('Sending file:', filePath);
        
        // Set proper headers
        res.setHeader('Content-Disposition', `attachment; filename="${downloadedFile}"`);
        res.setHeader('Content-Type', 'application/octet-stream');
        
        // Send file to client
        const fileStream = fs.createReadStream(filePath);
        
        fileStream.on('error', (err) => {
            console.error('Stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream file' });
            }
        });

        fileStream.on('end', () => {
            console.log('File sent successfully:', downloadedFile);
            // Delete file after 30 seconds (gives time for download to complete)
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`Cleaned up file: ${downloadedFile}`);
                }
            }, 30000); // 30 seconds
        });

        fileStream.pipe(res);

    } catch (error) {
        console.error('Error downloading video:', error);
        if (!res.headersSent) {
            res.status(500).json({ 
                error: 'Failed to download video',
                details: error.message 
            });
        }
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'YouTube Downloader API is running' });
});

// Check if yt-dlp is installed
app.get('/api/check-ytdlp', async (req, res) => {
    try {
        const { stdout } = await execAsync('yt-dlp --version');
        res.json({ 
            installed: true, 
            version: stdout.trim() 
        });
    } catch (error) {
        res.json({ 
            installed: false, 
            error: 'yt-dlp is not installed' 
        });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`YouTube Downloader API running on http://localhost:${PORT}`);
    console.log('Make sure yt-dlp is installed: pip install yt-dlp');
    
    // Check if yt-dlp is available
    exec('yt-dlp --version', (error) => {
        if (error) {
            console.warn('⚠️  Warning: yt-dlp not found! Install it with: pip install yt-dlp');
        } else {
            console.log('✓ yt-dlp is installed and ready');
        }
    });
});