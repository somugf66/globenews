/* GlobeNews Live — solar-system edition */
const $ = (id) => document.getElementById(id);

/* ============ Settings ============ */
const DEFAULTS = {
  uiTheme: 'cosmic',
  quality: 'high',
  stars: true,
  orbits: true,
  labels: true,
  moon: true,
  sunGlow: true,
  newsRefresh: 10,
  panelAuto: false,
  defaultTf: '24',
  newsImages: true,
  autoRotate: true,
  orbitSpeed: 1,
};

let settings = loadSettings();
function loadSettings() {
  try {
    const s = JSON.parse(localStorage.getItem('globeNews.settings.v1') || '{}');
    const out = Object.assign({}, DEFAULTS, s);
    out.newsRefresh = DEFAULTS.newsRefresh;
    return out;
  } catch (e) {
    return Object.assign({}, DEFAULTS);
  }
}
function saveSettings() {
  localStorage.setItem('globeNews.settings.v1', JSON.stringify(settings));
  applySettings();
  if (typeof solarSetQuality === 'function') solarSetQuality();
  if (typeof applySettings === 'function') applySettings();
  const t = $('savedToast');
  t.classList.remove('hidden');
  clearTimeout(saveSettings._t);
  saveSettings._t = setTimeout(() => t.classList.add('hidden'), 1600);
}
function applySettings() {
  document.body.classList.toggle('theme-glass', settings.uiTheme === 'glass');
  syncSettingsUI();
  if (SS.ready) {
    if (SS.controls) SS.controls.autoRotate = settings.autoRotate;
    if (SS.stars) SS.stars.visible = settings.stars;
    if (SS.orbits) SS.orbits.visible = settings.orbits;
    if (SS.sunGlow) SS.sunGlow.visible = settings.sunGlow;
    if (SS.moon) SS.moon.visible = settings.moon;
    for (const p of SS.planets) if (p.label) p.label.wrap.style.display = settings.labels ? '' : 'none';
  }
  setupNewsTimers(true);
}
function syncSettingsUI() {
  $('optTheme').value = settings.uiTheme;
  $('optQuality').value = settings.quality;
  $('optStars').checked = settings.stars;
  $('optOrbits').checked = settings.orbits;
  $('optLabels').checked = settings.labels;
  $('optMoon').checked = settings.moon;
  $('optSunGlow').checked = settings.sunGlow;
  $('optNewsRefresh').value = String(settings.newsRefresh);
  $('optPanelAuto').checked = settings.panelAuto;
  $('optDefaultTf').value = settings.defaultTf;
  $('optNewsImages').checked = settings.newsImages;
  $('optAutoRotate').checked = settings.autoRotate;
  $('optOrbitSpeed').value = String(settings.orbitSpeed);
}
function resetSettings() {
  localStorage.removeItem('globeNews.settings.v1');
  location.reload();
}

/* ============ News ============ */
const state = { country: null, countryName: null, q: null, cat: '', tf: settings.defaultTf, news: [], loading: false };

const CATS = [
  { k: '', label: 'All' },
  { k: 'politics', label: 'Politics' },
  { k: 'business', label: 'Business' },
  { k: 'technology', label: 'Technology' },
  { k: 'sports', label: 'Sports' },
  { k: 'science', label: 'Science' },
  { k: 'health', label: 'Health' },
  { k: 'entertainment', label: 'Entertainment' },
];
const CAT_LABEL = Object.fromEntries(CATS.map((c) => [c.k, c.label]));

function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}
function esc(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}
function fmtTf() {
  return { 24: 'Last 24 hours', 48: 'Last 2 days', 168: 'Last 7 days' }[state.tf] || '';
}
function currentTitle() {
  const cat = CAT_LABEL[state.cat] || '';
  if (state.q) return `Results for “${state.q}”`;
  if (state.countryName) return cat ? `${cat} — ${state.countryName}` : state.countryName;
  if (cat) return `${cat} top stories`;
  return 'Global top stories';
}

