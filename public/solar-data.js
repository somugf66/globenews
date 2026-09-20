/* GlobeNews Live — solar system data + geometry helpers */
const TAU = Math.PI * 2;
const SUN_R = 6;
const EARTH_IMG = 'https://cdn.jsdelivr.net/npm/three-globe/example/img/earth-blue-marble.jpg';

const PLANET_COLOR = {
  Mercury: '#a8a29e', Venus: '#e7c8a0', Earth: '#5aa7f7', Mars: '#e0714f',
  Jupiter: '#d9b48f', Saturn: '#ead6a4', Uranus: '#9fd8d8', Neptune: '#4f82c8',
};
const DIST_KM = {
  Mercury: '57.9M km', Venus: '108.2M km', Earth: '149.6M km', Mars: '227.9M km',
  Jupiter: '778.6M km', Saturn: '1.43B km', Uranus: '2.87B km', Neptune: '4.5B km',
};
const PLANET_FACTS = {
  Mercury: { type: 'Terrestrial planet', dia: '4,879 km', day: '59 Earth days', year: '88 Earth days', fact: 'Smallest planet; its surface swings from -180°C to 430°C.' },
  Venus: { type: 'Terrestrial planet', dia: '12,104 km', day: '243 Earth days', year: '225 Earth days', fact: 'Hottest planet; spins backwards, wrapped in CO2 clouds.' },
  Earth: { type: 'Terrestrial planet', dia: '12,742 km', day: '24 hours', year: '365.25 days', fact: 'Our home — the only known planet with liquid surface oceans.' },
  Mars: { type: 'Terrestrial planet', dia: '6,779 km', day: '24.6 hours', year: '687 Earth days', fact: 'The Red Planet; hosts Olympus Mons, the tallest volcano known.' },
  Jupiter: { type: 'Gas giant', dia: '139,820 km', day: '9.9 hours', year: '11.9 Earth years', fact: 'Largest planet; the Great Red Spot is a storm bigger than Earth.' },
  Saturn: { type: 'Gas giant', dia: '116,460 km', day: '10.7 hours', year: '29.5 Earth years', fact: 'Famous for its rings of ice and rock, 282,000 km wide.' },
  Uranus: { type: 'Ice giant', dia: '50,724 km', day: '17.2 hours', year: '84 Earth years', fact: 'Spins on its side; the coldest planetary atmosphere in the system.' },
  Neptune: { type: 'Ice giant', dia: '49,244 km', day: '16.1 hours', year: '165 Earth years', fact: 'Windiest planet — supersonic winds top 2,100 km/h.' },
};

const ORBIT = { Mercury: 15, Venus: 20, Earth: 26, Mars: 31, Jupiter: 41, Saturn: 50, Uranus: 58, Neptune: 66 };
const PERIOD = { Mercury: 88, Venus: 225, Earth: 365, Mars: 687, Jupiter: 4333, Saturn: 10759, Uranus: 30687, Neptune: 60190 };
const SCALE = { Mercury: 0.42, Venus: 0.9, Earth: 1.55, Mars: 0.68, Jupiter: 3.3, Saturn: 2.8, Uranus: 1.6, Neptune: 1.55 };
const ROT_SPIN = { Mercury: 0.3, Venus: -0.12, Earth: 1.2, Mars: 1.0, Jupiter: 2.2, Saturn: 2.0, Uranus: -0.5, Neptune: 0.6 };
const INIT_ANGLE = { Mercury: 1.4, Venus: 2.9, Earth: 4.8, Mars: 0.4, Jupiter: 2.1, Saturn: 5.3, Uranus: 0.9, Neptune: 3.6 };
const PLANET_TEX = {
  Mercury: [['#8f8b87', 0], ['#6a6661', 0.5], ['#9c9893', 1]],
  Venus: [['#e8cd9f', 0], ['#dbb06a', 0.5], ['#ecdcae', 1]],
  Earth: [['#2563eb', 0], ['#1d4ed8', 0.5], ['#2f6fdf', 1]],
  Mars: [['#c1532e', 0], ['#8d3b20', 0.5], ['#a74a2b', 1]],
  Jupiter: [['#dcc3a1', 0], ['#c29463', 0.25], ['#e2c5a4', 0.5], ['#c69c6e', 0.75], ['#d9b48f', 1]],
  Saturn: [['#ead6a4', 0], ['#dcc08a', 0.55], ['#ecdcae', 1]],
  Uranus: [['#9fd8d8', 0], ['#8fcccf', 0.6], ['#a9dede', 1]],
  Neptune: [['#4f82c8', 0], ['#3d6cae', 0.55], ['#5b8ed4', 1]],
};

