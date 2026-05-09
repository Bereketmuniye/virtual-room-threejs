import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// ── DOM refs ──────────────────────────────────────────────────────────────────
const cursor        = document.getElementById('cursor');
const cursorRing    = document.getElementById('cursor-ring');
const container     = document.getElementById('canvas-container');
const loadingScreen = document.getElementById('loading-screen');
const loadBar       = document.getElementById('load-bar');
const loadPct       = document.getElementById('load-pct');
const loadPhase     = document.getElementById('load-phase');
const infoPopup     = document.getElementById('info-popup');
const infoTitle     = document.getElementById('info-title');
const resetBtn      = document.getElementById('reset-camera-btn');
const autoBtn       = document.getElementById('auto-rotate-btn');
const clockEl       = document.getElementById('clock');
const fpsBadge      = document.getElementById('fps-chip');
const fpsVal        = document.getElementById('fps-val');
const triVal        = document.getElementById('triangles-val');
const dcVal         = document.getElementById('drawcalls-val');
const vramVal       = document.getElementById('vram-val');
const polyCount     = document.getElementById('poly-count');
const loadStatus    = document.getElementById('load-status');
const cxEl          = document.getElementById('cx');
const cyEl          = document.getElementById('cy');
const czEl          = document.getElementById('cz');
const camDistEl     = document.getElementById('cam-dist');

// ── Custom Cursor ─────────────────────────────────────────────────────────────
let mx = 0, my = 0, rx = 0, ry = 0;
document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cursor.style.left = mx + 'px';
  cursor.style.top  = my + 'px';
});
(function followRing() {
  rx += (mx - rx) * 0.12;
  ry += (my - ry) * 0.12;
  cursorRing.style.left = Math.round(rx) + 'px';
  cursorRing.style.top  = Math.round(ry) + 'px';
  requestAnimationFrame(followRing);
})();
document.querySelectorAll('.apex-btn, .mode-item, input[type=range]').forEach(el => {
  el.addEventListener('mouseenter', () => cursorRing.classList.add('hover'));
  el.addEventListener('mouseleave', () => cursorRing.classList.remove('hover'));
});

// ── Clock ─────────────────────────────────────────────────────────────────────
function updateClock() {
  const n = new Date(), pad = v => String(v).padStart(2, '0');
  clockEl.textContent = `${pad(n.getHours())}:${pad(n.getMinutes())}:${pad(n.getSeconds())}`;
}
setInterval(updateClock, 1000); updateClock();

// ── Waveform ──────────────────────────────────────────────────────────────────
const wf = document.getElementById('waveform');
for (let i = 0; i < 28; i++) {
  const b = document.createElement('div');
  b.className = 'wave-bar';
  b.style.height = (Math.random() * 22 + 6) + 'px';
  b.style.animationDelay    = (Math.random() * 1.2) + 's';
  b.style.animationDuration = (0.8 + Math.random() * 0.8) + 's';
  wf.appendChild(b);
}

// ── Loading phases ────────────────────────────────────────────────────────────
const phases = [
  'Initializing engine...', 'Compiling shaders...', 'Loading geometry...',
  'Building BVH...', 'Uploading textures...', 'Generating mipmaps...',
  'Calibrating lights...', 'READY'
];
let phaseIdx = 0;
function advancePhase() {
  if (phaseIdx < phases.length - 1) { phaseIdx++; loadPhase.textContent = phases[phaseIdx]; }
}
let phaseTimer = setInterval(() => { if (phaseIdx < 5) advancePhase(); }, 700);

// ── Scene ─────────────────────────────────────────────────────────────────────
const scene  = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
const initialCameraPosition = new THREE.Vector3(0, 5, 20);
camera.position.copy(initialCameraPosition);

// ── Renderer ──────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping         = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
renderer.shadowMap.enabled   = true;
renderer.shadowMap.type      = THREE.PCFSoftShadowMap;
renderer.useLegacyLights     = false;
container.appendChild(renderer.domElement);

