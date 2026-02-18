const express = require('express');
const { exec } = require('child_process');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { promisify } = require('util');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 3000;

// ─── Admin Password (change this!) ───────────────────────────────────────────
const ADMIN_PASSWORD = 'admin1234';

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Create downloads directory if it doesn't exist
const DOWNLOADS_DIR = path.join(__dirname, 'downloads');
if (!fs.existsSync(DOWNLOADS_DIR)) {
    fs.mkdirSync(DOWNLOADS_DIR);
}

// ─── Logging Setup ────────────────────────────────────────────────────────────

const LOGS_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR);

function getLogFilePath() {
    const date = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
    return path.join(LOGS_DIR, `activity-${date}.log`);
}

function parseUserAgent(ua) {
    if (!ua) return { browser: 'Unknown', os: 'Unknown', device: 'Unknown' };

    let browser = 'Unknown';
    let os      = 'Unknown';
    let device  = 'Desktop';

    // Browser
    if      (/Edg\//.test(ua))             browser = 'Edge';
    else if (/OPR\/|Opera/.test(ua))       browser = 'Opera';
    else if (/SamsungBrowser/.test(ua))    browser = 'Samsung Browser';
    else if (/Chrome\//.test(ua))          browser = 'Chrome';
    else if (/Firefox\//.test(ua))         browser = 'Firefox';
    else if (/Safari\//.test(ua) && !/Chrome/.test(ua)) browser = 'Safari';

    // OS / Device
    if (/iPhone/.test(ua)) {
        os = 'iOS';
        device = 'iPhone';
        const m = ua.match(/iPhone OS ([\d_]+)/);
        if (m) os = `iOS ${m[1].replace(/_/g, '.')}`;
    } else if (/iPad/.test(ua)) {
        os = 'iOS';
        device = 'iPad';
    } else if (/Android/.test(ua)) {
        os = 'Android';
        device = 'Mobile';
        // Try to extract phone model — e.g. "Samsung SM-G991B" or "Redmi Note 10"
        const m = ua.match(/Android[\s/][\d.]+;\s([^)]+)\)/);
        if (m) {
            const raw = m[1].trim();
            // Filter out build IDs (usually all-caps + digits)
            const model = raw.split(';').map(s => s.trim()).find(s => !/^[A-Z0-9_.-]+$/.test(s) || s.includes(' '));
            device = model || raw;
        }
    } else if (/Windows NT/.test(ua)) {
        const m = ua.match(/Windows NT ([\d.]+)/);
        const ver = { '10.0': '10/11', '6.3': '8.1', '6.2': '8', '6.1': '7' }[m?.[1]] || m?.[1] || '';
        os = `Windows ${ver}`.trim();
        device = 'Desktop';
    } else if (/Mac OS X/.test(ua)) {
        const m = ua.match(/Mac OS X ([\d_]+)/);
        os = `macOS ${(m?.[1] || '').replace(/_/g, '.')}`.trim();
        device = 'Desktop/Mac';
    } else if (/Linux/.test(ua)) {
        os = 'Linux';
        device = 'Desktop';
    }

    return { browser, os, device };
}

function getClientIP(req) {
    return (
        req.headers['x-forwarded-for']?.split(',')[0].trim() ||
        req.headers['x-real-ip'] ||
        req.socket?.remoteAddress ||
        'Unknown'
    );
}

function writeLog(entry) {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const line = `[${timestamp}] ${entry}\n`;
    fs.appendFileSync(getLogFilePath(), line, 'utf8');
    console.log(line.trim());
}

function logActivity(req, event, data = {}) {
    const ip      = getClientIP(req);
    const ua      = req.headers['user-agent'] || '';
    const { browser, os, device } = parseUserAgent(ua);

    const parts = [
        `EVENT=${event}`,
        `IP=${ip}`,
        `DEVICE=${device}`,
        `OS=${os}`,
        `BROWSER=${browser}`,
        ...Object.entries(data).map(([k, v]) => `${k.toUpperCase()}=${v}`)
    ];

    writeLog(parts.join(' | '));
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

    // Log every URL pasted
    logActivity(req, 'URL_PASTED', { platform, url });

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

        logActivity(req, 'VIDEO_INFO', {
            platform: detectPlatform(url),
            title: (videoInfo.title || '').slice(0, 80).replace(/\|/g, '-'),
            url
        });

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
        logActivity(req, 'DOWNLOAD_START', { platform, format, url });

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
            const formatString = getFormatString(format, platform);
            command = `yt-dlp -f "${formatString}" --merge-output-format mp4 -o "${outputTemplate}" "${url}"`;
            expectedExtension = 'mp4';
        }

        console.log(`[${platform}] Executing:`, command);
        await execAsync(command, { maxBuffer: 1024 * 1024 * 200, timeout: 300000 });

        await new Promise(resolve => setTimeout(resolve, 500));

        const files = fs.readdirSync(DOWNLOADS_DIR);
        const downloadedFile = files.find(file =>
            file.startsWith(`${videoId}_${timestamp}`) && file.endsWith(`.${expectedExtension}`)
        );

        if (!downloadedFile) {
            logActivity(req, 'DOWNLOAD_FAILED', { platform, format, url, reason: 'file_not_found' });
            return res.status(500).json({ error: 'File download failed - file not found' });
        }

        const filePath = path.join(DOWNLOADS_DIR, downloadedFile);
        const fileSizeMB = (fs.statSync(filePath).size / (1024 * 1024)).toFixed(2);

        res.setHeader('Content-Disposition', `attachment; filename="${downloadedFile}"`);
        res.setHeader('Content-Type', 'application/octet-stream');

        const fileStream = fs.createReadStream(filePath);

        fileStream.on('error', (err) => {
            console.error('Stream error:', err);
            if (!res.headersSent) res.status(500).json({ error: 'Failed to stream file' });
        });

        fileStream.on('end', () => {
            logActivity(req, 'DOWNLOAD_SUCCESS', { platform, format, size_mb: fileSizeMB, url });
            setTimeout(() => {
                if (fs.existsSync(filePath)) {
                    fs.unlinkSync(filePath);
                }
            }, 30000);
        });

        fileStream.pipe(res);

    } catch (error) {
        logActivity(req, 'DOWNLOAD_ERROR', { url: req.body?.url || 'unknown', error: error.message?.slice(0, 100) });
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to download video', details: error.message });
        }
    }
});