const SS = {
  ready: false, quality: null, scene: null, camera: null, renderer: null, controls: null,
  geo: null, planets: [], planetMeshes: [], earthMesh: null, pick: null, countryMesh: [],
  countryIndex: new Map(), curCountry: null, hoverId: null, stars: null, orbits: null,
  sunGlow: null, sunMesh: null, sunShader: null, moon: null, moonMesh: null, fillMesh: null, canvas: null, raycaster: null, pointer: new THREE.Vector2(),
  tween: null, sim: { days: 0 }, _last: 0, _animStarted: false, _labelEls: [], earthFocus: false,
};

const MESH_NORMAL = new THREE.LineBasicMaterial({ color: 0xa8c8ff, transparent: true, opacity: 0.85, depthWrite: false });
const MESH_HOVER = new THREE.LineBasicMaterial({ color: 0x7dd3fc, transparent: true, opacity: 1, depthWrite: false });
const MESH_SEL = new THREE.LineBasicMaterial({ color: 0xf5b04d, transparent: true, opacity: 1, depthWrite: false });

function lonLatToVec(latDeg, lngDeg, r) {
  const la = (latDeg * Math.PI) / 180, lo = (lngDeg * Math.PI) / 180;
  return new THREE.Vector3(r * Math.cos(la) * Math.sin(lo), r * Math.sin(la), r * Math.cos(la) * Math.cos(lo));
}
function inRing(lat, lng, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const ax = ring[i][0], ay = ring[i][1], bx = ring[j][0], by = ring[j][1];
    if ((ay > lat) !== (by > lat)) {
      const x = ax + ((lat - ay) / (by - ay)) * (bx - ax);
      if (x > lng) inside = !inside;
    }
  }
  return inside;
}
function ringArea(r) {
  let s = 0;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) s += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]);
  return s / 2;
}
function polyBBox(poly) {
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const ring of poly) for (const p of ring) {
    if (p[0] < minX) minX = p[0]; if (p[0] > maxX) maxX = p[0];
    if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1];
  }
  return { minX, minY, maxX, maxY };
}
function pointInCountry(lat, lng, f) {
  const bb = f._bb;
  if (lat < bb.minY || lat > bb.maxY || lng < bb.minX || lng > bb.maxX) return false;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    if (!poly.length) continue;
    let outer = poly[0];
    for (const r of poly) if (Math.abs(ringArea(r)) > Math.abs(ringArea(outer))) outer = r;
    if (!inRing(lat, lng, outer)) continue;
    let inHole = false;
    for (let i = 1; i < poly.length; i++) if (inRing(lat, lng, poly[i])) { inHole = true; break; }
    if (!inHole) return true;
  }
  return false;
}
function hash01(x) {
  const s = Math.sin(x) * 43758.5453;
  return s - Math.floor(s);
}
function canvasTexture(w, h, fn) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  fn(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}
function planetTex(name) {
  return canvasTexture(256, 128, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, 0, h);
    for (const [col, o] of PLANET_TEX[name]) g.addColorStop(o, col);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      const x = hash01(i * 997.3) * w;
      const y = hash01(i * 1.31) * h;
      const len = 20 + hash01(i * 7.7) * 24;
      ctx.fillStyle = i % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.08)';
      ctx.fillRect(x, y, len, 1);
    }
  });
}
function glowTex() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.25, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  });
}