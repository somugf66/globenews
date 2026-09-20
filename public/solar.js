/* GlobeNews Live — solar system scene building */
function buildStars(count) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(700 + Math.random() * 700);
    pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    const tint = 0.8 + Math.random() * 0.2;
    col[i * 3] = tint;
    col[i * 3 + 1] = tint * (0.85 + Math.random() * 0.2);
    col[i * 3 + 2] = tint * (0.8 + Math.random() * 0.25);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({ size: 1.5, map: glowTex(), transparent: true, opacity: 0.95, vertexColors: true, depthWrite: false, sizeAttenuation: true, blending: THREE.AdditiveBlending });
  const p = new THREE.Points(geo, mat);
  SS.scene.add(p);
  return p;
}
function buildSun() {
  const vsh = [
    'varying vec3 vNormal;',
    'varying vec3 vMV;',
    'void main(){',
    '  vNormal = normalize(normalMatrix * normal);',
    '  vec4 mv = modelViewMatrix * vec4(position, 1.0);',
    '  vMV = mv.xyz;',
    '  gl_Position = projectionMatrix * mv;',
    '}'
  ].join('\n');
  const fsh = [
    'uniform float uTime;',
    'varying vec3 vNormal;',
    'varying vec3 vMV;',
    'float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }',
    'float noise(vec2 p){',
    '  vec2 i = floor(p); vec2 f = fract(p); vec2 u = f*f*(3.0-2.0*f);',
    '  float a = hash(i); float b = hash(i+vec2(1.0,0.0));',
    '  float c = hash(i+vec2(0.0,1.0)); float d = hash(i+vec2(1.0,1.0));',
    '  return mix(mix(a,b,u.x), mix(c,d,u.x), u.y);',
    '}',
    'float fbm(vec2 p){',
    '  float v = 0.0; float amp = 0.5;',
    '  for (int i = 0; i < 5; i++){ v += amp * noise(p); p *= 2.03; amp *= 0.5; }',
    '  return v;',
    '}',
    'void main(){',
    '  vec3 n = normalize(vNormal);',
    '  vec2 uv = vec2(atan(n.z, n.x) / 6.28318, asin(n.y) / 3.14159 + 0.5);',
    '  float t = uTime;',
    '  float gran = fbm(uv * 8.0 + vec2(t * 0.045, t * 0.03));',
    '  float mild = fbm(uv * 3.0 - vec2(t * 0.012, 0.0));',
    '  float spot = fbm(uv * 1.7 + vec2(t * 0.008, sin(t * 0.007)));',
    '  vec3 core = vec3(1.00, 0.97, 0.84);',
    '  vec3 mid = vec3(0.98, 0.58, 0.18);',
    '  vec3 deep = vec3(0.55, 0.10, 0.02);',
    '  vec3 c = mix(mid, core, smoothstep(0.32, 0.72, gran));',
    '  c = mix(deep, c, smoothstep(0.10, 0.42, mild));',
    '  c *= 1.0 - smoothstep(0.66, 0.82, spot) * 0.72;',
    '  c *= 0.93 + 0.14 * gran;',
    '  vec3 viewDir = normalize(-vMV);',
    '  float ndv = max(dot(n, viewDir), 0.0);',
    '  float limb = 0.40 + 0.60 * pow(ndv, 0.42);',
    '  vec3 limbTint = mix(vec3(1.0, 0.35, 0.04), vec3(1.0, 1.0, 0.9), smoothstep(0.0, 1.0, ndv));',
    '  c *= limb * limbTint * 1.1;',
    '  c *= 0.965 + 0.035 * sin(t * 1.6) * sin(t * 3.7);',
    '  gl_FragColor = vec4(c, 1.0);',
    '}'
  ].join('\n');
  const mat = new THREE.ShaderMaterial({ uniforms: { uTime: { value: 0 } }, vertexShader: vsh, fragmentShader: fsh });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(SUN_R, 48, 48), mat);
  SS.scene.add(mesh);
  SS.sunMesh = mesh;
  SS.sunShader = mat;
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffc64d, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }));
  glow.scale.set(SUN_R * 5.4, SUN_R * 5.4, 1);
  SS.scene.add(glow);
  SS.sunGlow = glow;
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xff7a1a, transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false }));
  halo.scale.set(SUN_R * 9, SUN_R * 9, 1);
  SS.scene.add(halo);
  SS.scene.add(new THREE.PointLight(0xfff2d6, 2.2, 0, 0));
  SS.scene.add(new THREE.AmbientLight(0x334155, 0.35));
}
function orbitLineFromRadius(r) {
  const pts = [];
  for (let i = 0; i < 128; i++) pts.push(new THREE.Vector3(r * Math.cos((i / 128) * TAU), 0, r * Math.sin((i / 128) * TAU)));
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x6b87a8, transparent: true, opacity: 0.4 }));
}
function buildOrbits() {
  const g = new THREE.Group();
  for (const name of Object.keys(ORBIT)) g.add(orbitLineFromRadius(ORBIT[name]));
  SS.scene.add(g);
  SS.orbits = g;
}
function makeLabel(name) {
  const wrap = document.createElement('div');
  wrap.className = 'labelWrap';
  wrap.innerHTML = '<span class="planetLabel"><span class="labDot" style="background:' + PLANET_COLOR[name] + '"></span>' + name + '</span>';
  document.getElementById('stage').appendChild(wrap);
  SS._labelEls.push(wrap);
  return { wrap, el: wrap.firstChild, pos: new THREE.Vector3() };
}
function buildPlanet(name) {
  const r = ORBIT[name], sc = SCALE[name];
  const mat = new THREE.MeshStandardMaterial({ map: planetTex(name), roughness: 0.92, metalness: 0 });
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(sc, 48, 48), mat);
  if (name === 'Earth') {
    new THREE.TextureLoader().load(EARTH_IMG, (t) => {
      t.encoding = THREE.sRGBEncoding;
      mesh.material.map = t;
      mesh.material.needsUpdate = true;
    });
  }
  const ang = INIT_ANGLE[name];
  mesh.position.set(r * Math.cos(ang), 0, r * Math.sin(ang));
  mesh.rotation.y = ang;
  SS.scene.add(mesh);
  SS.planetMeshes.push(mesh);
  if (name === 'Earth') SS.earthMesh = mesh;
  if (name === 'Saturn') {
    const ring = new THREE.Mesh(new THREE.RingGeometry(sc * 1.35, sc * 2.25, 64), new THREE.MeshBasicMaterial({ map: planetTex('Saturn'), side: THREE.DoubleSide, transparent: true, opacity: 0.7, depthWrite: false }));
    ring.rotation.x = Math.PI / 2 - 0.35;
    mesh.add(ring);
  }
  SS.planets.push({ name, mesh, label: makeLabel(name), orbit: r, period: PERIOD[name], init: ang, spin: ROT_SPIN[name] });
}
function buildMoon() {
  const g = new THREE.Group();
  const moon = new THREE.Mesh(new THREE.SphereGeometry(0.32, 24, 24), new THREE.MeshStandardMaterial({ color: 0xb8b8b8, roughness: 1 }));
  const pts = [];
  for (let i = 0; i < 48; i++) pts.push(new THREE.Vector3(1.05 * Math.cos((i / 48) * TAU), 0, 1.05 * Math.sin((i / 48) * TAU)));
  g.add(moon);
  g.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x7a8ba5, transparent: true, opacity: 0.3 })));
  SS.scene.add(g);
  SS.moon = g;
  SS.moonMesh = moon;
}
function ringSegments(ring, R, out) {
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length];
    out.push(lonLatToVec(a[1], a[0], R), lonLatToVec(b[1], b[0], R));
  }
}
function resampleRing(ring, R, out) {
  for (let i = 0, n = ring.length; i < n; i++) {
    const a = lonLatToVec(ring[i][1], ring[i][0], 1);
    const b = lonLatToVec(ring[(i + 1) % n][1], ring[(i + 1) % n][0], 1);
    const ang = Math.acos(Math.max(-1, Math.min(1, a.dot(b))));
    const steps = Math.max(1, Math.ceil(ang / 0.05));
    for (let s = 0; s < steps; s++) {
      out.push(new THREE.Vector3().lerpVectors(a, b, s / steps).normalize().multiplyScalar(R));
    }
  }
}
function ring3D (ring, R) {
  const c = new THREE.Vector3();
  for (const p of ring) c.add(lonLatToVec(p[1], p[0], 1));
  if (!c.lengthSq()) c.set(0, 1, 0);
  return c.normalize().multiplyScalar(R);
}
function buildCountryFillMesh(f) {
  const R = SCALE.Earth * 1.009;
  const positions = [];
  const indices = [];
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  for (const poly of polys) {
    const outer = poly[0];
    if (!outer || outer.length < 3) continue;
    const ring = [];
    resampleRing(outer, R, ring);
    if (ring.length < 3) continue;
    const c = ring3D(outer, R);
    const base = positions.length / 3;
    positions.push(c.x, c.y, c.z);
    for (const v of ring) positions.push(v.x, v.y, v.z);
    for (let i = 0; i < ring.length; i++) {
      indices.push(base, base + 1 + i, base + 1 + ((i + 1) % ring.length));
    }
  }
  if (!positions.length) return null;
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ color: 0xffb74d, transparent: true, opacity: 0.2, side: THREE.DoubleSide, depthWrite: false });
  const mesh = new THREE.Mesh(geo, mat);
  SS.scene.add(mesh);
  return mesh;
}
function countryBounds(f) {
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let minX = 1e9, minY = 1e9, maxX = -1e9, maxY = -1e9;
  for (const poly of polys) {
    const bb = polyBBox(poly);
    minX = Math.min(minX, bb.minX); minY = Math.min(minY, bb.minY);
    maxX = Math.max(maxX, bb.maxX); maxY = Math.max(maxY, bb.maxY);
  }
  return { minX, minY, maxX, maxY };
}
function buildCountries() {
  const R = SCALE.Earth * 1.006;
  for (const f of SS.geo || []) {
    f._bb = countryBounds(f);
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const pts = [];
    for (const poly of polys) for (const ring of poly) if (ring.length >= 3) ringSegments(ring, R, pts);
    if (!pts.length) continue;
    const seg = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(pts), MESH_NORMAL);
    SS.scene.add(seg);
    SS.countryMesh.push(seg);
    SS.countryIndex.set(f.properties.id, { seg, feature: f });
  }
  SS.pick = new THREE.Mesh(new THREE.SphereGeometry(SCALE.Earth * 1.02, 32, 32), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
  SS.scene.add(SS.pick);
}
function buildSolarSystem(geo) {
  disposeSolar();
  SS.geo = geo;
  const stage = document.getElementById('stage');
  const w = stage.clientWidth || window.innerWidth;
  const h = stage.clientHeight || window.innerHeight;
  if (typeof THREE === 'undefined') {
    document.getElementById('webglFallback').classList.remove('hidden');
    return;
  }
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    document.getElementById('webglFallback').classList.remove('hidden');
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, { high: 1.75, med: 1.25, low: 1 }[settings.quality] || 1));
  renderer.setSize(w, h);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04060c);
  const camera = new THREE.PerspectiveCamera(55, w / h, 0.1, 2400);
  camera.position.set(20, 85, 225);
  const controls = new THREE.OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.minDistance = 8;
  controls.maxDistance = 1000;
  controls.autoRotate = settings.autoRotate;
  controls.autoRotateSpeed = 0.35;
  controls.maxPolarAngle = Math.PI * 0.94;
  controls.minPolarAngle = 0.06;
  SS.renderer = renderer; SS.scene = scene; SS.camera = camera; SS.controls = controls; SS.quality = settings.quality;
  buildSun();
  SS.stars = buildStars({ high: 1800, med: 1100, low: 500 }[settings.quality] || 500);
  buildOrbits();
  for (const name of Object.keys(ORBIT)) buildPlanet(name);
  buildMoon();
  buildCountries();
  stage.appendChild(renderer.domElement);
  bindSolar();
  SS._resize = onSolarResize;
  window.addEventListener('resize', SS._resize);
  SS.ready = true;
  if (!SS._animStarted) {
    SS._animStarted = true;
    requestAnimationFrame(animate);
  }
}