async function loadNews() {
  if (state.loading) {
    state.reloadQueued = true;
    return;
  }
  state.loading = true;
  $('panel').classList.toggle('showClear', !!(state.q || state.country));
  $('panelTitle').innerHTML = `${currentTitle()} <small>• ${fmtTf()}</small>`;
  $('newsList').innerHTML = '<div class="spinner"></div>';
  const params = new URLSearchParams({ tf: state.tf });
  if (state.country) params.set('country', state.country);
  if (state.q) params.set('q', state.q);
  if (state.cat) params.set('section', state.cat);
  try {
    const res = await fetch(`/api/news?${params}`);
    const data = await res.json();
    state.news = data.items || [];
    renderNews();
  } catch (e) {
    $('newsList').innerHTML = '<div class="empty">Could not load news. Check connection.</div>';
  } finally {
    state.loading = false;
    if (state.reloadQueued) {
      state.reloadQueued = false;
      loadNews();
    }
  }
}

function renderNews() {
  const list = $('newsList');
  if (!state.news.length) {
    list.innerHTML = `<div class="empty">No stories found in the last ${fmtTf().toLowerCase()} for this selection. Try a different country, topic, or wider time frame.</div>`;
    return;
  }
  list.innerHTML = state.news
    .map((n) => {
      const img = settings.newsImages && n.img ? `<img src="${n.img}" alt="" onerror="this.remove()"/>` : '';
      return `<div class="card" onclick="window.open('${String(n.link).replace(/'/g, '')}','_blank')">
        ${img}
        <div class="body">
          <div class="title"><a href="${n.link}" target="_blank" rel="noopener">${esc(n.title)}</a></div>
          <div class="meta">${n.local ? '<span class="localTag">LOCAL</span>' : ''}<b>${esc(n.source)}</b> · ${timeAgo(n.ts)}</div>
          ${n.desc ? `<div class="desc">${esc(n.desc)}</div>` : ''}
        </div>
      </div>`;
    })
    .join('');
}

function renderCats() {
  const sel = $('catSel');
  if (!sel) return;
  sel.value = state.cat;
  if (sel._built) return;
  sel._built = true;
  for (const c of CATS) {
    const o = document.createElement('option');
    o.value = c.k;
    o.textContent = c.k ? `${c.label} news` : 'All categories';
    sel.appendChild(o);
  }
  sel.addEventListener('change', () => {
    state.cat = sel.value;
    loadNews();
  });
}

const COUNTRY_ALIAS = {
  'united states': 'US', usa: 'US', america: 'US', 'u.s.a': 'US',
  uk: 'GB', britain: 'GB', england: 'GB', scotland: 'GB', wales: 'GB', 'northern ireland': 'GB',
  russia: 'RU', 'south korea': 'KR', 'north korea': 'KP', 'czechia': 'CZ', 'czech republic': 'CZ',
  'democratic republic of congo': 'CD', 'republic of congo': 'CG', 'ivory coast': 'CI',
  swaziland: 'SZ', burma: 'MM', 'the bahamas': 'BS', palestine: 'PS', kosovo: 'XK', macedonia: 'MK',
};
function countryByName(raw) {
  const q = raw.trim().toLowerCase();
  if (!SS.geo || !SS.geo.length) return null;
  let hit = SS.geo.find((f) => f.properties.name.toLowerCase() === q);
  if (!hit && COUNTRY_ALIAS[q]) hit = SS.geo.find((f) => f.properties.id === COUNTRY_ALIAS[q]);
  if (!hit && q.length >= 3) {
    const m = SS.geo.filter((f) => f.properties.name.toLowerCase().includes(q));
    hit = m.length === 1 ? m[0] : null;
  }
  return hit || null;
}
function startCountrySearch(f) {
  state.q = null;
  $('search').value = '';
  if (typeof selectCountry === 'function') selectCountry(f.properties.id);
  if (typeof enterEarthFocus === 'function') enterEarthFocus();
  if (typeof countryPicked === 'function') countryPicked(f.properties.id, f.properties.name);
}
function doSearch() {
  const raw = $('search').value.trim();
  const hit = countryByName(raw);
  if (hit) {
    startCountrySearch(hit);
    return;
  }
  state.country = null;
  state.countryName = null;
  state.q = raw || null;
  state.cat = '';
  renderCats();
  if (SS.ready) selectCountry(null);
  loadNews();
}
function flyHome() {
  state.country = null;
  state.countryName = null;
  state.q = null;
  state.cat = '';
  renderCats();
  $('search').value = '';
  $('clearFilter').style.display = 'none';
  if (SS.ready) {
    selectCountry(null);
    if (typeof exitEarthFocus === 'function') exitEarthFocus();
    focusObject(new THREE.Vector3(0, 0, 0), 240);
  }
  loadNews();
}

