import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

// DOM Elements
const container = document.getElementById('canvas-container');
const loadingScreen = document.getElementById('loading-screen');
const progressBar = document.getElementById('progress-bar');
const loadingPercentage = document.getElementById('loading-percentage');
const resetBtn = document.getElementById('reset-camera-btn');
const autoRotateBtn = document.getElementById('auto-rotate-btn');
const infoPopup = document.getElementById('info-popup');
const infoTitle = document.getElementById('info-title');

// Raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-1, -1);

// ─── Scene ───────────────────────────────────────────────────────────────────
const scene = new THREE.Scene();

// ─── Camera ──────────────────────────────────────────────────────────────────
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
const initialCameraPosition = new THREE.Vector3(0, 5, 20);
camera.position.copy(initialCameraPosition);

// ─── Renderer ────────────────────────────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

// ACES filmic tone mapping + boosted exposure = cinematic / real-world feel
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

// Physically correct lighting mode
renderer.useLegacyLights = false;

container.appendChild(renderer.domElement);

// ─── Controls ────────────────────────────────────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1;
controls.maxDistance = 5000;
controls.listenToKeyEvents(window);
controls.keyPanSpeed = 25.0;

// ─── ENVIRONMENT MAP (HDR) ───────────────────────────────────────────────────
// Uses a free public HDR from Poly Haven CDN — gives real reflections & GI
const rgbeLoader = new RGBELoader();
rgbeLoader.load(
  'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/studio_small_08_1k.hdr',
  (hdrTexture) => {
    hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
    // Use as scene environment (reflections/GI) but NOT as background
    scene.environment = hdrTexture;
    // Optionally show subtle sky: comment out if you want transparent bg
    // scene.background = hdrTexture;
  },
  undefined,
  () => {
    // Fallback: if HDR fails (offline / CORS) generate a synthetic env
    console.warn('HDR load failed, using procedural environment');
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    // Build a simple gradient environment texture
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x444444);
    const envRT = pmremGenerator.fromScene(new THREE.RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;
    pmremGenerator.dispose();
  }
);

// ─── LIGHTING RIG ────────────────────────────────────────────────────────────
// 1. Ambient — base fill so nothing goes pitch black
const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
scene.add(ambientLight);

// 2. Key light — main directional, warm sunlight angle
const keyLight = new THREE.DirectionalLight(0xfff5e0, 2.5);
keyLight.position.set(80, 200, 60);
keyLight.castShadow = true;
keyLight.shadow.mapSize.width = 4096;
keyLight.shadow.mapSize.height = 4096;
keyLight.shadow.camera.left = -80;
keyLight.shadow.camera.right = 80;
keyLight.shadow.camera.top = 80;
keyLight.shadow.camera.bottom = -80;
keyLight.shadow.bias = -0.001;
scene.add(keyLight);

// 3. Fill light — cooler, from opposite side to soften shadows
const fillLight = new THREE.DirectionalLight(0xc9d9ff, 1.0);
fillLight.position.set(-100, 60, -80);
scene.add(fillLight);

// 4. Rim / back light — creates edge separation so model "pops"
const rimLight = new THREE.DirectionalLight(0xffeedd, 1.2);
rimLight.position.set(0, -50, -200);
scene.add(rimLight);

// 5. Under-fill — lights the bottom so orbiting under the model looks good
const underLight = new THREE.DirectionalLight(0xddeeff, 0.6);
underLight.position.set(0, -200, 0);
scene.add(underLight);

// 6. Point lights for local warmth & depth (positioned after model loads)
const pointLight1 = new THREE.PointLight(0xffe8c0, 1.5, 0); // warm
const pointLight2 = new THREE.PointLight(0xc0d8ff, 1.2, 0); // cool
scene.add(pointLight1, pointLight2);

// ─── Resize ──────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ─── Mouse / Interaction ─────────────────────────────────────────────────────
window.addEventListener('mousemove', (event) => {
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
});

window.addEventListener('dblclick', (event) => {
  if (event.target.closest('#ui-overlay') || event.target.closest('#info-popup')) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  if (rootModel) {
    const intersects = raycaster.intersectObject(rootModel, true);
    if (intersects.length > 0) {
      const point = intersects[0].point;
      const dist = camera.position.distanceTo(point);
      const dir = camera.position.clone().sub(point).normalize();
      const targetCamPos = point.clone().add(dir.multiplyScalar(dist * 0.25));

      const startPos = camera.position.clone();
      const startTarget = controls.target.clone();
      let animTime = 0;
      const duration = 45;
      controls.enabled = false;

      function animateZoom() {
        animTime++;
        const t = Math.min(1, animTime / duration);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
        camera.position.lerpVectors(startPos, targetCamPos, ease);
        controls.target.lerpVectors(startTarget, point, ease);
        controls.update();
        if (animTime < duration) requestAnimationFrame(animateZoom);
        else controls.enabled = true;
      }
      animateZoom();
    }
  }
});

window.addEventListener('click', (event) => {
  if (event.target.closest('#ui-overlay') || event.target.closest('#info-popup')) return;
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  if (rootModel) {
    const intersects = raycaster.intersectObject(rootModel, true);
    if (intersects.length > 0) {
      const object = intersects[0].object;
      infoTitle.textContent = object.name || 'Geometry Part';
      infoPopup.style.left = (event.clientX + 15) + 'px';
      infoPopup.style.top = (event.clientY + 15) + 'px';
      infoPopup.classList.add('visible');

      const origScale = object.scale.clone();
      object.scale.multiplyScalar(1.05);
      setTimeout(() => { if (object) object.scale.copy(origScale); }, 150);
    } else {
      infoPopup.classList.remove('visible');
    }
  }
});