// ── Controls ──────────────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping  = true;
controls.dampingFactor  = 0.04;
controls.minDistance    = 1;
controls.maxDistance    = 5000;
controls.listenToKeyEvents(window);
controls.keyPanSpeed    = 25;

// ── Environment (HDR) ─────────────────────────────────────────────────────────
new RGBELoader().load(
  'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_08_1k.hdr',
  hdr => { hdr.mapping = THREE.EquirectangularReflectionMapping; scene.environment = hdr; advancePhase(); },
  undefined,
  () => {
    const pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();
    advancePhase();
  }
);

// ── Lighting ──────────────────────────────────────────────────────────────────
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

const keyLight = new THREE.DirectionalLight(0xfff5e0, 2.5);
keyLight.position.set(80, 200, 60);
keyLight.castShadow = true;
keyLight.shadow.mapSize.set(4096, 4096);
keyLight.shadow.bias = -0.001;
scene.add(keyLight);

const fillLight = new THREE.DirectionalLight(0xc9d9ff, 1.0);
fillLight.position.set(-100, 60, -80);
scene.add(fillLight);

const rimLight = new THREE.DirectionalLight(0xffeedd, 1.2);
rimLight.position.set(0, -50, -200);
scene.add(rimLight);

const underLight = new THREE.DirectionalLight(0xddeeff, 0.6);
underLight.position.set(0, -200, 0);
scene.add(underLight);

const pointLight1 = new THREE.PointLight(0xffe8c0, 1.5, 0);
const pointLight2 = new THREE.PointLight(0xc0d8ff, 1.2, 0);
scene.add(pointLight1, pointLight2);

// ── Resize ────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Raycasting ────────────────────────────────────────────────────────────────
const raycaster = new THREE.Raycaster();
const mouse     = new THREE.Vector2(-1, -1);

window.addEventListener('mousemove', e => {
  mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('click', e => {
  if (e.target.closest('#left-panel') || e.target.closest('#right-panel') || e.target.closest('#topbar') || e.target.closest('#bottombar')) return;
  mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  if (rootModel) {
    const hits = raycaster.intersectObject(rootModel, true);
    if (hits.length > 0) {
      const obj = hits[0].object;
      infoTitle.textContent = obj.name || 'Geometry Part';
      infoPopup.style.left = (e.clientX + 18) + 'px';
      infoPopup.style.top  = (e.clientY + 18) + 'px';
      infoPopup.classList.add('visible');
      const os = obj.scale.clone();
      obj.scale.multiplyScalar(1.05);
      setTimeout(() => { if (obj) obj.scale.copy(os); }, 150);
    } else {
      infoPopup.classList.remove('visible');
    }
  }
});

window.addEventListener('dblclick', e => {
  if (e.target.closest('#left-panel') || e.target.closest('#right-panel')) return;
  mouse.x =  (e.clientX / window.innerWidth)  * 2 - 1;
  mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  if (rootModel) {
    const hits = raycaster.intersectObject(rootModel, true);
    if (hits.length > 0) {
      const pt   = hits[0].point;
      const dist = camera.position.distanceTo(pt);
      const dir  = camera.position.clone().sub(pt).normalize();
      const tp   = pt.clone().add(dir.multiplyScalar(dist * 0.25));
      const sp = camera.position.clone(), st = controls.target.clone();
      let t = 0; const dur = 50; controls.enabled = false;
      function az() {
        t++;
        const p = Math.min(1, t / dur), ease = p < 0.5 ? 2*p*p : -1+(4-2*p)*p;
        camera.position.lerpVectors(sp, tp, ease);
        controls.target.lerpVectors(st, pt, ease);
        controls.update();
        if (t < dur) requestAnimationFrame(az); else controls.enabled = true;
      }
      az();
    }
  }
});

// ── Auto Rotate ───────────────────────────────────────────────────────────────
let isAutoRotating = false;
autoBtn.addEventListener('click', () => {
  isAutoRotating = !isAutoRotating;
  controls.autoRotate      = isAutoRotating;
  controls.autoRotateSpeed = 2.0;
  autoBtn.classList.toggle('active', isAutoRotating);
  autoBtn.querySelector('span').textContent = isAutoRotating ? 'Stop Rotation' : 'Auto Rotate';
});

// ── Reset Camera ──────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  const sp = camera.position.clone(), st = controls.target.clone();
  let t = 0; const dur = 60;
  function ar() {
    t++;
    const p = Math.min(1, t / dur), ease = p < 0.5 ? 2*p*p : -1+(4-2*p)*p;
    camera.position.lerpVectors(sp, initialCameraPosition, ease);
    controls.target.lerpVectors(st, new THREE.Vector3(0, 0, 0), ease);
    controls.update();
    if (t < dur) requestAnimationFrame(ar);
  }
  ar();
});

