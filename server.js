const express = require('express');
const yts = require('yt-search');
const app = express();
const PORT = 3000;

app.use(express.json());
app.use(express.static('public'));

const NEW_RELEASE_TOPICS = [
  'Amapiano 2026 New Releases',
  'New Music Friday 2026 Official Video',
  'Afrobeats Hits 2026',
  'Top Trending Songs 2026',
  'Latest Official Music Video 2026',
  'Pop Tiktok Songs 2026',
  'Zimdancehall Hits 2026',
  'South African Amapiano Mix 2026',
  'Global Top Billboard Hits 2026'
];

// YouTube Search API
app.get('/api/search', async (req, res) => {
  const { q, page } = req.query;
  const pageNum = parseInt(page) || 1;
  let searchTerm = q && q.trim() !== '' ? q : null;

  if (!searchTerm) {
    const topicIndex = (pageNum - 1) % NEW_RELEASE_TOPICS.length;
    searchTerm = NEW_RELEASE_TOPICS[topicIndex];
  } else if (pageNum > 1) {
    searchTerm = `${searchTerm} page ${pageNum}`;
  }

  try {
    const r = await yts(searchTerm);
    const videos = (r.videos || []).slice(0, 10).map(v => ({
      id: v.videoId,
      title: v.title,
      uploader: v.author ? v.author.name : 'YouTube Music',
      thumbnail: v.thumbnail || `https://img.youtube.com/vi/${v.videoId}/hqdefault.jpg`,
      url: v.url
    }));

    return res.json(videos);
  } catch (error) {
    return res.status(500).json({ error: 'Failed to fetch YouTube data' });
  }
});

// RESOLVE MEDIA DOWNLOAD LINK
app.post('/api/get-download-link', async (req, res) => {
  const { url, type } = req.body;
  if (!url) return res.status(400).json({ error: 'URL missing' });

  const isMp3 = type === 'mp3';
  let downloadUrl = null;

  // Mirror 1: David Cyril API
  try {
    const endpoint = isMp3 
      ? `https://apis.davidcyriltech.my.id/download/ytmp3?url=${encodeURIComponent(url)}`
      : `https://apis.davidcyriltech.my.id/download/ytmp4?url=${encodeURIComponent(url)}`;
    
    const response = await fetch(endpoint);
    const data = await response.json();

    if (data && data.result && data.result.download_url) {
      downloadUrl = data.result.download_url;
    } else if (data && data.download_url) {
      downloadUrl = data.download_url;
    }
  } catch (e) {}

  // Mirror 2: EliteProTech API
  if (!downloadUrl) {
    try {
      const response = await fetch(`https://eliteprotech-apis.zone.id/ytdown?url=${encodeURIComponent(url)}`);
      const data = await response.json();
      if (data && data.result) {
        downloadUrl = isMp3 ? (data.result.mp3 || data.result.audio) : (data.result.mp4 || data.result.video);
      }
    } catch (e) {}
  }

  // Mirror 3: Cobalt Engine
  if (!downloadUrl) {
    try {
      const response = await fetch('https://api.cobalt.tools/', {
        method: 'POST',
        headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url, isAudioOnly: isMp3, aFormat: 'mp3', vQuality: '720' })
      });
      const data = await response.json();
      if (data && data.url) {
        downloadUrl = data.url;
      }
    } catch (e) {}
  }

  if (downloadUrl) {
    return res.json({ success: true, downloadUrl: downloadUrl });
  } else {
    return res.status(500).json({ success: false, error: 'Conversion busy' });
  }
});

// SERVER-SIDE PROXY STREAM (FIXES ALL CORS & DOWNLOAD ERRORS)
app.get('/api/stream-file', async (req, res) => {
  const { url, title, type, start } = req.query;
  if (!url) return res.status(400).send('URL missing');

  try {
    const ext = type === 'mp3' ? 'mp3' : 'mp4';
    const cleanTitle = (title || 'Track').replace(/[^a-zA-Z0-9_\- ]/g, '').trim();
    
    const headers = {};
    if (start && parseInt(start) > 0) {
      headers['Range'] = `bytes=${start}-`;
    }

    const mediaResponse = await fetch(url, { headers });
    if (!mediaResponse.ok) return res.status(500).send('Download stream failed');

    const contentLength = mediaResponse.headers.get('content-length');
    if (contentLength) res.setHeader('Content-Length', contentLength);

    res.setHeader('Content-Type', type === 'mp3' ? 'audio/mpeg' : 'video/mp4');
    res.setHeader('Content-Disposition', `attachment; filename="${cleanTitle}.${ext}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');

    const reader = mediaResponse.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  } catch (err) {
    res.status(500).send('Proxy streaming error');
  }
});

app.listen(PORT, () => {
  console.log(`\n===================================`);
  console.log(`✅ TECH TV CORS-FREE STREAM ENGINE ACTIVE!`);
  console.log(`👉 Vhura browser pa: http://localhost:${PORT}`);
  console.log(`===================================\n`);
});
module.exports = app;