/* ============ Live ticker ============ */
let tickerItems = [];
const seen = new Set();
let tickerPos = 0;
let lastTs = 0;

async function pollLive() {
  try {
    const res = await fetch('/api/live');
    const data = await res.json();
    const pool = data.strict.length ? data.strict : data.recent;
    const fresh = [];
    for (const it of pool) {
      const key = it.id || it.link;
      if (!seen.has(key)) {
        seen.add(key);
        fresh.push(it);
      }
    }
    if (data.strict.length) {
      const merged = {};
      for (const it of data.strict) merged[it.id || it.link] = it;
      for (const it of tickerItems) {
        if (!merged[it.id || it.link] && it.ts >= Date.now() - 30 * 60 * 1000) merged[it.id || it.link] = it;
      }
      tickerItems = Object.values(merged).sort((a, b) => b.ts - a.ts).slice(0, 30);
    }
    if (fresh.length) tickerItems = fresh.concat(tickerItems).slice(0, 30);
    renderTicker();
  } catch (e) {}
}

function renderTicker() {
  const tn = $('tickerInner');
  if (!tickerItems.length) {
    tn.innerHTML = '<span class="tItem">Listening for breaking news…</span>';
    return;
  }
  const one = tickerItems
    .map(
      (n) =>
        `<a class="tItem" href="${n.link}" target="_blank" rel="noopener"><span class="src">${esc(n.source)}</span><span>${esc(n.title)}</span><span class="when">${timeAgo(n.ts)}</span></a>`
    )
    .join('');
  tn.innerHTML = one + one;
}

function tickerScroll(ts) {
  if (!lastTs) lastTs = ts;
  const dt = ts - lastTs;
  lastTs = ts;
  const tn = $('tickerInner');
  const half = tn.scrollWidth / 2 || 1;
  tickerPos += (1.1 * dt) / 16.6;
  if (tickerPos >= half) tickerPos -= half;
  tn.style.transform = `translateX(${-tickerPos}px)`;
  requestAnimationFrame(tickerScroll);
}

let newsTimer = null;
let panelTimer = null;
function setupNewsTimers(forceRestart) {
  if (newsTimer && !forceRestart) return;
  clearInterval(newsTimer);
  newsTimer = setInterval(pollLive, Math.max(10, settings.newsRefresh) * 1000);
  clearInterval(panelTimer);
  if (settings.panelAuto) panelTimer = setInterval(loadNews, Math.max(60, settings.newsRefresh * 2) * 1000);
  $('liveLabel').textContent = `LIVE · every ${settings.newsRefresh}s`;
}

/* ============ Settings UI wiring ============ */
$('settingsBtn').addEventListener('click', () => $('modalOverlay').classList.remove('hidden'));
$('modalClose').addEventListener('click', () => $('modalOverlay').classList.add('hidden'));
$('modalOverlay').addEventListener('click', (e) => {
  if (e.target === $('modalOverlay')) $('modalOverlay').classList.add('hidden');
});
$('resetBtn').addEventListener('click', () => confirm('Reset all settings to defaults and reload?') && resetSettings());