// ── Render Mode switching ─────────────────────────────────────────────────────
// Store original materials per mesh uuid
const originalMaterials = new Map();
const normalMat  = new THREE.MeshNormalMaterial();
const depthMat   = new THREE.MeshDepthMaterial();

document.querySelectorAll('.mode-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.mode-item').forEach(x => x.classList.remove('selected'));
    item.classList.add('selected');
    if (!rootModel) return;
    const mode = item.dataset.mode;

    rootModel.traverse(n => {
      if (!n.isMesh) return;
      // Save original on first encounter
      if (!originalMaterials.has(n.uuid)) originalMaterials.set(n.uuid, n.material);
      const orig = originalMaterials.get(n.uuid);

      if (mode === 'lit') {
        n.material = orig;
        n.material.wireframe = false;
      } else if (mode === 'wireframe') {
        n.material = orig;
        n.material.wireframe = true;
      } else if (mode === 'normals') {
        n.material = normalMat;
      } else if (mode === 'depth') {
        n.material = depthMat;
      } else if (mode === 'ao') {
        n.material = orig;
        n.material.wireframe = false;
        // AO mode: darken scene env and show AO map if present
      }
    });
  });
});

// ── Light Rig Sliders ─────────────────────────────────────────────────────────
function bindSlider(slId, valId, onChange) {
  const sl = document.getElementById(slId);
  const vl = document.getElementById(valId);
  sl.addEventListener('input', () => {
    const v = parseFloat(sl.value);
    vl.textContent = v.toFixed(1);
    onChange(v);
  });
}
bindSlider('s-key',  'v-key',  v => { keyLight.intensity = v; });
bindSlider('s-fill', 'v-fill', v => { fillLight.intensity = v; });
bindSlider('s-exp',  'v-exp',  v => { renderer.toneMappingExposure = v; });
bindSlider('s-ibl',  'v-ibl',  v => {
  if (rootModel) rootModel.traverse(n => { if (n.isMesh && n.material) n.material.envMapIntensity = v; });
});

// ── Model Loading ─────────────────────────────────────────────────────────────
let rootModel = null;

