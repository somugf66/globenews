const path = require('path');
const express = require('express');
const { COUNTRIES, buildUrl, fetchFeed, orderLocal } = require('./lib');

const cache = new Map();
const CACHE_TTL = 3 * 60 * 1000;

async function cachedFeed(key, url) {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL) return hit.items;
  const items = await fetchFeed(url);
  cache.set(key, { ts: Date.now(), items });
  return items;
}

const LIVE_POLL = 20000;
let liveBuffer = [];

async function refreshLive() {
  try {
    const items = await fetchFeed(buildUrl({ country: 'US' }), { timeout: 12000 });
    if (items.length) liveBuffer = items;
  } catch (e) {
    console.log('live poll error:', e.message);
  }
}

refreshLive();
setInterval(refreshLive, LIVE_POLL);

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/geojson', (req, res) => {
  res.json({
    features: COUNTRIES.map(({ id, name, lat, lng, geometry }) => ({
      type: 'Feature',
      properties: { id, name, lat, lng },
      geometry,
    })),
  });
});

app.get('/api/news', async (req, res) => {
  const country = (req.query.country || '').toUpperCase().slice(0, 2) || null;
  const q = (req.query.q || '').trim();
  const tf = Math.min(parseInt(req.query.tf, 10) || 24, 720);
  const allowed = ['politics', 'business', 'technology', 'sports', 'science', 'health', 'entertainment'];
  const section = allowed.includes((req.query.section || '').toLowerCase()) ? String(req.query.section).toLowerCase() : null;
  const key = `news:${country || 'US'}:${q}:${tf}:${section || 'all'}`;
  try {
    let items = await cachedFeed(key, buildUrl({ country, q, section }));
    if (tf) {
      const cutoff = Date.now() - tf * 3600 * 1000;
      items = items.filter((it) => it.ts >= cutoff);
    }
    if (country) items = orderLocal(items, country);
    res.json({ country, q, tf, updated: Date.now(), items: items.slice(0, 60) });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/live', (req, res) => {
  const now = Date.now();
  const cutoff = now - 2 * 60 * 1000;
  const strict = liveBuffer.filter((it) => it.ts >= cutoff).sort((a, b) => b.ts - a.ts);
  res.json({
    updated: now,
    strict,
    recent: liveBuffer.slice(0, 12),
    bufferSize: liveBuffer.length,
  });
});

const PORT = process.env.PORT || 9000;
const HOST = process.env.HOST || '127.0.0.1';
app.listen(PORT, HOST, () => {
  console.log(`serving on http://localhost:${PORT} (${COUNTRIES.length} countries loaded)`);
  if (process.env.GLOBENEWS_NO_OPEN !== '1') {
    setTimeout(() => {
      const url = `http://localhost:${PORT}/`;
      const cp = require('child_process');
      try {
        if (process.platform === 'win32') cp.spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore' }).unref();
        else cp.exec(`xdg-open "${url}"`).unref();
      } catch (e) { console.log('could not auto-open browser:', e.message); }
    }, 1500);
  }
});