// ─── Auto-Rotate ─────────────────────────────────────────────────────────────
let isAutoRotating = false;
autoRotateBtn.addEventListener('click', () => {
  isAutoRotating = !isAutoRotating;
  controls.autoRotate = isAutoRotating;
  controls.autoRotateSpeed = 2.0;
  autoRotateBtn.style.background = isAutoRotating ? 'var(--primary-hover)' : 'var(--primary-color)';
  autoRotateBtn.textContent = isAutoRotating ? 'Stop Auto-Rotate' : 'Auto-Rotate';
});

// ─── Model Loading ───────────────────────────────────────────────────────────
let rootModel = null;

const manager = new THREE.LoadingManager();
const gltfLoader = new GLTFLoader(manager);
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load(
  '/w booth.glb',
  (gltf) => {
    rootModel = gltf.scene;

    rootModel.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;

        if (node.material) {
          // Boost env map so HDR reflections actually show
          node.material.envMapIntensity = 1.5;

          // If material has no roughness/metalness defined, give it sane defaults
          if (node.material.isMeshStandardMaterial) {
            if (node.material.roughness === undefined) node.material.roughness = 0.5;
            if (node.material.metalness === undefined) node.material.metalness = 0.0;
          }

          node.material.needsUpdate = true;
        }
      }
    });

    // ── Center & fit ──────────────────────────────────────────────────────
    const box = new THREE.Box3().setFromObject(rootModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    rootModel.position.x += (rootModel.position.x - center.x);
    rootModel.position.y += (rootModel.position.y - center.y);
    rootModel.position.z += (rootModel.position.z - center.z);

    const maxDim = Math.max(size.x, size.y, size.z) || 10;
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2)) * 1.5;

    camera.near = maxDim / 1000;
    camera.far = maxDim * 10000;
    camera.position.set(maxDim * 0.5, maxDim * 0.5, cameraZ);
    camera.updateProjectionMatrix();

    controls.target.set(0, 0, 0);
    controls.maxDistance = maxDim * 1000;
    controls.update();
    initialCameraPosition.copy(camera.position);

    // ── Position point lights relative to model ───────────────────────────
    pointLight1.position.set(maxDim * 1.5, maxDim, maxDim * 1.5);
    pointLight1.distance = maxDim * 8;
    pointLight1.decay = 2;

    pointLight2.position.set(-maxDim * 1.5, maxDim * 0.5, -maxDim);
    pointLight2.distance = maxDim * 8;
    pointLight2.decay = 2;

    // Scale shadow cameras to match model size
    const shadowCam = keyLight.shadow.camera;
    const shadowRange = maxDim * 1.2;
    shadowCam.left = -shadowRange;
    shadowCam.right = shadowRange;
    shadowCam.top = shadowRange;
    shadowCam.bottom = -shadowRange;
    shadowCam.updateProjectionMatrix();
    keyLight.position.set(maxDim * 2, maxDim * 4, maxDim);

    scene.add(rootModel);

    setTimeout(() => {
      loadingScreen.style.opacity = '0';
      setTimeout(() => { loadingScreen.style.display = 'none'; }, 800);
    }, 500);
  },
  (xhr) => {
    const percent = Math.round((xhr.loaded / xhr.total) * 100);
    if (Number.isFinite(percent)) {
      progressBar.style.width = percent + '%';
      loadingPercentage.textContent = percent + '%';
    } else {
      let mock = parseFloat((progressBar.style.width || '0').replace('%', '')) + 1;
      if (mock > 95) mock = 95;
      progressBar.style.width = mock + '%';
      loadingPercentage.textContent = 'Loading…';
    }
  },
  (error) => {
    console.error('GLTFLoader error:', error);
    document.getElementById('loading-text').textContent = 'Error Loading Model!';
    document.getElementById('loading-text').style.color = '#ef4444';
  }
);

// ─── Reset ───────────────────────────────────────────────────────────────────
resetBtn.addEventListener('click', () => {
  const startPos = camera.position.clone();
  const endPos = initialCameraPosition.clone();
  const startTarget = controls.target.clone();
  let time = 0;
  const duration = 60;

  function animateReset() {
    time++;
    const t = Math.min(1, time / duration);
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    camera.position.lerpVectors(startPos, endPos, ease);
    controls.target.lerpVectors(startTarget, new THREE.Vector3(0, 0, 0), ease);
    if (time < duration) requestAnimationFrame(animateReset);
  }
  animateReset();
});

// ─── Render Loop ─────────────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const elapsed = clock.getElapsedTime();

  // Subtle light animation — makes the scene feel alive
  // Key light breathes slightly (simulates soft natural light variation)
  keyLight.intensity = 2.5 + Math.sin(elapsed * 0.3) * 0.15;

  // Point lights orbit slowly around the model for dynamic highlights
  if (rootModel) {
    const box = new THREE.Box3().setFromObject(rootModel);
    const size = box.getSize(new THREE.Vector3());
    const r = Math.max(size.x, size.y, size.z) * 1.5;

    pointLight1.position.x = Math.cos(elapsed * 0.2) * r;
    pointLight1.position.z = Math.sin(elapsed * 0.2) * r;

    pointLight2.position.x = Math.cos(elapsed * 0.2 + Math.PI) * r;
    pointLight2.position.z = Math.sin(elapsed * 0.2 + Math.PI) * r;
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();