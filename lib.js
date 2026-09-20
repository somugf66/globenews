const { XMLParser } = require('fast-xml-parser');
const { feature } = require('topojson-client');
const ccl = require('country-code-lookup');
const worldAtlas = require('world-atlas/countries-110m.json');

const ALIASES = {
  'W. Sahara': 'EH',
  'United States of America': 'US',
  'Dem. Rep. Congo': 'CD',
  Bahamas: 'BS',
  'Falkland Is.': 'FK',
  'Fr. S. Antarctic Lands': 'TF',
  "Côte d'Ivoire": 'CI',
  Congo: 'CG',
  'Eq. Guinea': 'GQ',
  eSwatini: 'SZ',
  Palestine: 'PS',
  Gambia: 'GM',
  Myanmar: 'MM',
  Turkey: 'TR',
  'Solomon Is.': 'SB',
  'Bosnia and Herz.': 'BA',
  Macedonia: 'MK',
  Kosovo: 'XK',
  'S. Sudan': 'SS',
};

const parser = new XMLParser({ ignoreAttributes: false });

function iso2For(name) {
  if (ALIASES[name]) return ALIASES[name];
  const r =
    ccl.byCountry(name) ||
    ccl.byCountry(name.replace(/\./g, '')) ||
    ccl.byCountry(name.replace('Rep.', 'Republic'));
  return r ? r.iso2 : null;
}

function geoCenter(geom) {
  const polygons = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;
  let best = null;
  let bestLen = 0;
  for (const poly of polygons) {
    const ring = poly[0];
    if (ring.length > bestLen) {
      bestLen = ring.length;
      best = ring;
    }
  }
  let lon = 0;
  let lat = 0;
  for (const p of best) {
    lon += p[0];
    lat += p[1];
  }
  return { lat: lat / best.length, lng: lon / best.length };
}

function buildCountries() {
  const geo = feature(worldAtlas, worldAtlas.objects.countries);
  const out = [];
  for (const f of geo.features) {
    const name = f.properties.name;
    const iso2 = iso2For(name);
    if (!iso2) continue;
    const c = geoCenter(f.geometry);
    out.push({ id: iso2, name, lat: c.lat, lng: c.lng, geometry: f.geometry });
  }
  return out;
}

const COUNTRIES = buildCountries();

function stripTags(s) {
  return String(s || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function extractImage(desc) {
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(String(desc || ''));
  return m ? m[1].replace(/&amp;/g, '&') : null;
}

function parseFeed(xml) {
  const data = parser.parse(xml);
  const items = data && data.rss && data.rss.channel && data.rss.channel.item;
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => {
      const ts = Date.parse(it.pubDate || '');
      const source = it.source && it.source['#text'] ? it.source['#text'] : 'Google News';
      return {
        id: it.guid && it.guid['#text'] ? it.guid['#text'] : it.link,
        title: stripTags(it.title),
        link: it.link,
        source,
        ts: isNaN(ts) ? Date.now() : ts,
        published: it.pubDate || '',
        desc: stripTags(it.description),
        img: extractImage(it.description),
      };
    })
    .sort((a, b) => b.ts - a.ts);
}

const SECTIONS = {
  politics: 'NATION',
  business: 'BUSINESS',
  technology: 'TECHNOLOGY',
  sports: 'SPORTS',
  science: 'SCIENCE',
  health: 'HEALTH',
  entertainment: 'ENTERTAINMENT',
};

const GLOBAL_MAJORS = [
  'reuters', 'associated press', 'afp', 'france 24', 'al jazeera', 'bbc',
  'cnn', 'the guardian', 'the new york times', 'nytimes', 'the wall street journal',
  'bloomberg', 'financial times', 'the washington post', 'npr', 'deutsche welle',
  'the telegraph', 'telegraph', 'business insider', 'businessinsider', 'forbes',
  'cnbc', 'vice news', 'apnews', 'wsj.com', 'ft.com', 'washingtonpost.com', 'dw.com',
  'npr.org', 'reuters.com', 'bbc.com', 'cnn.com', 'theguardian.com', 'bloomberg.com',
  'forbes.com', 'time.com', 'usatoday', 'nypost',
];

const LOCAL_SOURCES = {
  NG: ['punch', 'premium times', 'vanguard', 'daily trust', 'the cable', 'leadership', 'thisday', 'this day', 'channels television', 'tribune', 'businessday', 'the nation', 'aruza tv'],
  KE: ['nation', 'the star', 'citizen', 'ntv', 'the standard', 'standard media', 'tuko', 'kbc', 'the people daily'],
  ZA: ['timeslive', 'times live', 'news24', 'ewn', 'sabc', 'independent online', 'iol', 'enca', 'daily maverick', 'sunday times', 'business day', 'businessday', 'city press', 'the citizen'],
  IN: ['hindustan times', 'times of india', 'ndtv', 'the indian express', 'indian express', 'the hindu', 'livemint', 'india today', 'zeenews', 'zee news', 'firstpost', 'the economic times', 'economic times'],
};

function isLocalItem(item, country) {
  const src = String(item.source || '').toLowerCase();
  for (const g of GLOBAL_MAJORS) if (src.includes(g)) return false;
  const locals = country && LOCAL_SOURCES[country];
  if (locals) for (const l of locals) if (src.includes(l)) return true;
  return true;
}

function orderLocal(items, country) {
  const local = [];
  const globalRest = [];
  for (const it of items) {
    it.local = isLocalItem(it, country);
    (it.local ? local : globalRest).push(it);
  }
  return local.concat(globalRest);
}

function buildUrl({ country, q, section }) {
  const cc = country || 'US';
  if (section && SECTIONS[section] && !q) {
    return `https://news.google.com/rss/headlines/section/topic/${SECTIONS[section]}?hl=en-${cc}&gl=${cc}&ceid=${cc}:en`;
  }
  const base = `https://news.google.com/rss?hl=en-${cc}&gl=${cc}&ceid=${cc}:en`;
  if (q) {
    return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=en-${cc}&gl=${cc}&ceid=${cc}:en&scoring=n`;
  }
  return base;
}

async function fetchFeed(url, opts = {}) {
  const res = await fetch(url, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
    },
    signal: AbortSignal.timeout(opts.timeout || 15000),
  });
  if (!res.ok) throw new Error('feed status ' + res.status);
  const xml = await res.text();
  return parseFeed(xml);
}

module.exports = {
  COUNTRIES,
  buildUrl,
  fetchFeed,
  parseFeed,
  orderLocal,
};