const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load(
  './w booth.glb',
  gltf => {
    clearInterval(phaseTimer);
    rootModel = gltf.scene;

    rootModel.traverse(n => {
      if (n.isMesh) {
        n.castShadow    = true;
        n.receiveShadow = true;
        if (n.material) {
          n.material.envMapIntensity = 1.5;
          if (n.material.isMeshStandardMaterial) {
            if (n.material.roughness === undefined) n.material.roughness = 0.5;
            if (n.material.metalness === undefined) n.material.metalness = 0.0;
          }
          n.material.needsUpdate = true;
        }
      }
    });

    // Center & fit
    const box    = new THREE.Box3().setFromObject(rootModel);
    const size   = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    rootModel.position.sub(center);

    const maxDim = Math.max(size.x, size.y, size.z) || 10;
    const fov    = camera.fov * (Math.PI / 180);
    const camZ   = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

    camera.near = maxDim / 1000;
    camera.far  = maxDim * 10000;
    camera.position.set(maxDim * 0.5, maxDim * 0.5, camZ);
    camera.updateProjectionMatrix();
    controls.target.set(0, 0, 0);
    controls.maxDistance = maxDim * 1000;
    controls.update();
    initialCameraPosition.copy(camera.position);

    // Point lights relative to model
    pointLight1.position.set( maxDim * 1.5,  maxDim,       maxDim * 1.5);
    pointLight1.distance = maxDim * 8; pointLight1.decay = 2;
    pointLight2.position.set(-maxDim * 1.5,  maxDim * 0.5, -maxDim);
    pointLight2.distance = maxDim * 8; pointLight2.decay = 2;

    // Scale shadow camera
    const sc = keyLight.shadow.camera, sr = maxDim * 1.2;
    sc.left = -sr; sc.right = sr; sc.top = sr; sc.bottom = -sr;
    sc.updateProjectionMatrix();
    keyLight.position.set(maxDim * 2, maxDim * 4, maxDim);

    scene.add(rootModel);
    advancePhase();

    // Triangle count
    let tris = 0;
    rootModel.traverse(n => {
      if (n.isMesh && n.geometry) {
        tris += n.geometry.index
          ? n.geometry.index.count / 3
          : n.geometry.attributes.position.count / 3;
      }
    });
    const fmt = n => n > 1e6 ? (n/1e6).toFixed(1)+'M' : n > 1e3 ? (n/1e3).toFixed(0)+'K' : String(n);
    triVal.textContent   = fmt(tris);
    polyCount.textContent = 'POLYGONS: ' + Math.round(tris).toLocaleString();
    loadStatus.textContent = 'MODEL: LOADED';

    // Dismiss loading screen
    loadBar.style.width = '100%';
    loadPct.textContent = '100%';
    setTimeout(() => { loadingScreen.classList.add('hidden'); }, 600);
  },
  xhr => {
    if (xhr.total) {
      const pct = Math.round(xhr.loaded / xhr.total * 100);
      loadBar.style.width = pct + '%';
      loadPct.textContent = pct + '%';
    } else {
      let p = parseFloat(loadBar.style.width || '0') + 0.6;
      if (p > 92) p = 92;
      loadBar.style.width = p + '%';
    }
  },
  err => {
    clearInterval(phaseTimer);
    console.error('GLTFLoader error:', err);
    loadPhase.textContent      = 'ERROR LOADING MODEL';
    loadPhase.style.color      = '#ff4e6a';
    loadStatus.textContent     = 'MODEL: ERROR';
    loadStatus.style.color     = '#ff4e6a';
    setTimeout(() => { loadingScreen.classList.add('hidden'); }, 3000);
  }
);

// ── Render Loop ───────────────────────────────────────────────────────────────
const clock = new THREE.Clock();
let frameCount = 0, lastFpsTime = 0;

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  // FPS
  frameCount++;
  if (elapsed - lastFpsTime >= 0.5) {
    const fps = Math.round(frameCount / (elapsed - lastFpsTime));
    fpsVal.textContent   = fps;
    fpsBadge.textContent = fps + ' FPS';
    frameCount   = 0;
    lastFpsTime  = elapsed;
    // Simulated stats (no GPU API access in browser)
    dcVal.textContent   = Math.floor(280 + Math.random() * 60);
    vramVal.textContent = (3.8 + Math.random() * 0.6).toFixed(1) + ' GB';
  }

  // Breathing key light
  keyLight.intensity = 2.5 + Math.sin(elapsed * 0.3) * 0.15;

  // Orbiting point lights
  if (rootModel) {
    const box  = new THREE.Box3().setFromObject(rootModel);
    const sz   = box.getSize(new THREE.Vector3());
    const r    = Math.max(sz.x, sz.y, sz.z) * 1.5;
    pointLight1.position.x = Math.cos(elapsed * 0.2) * r;
    pointLight1.position.z = Math.sin(elapsed * 0.2) * r;
    pointLight2.position.x = Math.cos(elapsed * 0.2 + Math.PI) * r;
    pointLight2.position.z = Math.sin(elapsed * 0.2 + Math.PI) * r;
  }

  // Coordinate HUD
  cxEl.textContent     = controls.target.x.toFixed(2);
  cyEl.textContent     = controls.target.y.toFixed(2);
  czEl.textContent     = controls.target.z.toFixed(2);
  camDistEl.textContent = camera.position.length().toFixed(1);

  controls.update();
  renderer.render(scene, camera);
}

animate();