const settingBindings = {
  optTheme: (v) => (settings.uiTheme = v),
  optQuality: (v) => (settings.quality = v),
  optStars: (v) => (settings.stars = v),
  optOrbits: (v) => (settings.orbits = v),
  optLabels: (v) => (settings.labels = v),
  optMoon: (v) => (settings.moon = v),
  optSunGlow: (v) => (settings.sunGlow = v),
  optNewsRefresh: (v) => (settings.newsRefresh = parseInt(v, 10)),
  optPanelAuto: (v) => (settings.panelAuto = v),
  optDefaultTf: (v) => (settings.defaultTf = v),
  optNewsImages: (v) => (settings.newsImages = v),
  optAutoRotate: (v) => (settings.autoRotate = v),
  optOrbitSpeed: (v) => (settings.orbitSpeed = parseFloat(v)),
};
for (const [id, fn] of Object.entries(settingBindings)) {
  const el = $(id);
  if (!el) continue;
  el.addEventListener('change', () => {
    fn(el.type === 'checkbox' ? el.checked : el.value);
    saveSettings();
  });
}

/* ============ Toast + planet info ============ */
let toastT = null;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.add('hidden'), 1800);
}
$('planetInfoClose').addEventListener('click', () => $('planetInfo').classList.add('hidden'));
function showPlanetInfo(name) {
  const info = PLANET_FACTS[name];
  if (!info) return;
  $('planetInfo').classList.remove('hidden');
  $('piName').textContent = name;
  $('piType').textContent = info.type;
  $('piDot').style.background = PLANET_COLOR[name];
  $('piGrid').innerHTML =
    `<div><b>Diameter</b>${info.dia}</div><div><b>Day length</b>${info.day}</div><div><b>Year length</b>${info.year}</div><div><b>Avg. distance</b>${DIST_KM[name]}</div>`;
  $('piFact').textContent = info.fact;
}

/* ============ Boot ============ */
function closePlanetInfo() {
  $('planetInfo').classList.add('hidden');
}
function countryPicked(id, name) {
  state.country = id || null;
  state.countryName = name;
  state.q = null;
  $('search').value = '';
  closePlanetInfo();
  loadNews();
}
$('searchBtn').addEventListener('click', doSearch);
$('search').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') doSearch();
});
$('tf').addEventListener('change', () => {
  state.tf = $('tf').value;
  loadNews();
});
$('clearFilter').addEventListener('click', flyHome);

async function boot() {
  renderCats();
  try {
    const res = await fetch('/api/geojson');
    const data = await res.json();
    if (!data || !Array.isArray(data.features) || !data.features.length) throw new Error('empty geojson');
    buildSolarSystem(data.features);
  } catch (e) {
    $('webglFallback').classList.remove('hidden');
  }
  applySettings();
  loadNews();
  pollLive();
}
boot();

/* ============ Resizable news panel ============ */
const PANEL_MIN = 280, PANEL_MAX_RATIO = 0.62;
function applyPanelWidth(w) {
  const panel = $('panel');
  panel.style.width = w + 'px';
  panel.style.flex = `0 0 ${w}px`;
  if (typeof onSolarResize === 'function') onSolarResize();
}
(function initPanelResize() {
  const handle = $('panelHandle');
  const panel = $('panel');
  if (!handle || !panel) return;
  const saved = parseInt(localStorage.getItem('globeNews.panelWidth') || '', 10);
  if (saved >= PANEL_MIN) applyPanelWidth(saved);
  let dragging = false;
  const start = (e) => {
    dragging = true;
    handle.classList.add('dragging');
    handle.setPointerCapture(e.pointerId);
  };
  const move = (e) => {
    if (!dragging) return;
    const layout = document.querySelector('.layout');
    if (!layout) return;
    const total = layout.clientWidth;
    const w = Math.max(PANEL_MIN, Math.min(total * PANEL_MAX_RATIO, total - e.clientX));
    panel.style.width = w + 'px';
    panel.style.flex = `0 0 ${w}px`;
    if (typeof onSolarResize === 'function') onSolarResize();
  };
  const stop = () => {
    if (!dragging) return;
    dragging = false;
    handle.classList.remove('dragging');
    localStorage.setItem('globeNews.panelWidth', String(panel.clientWidth));
  };
  handle.addEventListener('pointerdown', start);
  handle.addEventListener('pointermove', move);
  handle.addEventListener('pointerup', stop);
  handle.addEventListener('pointercancel', stop);
})();

/* ============ Start ticker motion ============ */
requestAnimationFrame(tickerScroll);