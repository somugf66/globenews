/* GlobeNews Live — interaction, animation, lifecycle (solar-ui) */
const PICK_PLANETS = () => [SS.pick].concat(SS.planetMeshes.filter((m) => m !== SS.earthMesh));

function enterEarthFocus() {
  if (SS.earthFocus) return;
  SS.earthFocus = true;
  if (SS.controls) SS.controls.autoRotate = false;
  const b = document.getElementById('solarViewBtn');
  if (b) b.classList.remove('hidden');
  const e = SS.planets.find((p) => p.name === 'Earth');
  if (e) focusObject(e.mesh.position.clone(), Math.max(14, SCALE.Earth * 9));
}
function exitEarthFocus() {
  if (!SS.earthFocus) return;
  SS.earthFocus = false;
  if (SS.controls) SS.controls.autoRotate = settings.autoRotate;
  const b = document.getElementById('solarViewBtn');
  if (b) b.classList.add('hidden');
}
function solarViewHome() {
  exitEarthFocus();
  focusObject(new THREE.Vector3(0, 0, 0), 240);
}
(function () {
  const b = document.getElementById('solarViewBtn');
  if (b) b.addEventListener('click', solarViewHome);
})();

function bindSolar() {
  SS.canvas = SS.renderer.domElement;
  SS.canvas.addEventListener('pointerdown', onSolarDown);
  SS.canvas.addEventListener('pointermove', onSolarMove);
}
function pointerNdc(e) {
  const r = SS.canvas.getBoundingClientRect();
  SS.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
}
function rayHit() {
  if (!SS.raycaster) SS.raycaster = new THREE.Raycaster();
  SS.raycaster.setFromCamera(SS.pointer, SS.camera);
  return SS.raycaster.intersectObjects(PICK_PLANETS(), false);
}
function countryFromPoint(plt) {
  const lat = Math.asin(THREE.MathUtils.clamp(plt.y / (SCALE.Earth * 1.02), -1, 1)) * 180 / Math.PI;
  const lng = Math.atan2(plt.x, plt.z) * 180 / Math.PI;
  for (const [id, c] of SS.countryIndex) {
    if (pointInCountry(lat, lng, c.feature)) return id;
  }
  return null;
}
function setHoverCountry(id) {
  if (!SS.ready || SS.hoverId === id) return;
  const prev = SS.hoverId;
  SS.hoverId = id;
  if (prev) styleCountry(prev);
  if (id) styleCountry(id);
}
function setHoverPlanet(name) {
  if (SS._hotLabel) {
    SS._hotLabel.classList.remove('hot');
    SS._hotLabel = null;
  }
  if (SS.ready && name) {
    const p = SS.planets.find((pl) => pl.name === name);
    if (p) {
      p.label.wrap.classList.add('hot');
      SS._hotLabel = p.label.wrap;
    }
  }
}
function styleCountry(id) {
  const c = SS.countryIndex.get(id);
  if (!c) return;
  c.seg.material = id === SS.hoverId ? MESH_HOVER : (id === SS.curCountry ? MESH_SEL : MESH_NORMAL);
}
function selectCountry(id) {
  const prev = SS.curCountry;
  SS.curCountry = id;
  if (prev && SS.countryIndex.has(prev)) styleCountry(prev);
  if (id && SS.countryIndex.has(id)) styleCountry(id);
  setCountryFill(id);
}
function setCountryFill(id) {
  if (SS.fillMesh && SS.scene) {
    SS.scene.remove(SS.fillMesh);
    if (SS.fillMesh.geometry) SS.fillMesh.geometry.dispose();
    if (SS.fillMesh.material) SS.fillMesh.material.dispose();
    SS.fillMesh = null;
  }
  if (!SS.ready || !id || !SS.countryIndex.has(id)) return;
  const c = SS.countryIndex.get(id);
  SS.fillMesh = buildCountryFillMesh(c.feature);
}
function focusObject(target, dist) {
  if (!SS.controls) return;
  const dir = SS.camera.position.clone().sub(SS.controls.target).normalize();
  const d = dist || Math.max(12, SS.camera.position.distanceTo(SS.controls.target) * 0.35);
  SS.tween = {
    t0: performance.now(), dur: 850,
    fromTarget: SS.controls.target.clone(), toTarget: target.clone(),
    fromCam: SS.camera.position.clone(), toCam: target.clone().add(dir.clone().multiplyScalar(d)),
  };
}
let _pickPending = false;
function onSolarMove(e) {
  if (!SS.ready) return;
  pointerNdc(e);
  if (_pickPending) return;
  _pickPending = true;
  requestAnimationFrame(() => {
    _pickPending = false;
    if (!SS.ready) return;
    const hits = rayHit();
    const f = SS.canvas;
    if (!hits.length) {
      f.style.cursor = '';
      setHoverCountry(null);
      setHoverPlanet(null);
      return;
    }
    const o = hits[0].object;
    if (o === SS.pick) {
      setHoverPlanet(null);
      const id = countryFromPoint(hits[0].point);
      setHoverCountry(id);
      f.style.cursor = id ? 'pointer' : '';
    } else {
      setHoverCountry(null);
      const p = SS.planets.find((pl) => pl.mesh === o);
      setHoverPlanet(p ? p.name : null);
      f.style.cursor = 'pointer';
    }
  });
}
function onSolarDown(e) {
  if (!SS.ready) return;
  pointerNdc(e);
  const hits = rayHit();
  if (!hits.length) return;
  const o = hits[0].object;
  if (o === SS.pick) {
    if (!SS.earthFocus) {
      enterEarthFocus();
      return;
    }
    const id = countryFromPoint(hits[0].point);
    if (id) {
      selectCountry(id);
      const f = SS.countryIndex.get(id).feature;
      if (typeof countryPicked === 'function') countryPicked(id, f.properties.name);
      focusObject(lonLatToVec(f.properties.lat, f.properties.lng, SCALE.Earth * 0.4), 26);
    }
  } else {
    exitEarthFocus();
    const p = SS.planets.find((pl) => pl.mesh === o);
    if (p) {
      if (typeof showPlanetInfo === 'function') showPlanetInfo(p.name);
      focusObject(p.mesh.position.clone(), Math.max(12, SCALE[p.name] * 12));
    }
  }
}
function updateTween(now) {
  const t = SS.tween;
  if (!t) return;
  const k = Math.min(1, (now - t.t0) / t.dur);
  const e = 1 - Math.pow(1 - k, 3);
  SS.controls.target.lerpVectors(t.fromTarget, t.toTarget, e);
  SS.camera.position.lerpVectors(t.fromCam, t.toCam, e);
  if (k >= 1) SS.tween = null;
}
function updateLabels() {
  const w = SS.canvas.clientWidth, h = SS.canvas.clientHeight;
  for (const p of SS.planets) {
    const L = p.label;
    if (!L) continue;
    const v = L.pos.clone().project(SS.camera);
    if (v.z > 1 || v.z < -1) {
      L.wrap.style.display = 'none';
      continue;
    }
    L.wrap.style.transform = 'translate3d(' + ((v.x * 0.5 + 0.5) * w).toFixed(1) + 'px,' + ((-v.y * 0.5 + 0.5) * h).toFixed(1) + 'px,0) translate(-50%, -150%)';
    L.wrap.style.display = 'block';
  }
}
function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, (now - (SS._last || now)) / 1000);
  SS._last = now;
  updateTween(now);
  const speed = SS.earthFocus ? 0 : (settings.orbitSpeed || 1);
  SS.sim.days += dt * speed * 8;
  const d = SS.sim.days;
  const e = SS.planets[2];
  if (SS.moonMesh && e) {
    SS.moonMesh.position.set(e.mesh.position.x + 1.05 * Math.cos((d / 27.3) * TAU), 0, e.mesh.position.z + 1.05 * Math.sin((d / 27.3) * TAU));
  }
  for (const p of SS.planets) {
    const a = p.init + (d / p.period) * TAU;
    p.mesh.position.set(p.orbit * Math.cos(a), 0, p.orbit * Math.sin(a));
    p.mesh.rotation.y += dt * p.spin;
    p.label.pos.set(p.mesh.position.x, p.mesh.position.y + SCALE[p.name] * 1.7, p.mesh.position.z);
  }
  if (SS.sunGlow) SS.sunGlow.material.opacity = 0.72 + Math.sin(now / 700) * 0.1;
  if (SS.sunMesh) SS.sunMesh.rotation.y += dt * 0.08;
  if (SS.sunShader) SS.sunShader.uniforms.uTime.value = now / 1000;
  if (settings.labels) updateLabels();
  if (SS.controls) SS.controls.update();
  if (SS.renderer && SS.scene && SS.camera) SS.renderer.render(SS.scene, SS.camera);
}
function onSolarResize() {
  if (!SS.ready) return;
  const stage = document.getElementById('stage');
  const w = stage.clientWidth, h = stage.clientHeight;
  if (SS.camera) {
    SS.camera.aspect = w / h;
    SS.camera.updateProjectionMatrix();
  }
  if (SS.renderer) SS.renderer.setSize(w, h);
}
function disposeSolar() {
  if (SS._resize) {
    window.removeEventListener('resize', SS._resize);
    SS._resize = null;
  }
  if (SS.canvas) {
    SS.canvas.removeEventListener('pointerdown', onSolarDown);
    SS.canvas.removeEventListener('pointermove', onSolarMove);
    if (SS.canvas.parentNode) SS.canvas.parentNode.removeChild(SS.canvas);
    SS.canvas = null;
  }
  if (SS.renderer) SS.renderer.dispose();
  if (SS.scene) {
    SS.scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
        else o.material.dispose();
      }
    });
    SS.scene = null;
  }
  for (const w of SS._labelEls) if (w.parentNode) w.parentNode.removeChild(w);
  SS._labelEls = [];
  if (SS.fillMesh) {
    if (SS.fillMesh.geometry) SS.fillMesh.geometry.dispose();
    if (SS.fillMesh.material) SS.fillMesh.material.dispose();
    SS.fillMesh = null;
  }
  SS.planets = []; SS.planetMeshes = []; SS.countryMesh = []; SS.countryIndex.clear();
  SS.earthMesh = null; SS.pick = null; SS.curCountry = null; SS.hoverId = null;
  SS.moon = null; SS.moonMesh = null; SS.tween = null; SS._hotLabel = null; SS.earthFocus = false;
  SS.sunMesh = null; SS.sunShader = null;
}
function solarSetQuality() {
  if (!SS.ready || SS.quality === settings.quality) return;
  buildSolarSystem(SS.geo);
}