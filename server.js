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
app.use(express.static('public'));

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

setInterval(cleanupOldFiles, 30 * 60 * 1000);

// ─── Platform Detection ───────────────────────────────────────────────────────

function detectPlatform(url) {
    if (/youtube\.com\/shorts\//.test(url)) return 'youtube_shorts';
    if (/youtube\.com\/watch|youtu\.be\//.test(url)) return 'youtube';
    if (/instagram\.com\/(reel|p|tv)\//.test(url)) return 'instagram';
    if (/tiktok\.com\//.test(url)) return 'tiktok';
    return null;
}

function isValidUrl(url) {
    return detectPlatform(url) !== null;
}

function extractId(url, platform) {
    switch (platform) {
        case 'youtube':
        case 'youtube_shorts': {
            const match = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
            return match ? match[1] : `yt_${Date.now()}`;
        }
        case 'instagram': {
            const match = url.match(/instagram\.com\/(?:reel|p|tv)\/([A-Za-z0-9_-]+)/);
            return match ? match[1] : `ig_${Date.now()}`;
        }
        case 'tiktok': {
            const match = url.match(/tiktok\.com\/.*\/video\/(\d+)/);
            return match ? match[1] : `tt_${Date.now()}`;
        }
        default:
            return `dl_${Date.now()}`;
    }
}

// ─── Format String ────────────────────────────────────────────────────────────

function getFormatString(format, platform) {
    // Instagram and TikTok: always best quality
    if (platform === 'instagram' || platform === 'tiktok') {
        if (format === 'mp3') return 'bestaudio';
        return 'best[ext=mp4]/best';
    }

    // YouTube / Shorts
    switch (format) {
        case '1080p':
            return 'bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=1080]+bestaudio/best[height<=1080]';
        case '720p':
            return 'bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/bestvideo[height<=720]+bestaudio/best[height<=720]';
        case 'mp3':
            return 'bestaudio[ext=m4a]/bestaudio';
        default:
            return 'best[ext=mp4]/best';
    }
}

// ─── API: Detect Platform ─────────────────────────────────────────────────────

app.post('/api/detect-platform', (req, res) => {
    const { url } = req.body;
    if (!url) return res.status(400).json({ error: 'URL is required' });

    const platform = detectPlatform(url);
    if (!platform) return res.status(400).json({ error: 'Unsupported URL' });

    const labels = {
        youtube: 'YouTube',
        youtube_shorts: 'YouTube Shorts',
        instagram: 'Instagram',
        tiktok: 'TikTok'
    };

    res.json({ platform, label: labels[platform] });
});

// ─── API: Video Info ──────────────────────────────────────────────────────────

app.post('/api/video-info', async (req, res) => {
    try {
        const { url } = req.body;
        if (!url || !isValidUrl(url)) {
            return res.status(400).json({ error: 'Invalid or unsupported URL' });
        }

        const command = `yt-dlp --dump-json "${url}"`;
        const { stdout } = await execAsync(command, { timeout: 30000 });
        const videoInfo = JSON.parse(stdout);

        res.json({
            title: videoInfo.title || 'Unknown Title',
            duration: videoInfo.duration || 0,
            thumbnail: videoInfo.thumbnail || '',
            uploader: videoInfo.uploader || videoInfo.channel || 'Unknown',
            view_count: videoInfo.view_count || 0,
            platform: detectPlatform(url)
        });
    } catch (error) {
        console.error('Error fetching video info:', error);
        res.status(500).json({ error: 'Failed to fetch video information' });
    }
});

// ─── API: Download ────────────────────────────────────────────────────────────

app.post('/api/download', async (req, res) => {
    try {
        const { url, format } = req.body;

        if (!url || !isValidUrl(url)) {
            return res.status(400).json({ error: 'Invalid or unsupported URL' });
        }
        if (!format) {
            return res.status(400).json({ error: 'Format is required' });
        }

        const platform = detectPlatform(url);
        const videoId = extractId(url, platform);
        const timestamp = Date.now();
        const outputTemplate = path.join(DOWNLOADS_DIR, `${videoId}_${timestamp}.%(ext)s`);

        let command;
        let expectedExtension;

        if (format === 'thumbnail') {
            command = `yt-dlp --write-thumbnail --skip-download --convert-thumbnails jpg -o "${outputTemplate}" "${url}"`;
            expectedExtension = 'jpg';
        } else if (format === 'subtitle') {
            command = `yt-dlp --write-auto-sub --sub-lang en --skip-download --convert-subs srt -o "${outputTemplate}" "${url}"`;
            expectedExtension = 'srt';
        } else if (format === 'mp3') {
            command = `yt-dlp -f "bestaudio" -x --audio-format mp3 --audio-quality 0 -o "${outputTemplate}" "${url}"`;
            expectedExtension = 'mp3';
        } else {
            // Video formats (1080p, 720p, best)
            const formatString = getFormatString(format, platform);
            command = `yt-dlp -f "${formatString}" --merge-output-format mp4 -o "${outputTemplate}" "${url}"`;
            expectedExtension = 'mp4';
        }

        console.log(`[${platform}] Executing:`, command);
        await execAsync(command, { maxBuffer: 1024 * 1024 * 200, timeout: 300000 });

        // Wait for filesystem sync
        await new Promise(resolve => setTimeout(resolve, 500));

        const files = fs.readdirSync(DOWNLOADS_DIR);
        const downloadedFile = files.find(file =>
            file.startsWith(`${videoId}_${timestamp}`) && file.endsWith(`.${expectedExtension}`)
        );

        if (!downloadedFile) {
            console.error('Expected file not found. Files:', files.filter(f => f.startsWith(`${videoId}_${timestamp}`)));
            return res.status(500).json({ error: 'File download failed - file not found' });
        }

        const filePath = path.join(DOWNLOADS_DIR, downloadedFile);
        console.log('Sending file:', filePath);

        res.setHeader('Content-Disposition', `attachment; filename="${downloadedFile}"`);
        res.setHeader('Content-Type', 'application/octet-stream');

        const fileStream = fs.createReadStream(filePath);

        fileStream.on('error', (err) => {
            console.error('Stream error:', err);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Failed to stream file' });
            }
        });

        fileStream.on('end', () => {
            console.log('File sent successfully:', downloadedFile);
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                    console.log(`Cleaned up: ${downloadedFile}`);
                }
            }, 30000);
        });

        fileStream.pipe(res);

    } catch (error) {
        console.error('Download error:', error);
        if (!res.headersSent) {
            res.status(500).json({
                error: 'Failed to download video',
                details: error.message
            });
        }
    }
});