// ─── Admin: Log Viewer ────────────────────────────────────────────────────────

app.get('/admin/logs', (req, res) => {
    const { password, date, search } = req.query;

    if (password !== ADMIN_PASSWORD) {
        return res.status(401).send(`
            <html><head><title>RipIt Admin</title>
            <style>
                body { font-family: monospace; background: #0a0e27; color: #fff; display: flex;
                       align-items: center; justify-content: center; height: 100vh; margin: 0; }
                form { background: #1a1f3a; padding: 40px; border-radius: 16px; border: 1px solid #2a2f4a; text-align: center; }
                h2 { color: #00ff88; margin-bottom: 20px; }
                input { padding: 12px; border-radius: 8px; border: 1px solid #2a2f4a;
                        background: #151932; color: #fff; font-size: 1rem; margin-bottom: 15px; width: 100%; }
                button { padding: 12px 30px; background: #00ff88; color: #0a0e27;
                         border: none; border-radius: 8px; font-weight: 700; cursor: pointer; width: 100%; }
            </style></head><body>
            <form method="GET" action="/admin/logs">
                <h2>🔐 Admin Login</h2>
                <input type="password" name="password" placeholder="Enter admin password" required /><br/>
                <button type="submit">Access Logs</button>
            </form></body></html>
        `);
    }

    // List available log files
    const logFiles = fs.existsSync(LOGS_DIR)
        ? fs.readdirSync(LOGS_DIR).filter(f => f.endsWith('.log')).sort().reverse()
        : [];

    const targetDate = date || (logFiles[0]?.replace('activity-', '').replace('.log', '') || '');
    const targetFile = path.join(LOGS_DIR, `activity-${targetDate}.log`);

    let lines = [];
    if (fs.existsSync(targetFile)) {
        lines = fs.readFileSync(targetFile, 'utf8').trim().split('\n').reverse();
        if (search) lines = lines.filter(l => l.toLowerCase().includes(search.toLowerCase()));
    }

    // Parse lines into structured rows
    function parseLine(line) {
        const tsMatch = line.match(/^\[(.+?)\]/);
        const ts = tsMatch ? tsMatch[1] : '';
        const rest = line.replace(/^\[.+?\]\s*/, '');
        const pairs = {};
        rest.split(' | ').forEach(part => {
            const [k, ...v] = part.split('=');
            if (k) pairs[k.trim()] = v.join('=').trim();
        });
        return { ts, ...pairs };
    }

    const eventColors = {
        DOWNLOAD_SUCCESS: '#00ff88',
        DOWNLOAD_START:   '#00cfff',
        DOWNLOAD_FAILED:  '#ff4757',
        DOWNLOAD_ERROR:   '#ff4757',
        VIDEO_INFO:       '#f0a500',
        URL_PASTED:       '#a29bfe'
    };

    const rows = lines.map(l => parseLine(l));

    // Stats
    const total      = rows.length;
    const successes  = rows.filter(r => r.EVENT === 'DOWNLOAD_SUCCESS').length;
    const failures   = rows.filter(r => ['DOWNLOAD_FAILED','DOWNLOAD_ERROR'].includes(r.EVENT)).length;
    const uniqueIPs  = new Set(rows.map(r => r.IP).filter(Boolean)).size;

    const html = `<!DOCTYPE html>
<html lang="en"><head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>RipIt — Activity Logs</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Courier New', monospace; background: #0a0e27; color: #c9d1d9; min-height: 100vh; }
  header { background: #1a1f3a; border-bottom: 1px solid #2a2f4a; padding: 20px 30px;
           display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 10px; }
  header h1 { color: #00ff88; font-size: 1.5rem; }
  header small { color: #8b92b0; font-size: 0.8rem; }
  .stats { display: flex; gap: 15px; padding: 20px 30px; flex-wrap: wrap; }
  .stat { background: #1a1f3a; border: 1px solid #2a2f4a; border-radius: 10px;
          padding: 14px 22px; min-width: 130px; text-align: center; }
  .stat-num { font-size: 1.8rem; font-weight: 700; }
  .stat-lbl { font-size: 0.75rem; color: #8b92b0; margin-top: 3px; }
  .controls { padding: 0 30px 15px; display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
  .controls form { display: flex; gap: 8px; flex-wrap: wrap; width: 100%; }
  input[type=text], input[type=date], select {
      padding: 8px 12px; background: #1a1f3a; border: 1px solid #2a2f4a;
      border-radius: 8px; color: #fff; font-family: monospace; font-size: 0.85rem; }
  button { padding: 8px 18px; background: #00ff88; color: #0a0e27; border: none;
           border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 0.85rem; }
  .log-files { padding: 0 30px 10px; display: flex; gap: 8px; flex-wrap: wrap; }
  .log-files a { padding: 4px 12px; border-radius: 20px; font-size: 0.78rem; text-decoration: none;
                 border: 1px solid #2a2f4a; color: #8b92b0; }
  .log-files a.active { border-color: #00ff88; color: #00ff88; }
  table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
  thead th { background: #151932; padding: 10px 12px; text-align: left; color: #8b92b0;
             border-bottom: 1px solid #2a2f4a; position: sticky; top: 0; }
  tbody tr:hover { background: rgba(255,255,255,0.03); }
  td { padding: 9px 12px; border-bottom: 1px solid #1a1f3a; vertical-align: top; word-break: break-all; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 10px; font-size: 0.7rem; font-weight: 700; }
  .table-wrap { overflow-x: auto; padding: 0 30px 40px; }
  .ts { color: #8b92b0; white-space: nowrap; }
  .url { color: #79c0ff; max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .empty { text-align: center; padding: 60px; color: #8b92b0; }
  .dl-count { padding: 0 30px 5px; color: #8b92b0; font-size: 0.8rem; }
</style>
</head>
<body>
<header>
  <div><h1>📊 RipIt Activity Logs</h1><small>Viewing: ${targetDate || 'No logs yet'}</small></div>
  <small style="color:#8b92b0">Logged in as admin</small>
</header>

<div class="stats">
  <div class="stat"><div class="stat-num" style="color:#a29bfe">${total}</div><div class="stat-lbl">Total Events</div></div>
  <div class="stat"><div class="stat-num" style="color:#00ff88">${successes}</div><div class="stat-lbl">Successful DLs</div></div>
  <div class="stat"><div class="stat-num" style="color:#ff4757">${failures}</div><div class="stat-lbl">Failed DLs</div></div>
  <div class="stat"><div class="stat-num" style="color:#00cfff">${uniqueIPs}</div><div class="stat-lbl">Unique IPs</div></div>
</div>

<div class="controls">
  <form method="GET" action="/admin/logs">
    <input type="hidden" name="password" value="${ADMIN_PASSWORD}" />
    <input type="date" name="date" value="${targetDate}" />
    <input type="text" name="search" value="${search || ''}" placeholder="Search logs..." style="flex:1;min-width:180px" />
    <button type="submit">Filter</button>
  </form>
</div>

<div class="log-files">
  ${logFiles.map(f => {
      const d = f.replace('activity-','').replace('.log','');
      const active = d === targetDate ? 'active' : '';
      return `<a href="/admin/logs?password=${ADMIN_PASSWORD}&date=${d}" class="${active}">${d}</a>`;
  }).join('')}
</div>

<div class="dl-count">${rows.length} events ${search ? `matching "${search}"` : ''}</div>

<div class="table-wrap">
${rows.length === 0 ? '<div class="empty">No log entries found.</div>' : `
<table>
  <thead><tr>
    <th>Timestamp</th><th>Event</th><th>IP Address</th>
    <th>Device / OS</th><th>Browser</th><th>Platform</th>
    <th>Format</th><th>URL</th><th>Extra</th>
  </tr></thead>
  <tbody>
  ${rows.map(r => {
      const color = eventColors[r.EVENT] || '#fff';
      const extra = r.SIZE_MB ? `${r.SIZE_MB} MB` : (r.REASON || r.ERROR || '');
      return `<tr>
        <td class="ts">${r.ts}</td>
        <td><span class="badge" style="background:${color}22;color:${color};border:1px solid ${color}44">${r.EVENT || '-'}</span></td>
        <td>${r.IP || '-'}</td>
        <td>${r.DEVICE || '-'}<br><small style="color:#8b92b0">${r.OS || ''}</small></td>
        <td>${r.BROWSER || '-'}</td>
        <td>${r.PLATFORM || '-'}</td>
        <td>${r.FORMAT || '-'}</td>
        <td class="url" title="${r.URL || ''}">${r.URL || '-'}</td>
        <td style="color:#8b92b0;font-size:0.75rem">${extra}</td>
      </tr>`;
  }).join('')}
  </tbody>
</table>`}
</div>
</body></html>`;

    res.send(html);
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
    console.log(`Admin logs at: http://localhost:${PORT}/admin/logs`);
    console.log('Supported: YouTube, YouTube Shorts, Instagram Reels, TikTok');
    writeLog('SERVER_START | message=Server started');

    exec('yt-dlp --version', (error, stdout) => {
        if (error) console.warn('⚠️  yt-dlp not found! Install: pip install yt-dlp');
        else console.log(`✓ yt-dlp ${stdout.trim()} ready`);
    });

    exec('ffmpeg -version', (error) => {
        if (error) console.warn('⚠️  ffmpeg not found! Install ffmpeg for video merging.');
        else console.log('✓ ffmpeg ready');
    });
});