// ─── Health & Diagnostics ─────────────────────────────────────────────────────

app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', message: 'Multi-Platform Downloader API is running' });
});

app.get('/api/check-ytdlp', async (req, res) => {
    try {
        const { stdout } = await execAsync('yt-dlp --version');
        res.json({ installed: true, version: stdout.trim() });
    } catch {
        res.json({ installed: false, error: 'yt-dlp is not installed' });
    }
});

app.get('/api/check-ffmpeg', async (req, res) => {
    try {
        const { stdout } = await execAsync('ffmpeg -version');
        res.json({ installed: true, version: stdout.split('\n')[0] });
    } catch {
        res.json({ installed: false, error: 'ffmpeg is not installed' });
    }
});

// ─── Start Server ─────────────────────────────────────────────────────────────

app.listen(PORT, '0.0.0.0', () => {
    console.log(`Multi-Platform Downloader running on http://localhost:${PORT}`);
    console.log('Supported: YouTube, YouTube Shorts, Instagram Reels, TikTok');

    exec('yt-dlp --version', (error, stdout) => {
        if (error) {
            console.warn('⚠️  yt-dlp not found! Install: pip install yt-dlp');
        } else {
            console.log(`✓ yt-dlp ${stdout.trim()} ready`);
        }
    });

    exec('ffmpeg -version', (error) => {
        if (error) {
            console.warn('⚠️  ffmpeg not found! Install ffmpeg for video merging.');
        } else {
            console.log('✓ ffmpeg ready');
        }
    });
});