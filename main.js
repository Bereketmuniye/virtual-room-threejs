import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';

// DOM Elements
const container = document.getElementById('canvas-container');
const loadingScreen = document.getElementById('loading-screen');
const progressBar = document.getElementById('progress-bar');
const loadingPercentage = document.getElementById('loading-percentage');
const resetBtn = document.getElementById('reset-camera-btn');
const autoRotateBtn = document.getElementById('auto-rotate-btn');
const infoPopup = document.getElementById('info-popup');
const infoTitle = document.getElementById('info-title');

// Interactivity Raycaster
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2(-1, -1);
let hoveredObject = null;

// Scene setup
const scene = new THREE.Scene();
// No background color set here, making the scene transparent so the CSS radial gradient shows through

// Camera setup
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 10000);
const initialCameraPosition = new THREE.Vector3(0, 5, 20); // Setup standard isometric view
camera.position.copy(initialCameraPosition);

// Renderer setup
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
container.appendChild(renderer.domElement);

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 1;
controls.maxDistance = 5000;
// controls.maxPolarAngle = Math.PI / 2 + 0.1; // Limit angle if expecting a ground model
controls.listenToKeyEvents(window); // Enable default keyboard interactivity (Arrow keys)
controls.keyPanSpeed = 25.0;

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 1.5);
directionalLight.position.set(100, 200, 50);
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 2048;
directionalLight.shadow.mapSize.height = 2048;
directionalLight.shadow.camera.left = -50;
directionalLight.shadow.camera.right = 50;
directionalLight.shadow.camera.top = 50;
directionalLight.shadow.camera.bottom = -50;
scene.add(directionalLight);

const fillLight = new THREE.DirectionalLight(0xa5b4fc, 0.8);
fillLight.position.set(-100, 50, -50);
scene.add(fillLight);

// Handle Window Resize
window.addEventListener('resize', onWindowResize, false);
function onWindowResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

// Interactivity Events
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

      // Target is 25% away from the clicked point
      const targetCamPos = point.clone().add(dir.multiplyScalar(dist * 0.25));

      const startPos = camera.position.clone();
      const startTarget = controls.target.clone();
      let animTime = 0;
      const duration = 45;

      controls.enabled = false; // Disable controls during animation

      function animateZoom() {
        animTime++;
        const t = Math.min(1, animTime / duration);
        const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

        camera.position.lerpVectors(startPos, targetCamPos, ease);
        controls.target.lerpVectors(startTarget, point, ease);
        controls.update();

        if (animTime < duration) {
          requestAnimationFrame(animateZoom);
        } else {
          controls.enabled = true; // Re-enable controls
        }
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
      infoTitle.textContent = object.name || "Geometry Part";
      infoPopup.style.left = (event.clientX + 15) + "px";
      infoPopup.style.top = (event.clientY + 15) + "px";
      infoPopup.classList.add('visible');

      const origScale = object.scale.clone();
      object.scale.multiplyScalar(1.05);
      setTimeout(() => { if (object) object.scale.copy(origScale); }, 150);
    } else {
      infoPopup.classList.remove('visible');
    }
  }
});

let isAutoRotating = false;
autoRotateBtn.addEventListener('click', () => {
  isAutoRotating = !isAutoRotating;
  controls.autoRotate = isAutoRotating;
  controls.autoRotateSpeed = 2.0;
  autoRotateBtn.style.background = isAutoRotating ? "var(--primary-hover)" : "var(--primary-color)";
  autoRotateBtn.textContent = isAutoRotating ? "Stop Auto-Rotate" : "Auto-Rotate";
});


// Global reference for our model
let rootModel = null;

// Loading Manager & GLTFLoader Setup
const manager = new THREE.LoadingManager();
manager.onProgress = function (url, itemsLoaded, itemsTotal) {
  // Update progress bar
};

// Set up Draco loader in case the GLB uses draco compression
const gltfLoader = new GLTFLoader(manager);
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.6/');
gltfLoader.setDRACOLoader(dracoLoader);

gltfLoader.load(
  '/w booth.glb', // Should be in the public directory
  (gltf) => {
    // success
    rootModel = gltf.scene;

    // Enable shadows for the model
    rootModel.traverse((node) => {
      if (node.isMesh) {
        node.castShadow = true;
        node.receiveShadow = true;

        // Ensure standard materials look good with environment/lights
        if (node.material && node.material.isMeshStandardMaterial) {
          node.material.envMapIntensity = 1.0;
        }
      }
    });

    // Center and scale the model automatically to fit the view
    // Perfectly center the model based on its actual bounding box
    const box = new THREE.Box3().setFromObject(rootModel);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());

    rootModel.position.x += (rootModel.position.x - center.x);
    rootModel.position.y += (rootModel.position.y - center.y);
    rootModel.position.z += (rootModel.position.z - center.z);

    // Adjust camera to fit the model completely
    const maxDim = Math.max(size.x, size.y, size.z) || 10;
    const fov = camera.fov * (Math.PI / 180);
    let cameraZ = Math.abs(maxDim / 2 / Math.tan(fov / 2));
    cameraZ *= 1.5; // Padding

    // Prevent clipping issues with very large or very small models
    camera.near = maxDim / 1000;
    camera.far = maxDim * 10000;

    // Set new camera positions from an isometric-like angle outside the box
    camera.position.set(maxDim * 0.5, maxDim * 0.5, cameraZ);
    camera.updateProjectionMatrix();

    // Update target for OrbitControls
    controls.target.set(0, 0, 0);
    controls.maxDistance = maxDim * 1000;
    controls.update();

    // Cache the updated position for the reset button
    initialCameraPosition.copy(camera.position);

    scene.add(rootModel);

    // Hide loader smoothly
    setTimeout(() => {
      loadingScreen.style.opacity = '0';
      setTimeout(() => {
        loadingScreen.style.display = 'none';
      }, 800);
    }, 500);
  },
  (xhr) => {
    // progress
    const percent = Math.round((xhr.loaded / xhr.total) * 100);
    if (Number.isFinite(percent)) {
      progressBar.style.width = percent + '%';
      loadingPercentage.textContent = percent + '%';
    } else {
      // If the server doesn't respond with content-length
      let mockProgress = (progressBar.style.width).replace('%', '') || 0;
      mockProgress = parseFloat(mockProgress) + 1;
      if (mockProgress > 95) mockProgress = 95;
      progressBar.style.width = mockProgress + '%';
      loadingPercentage.textContent = 'Loading large file...';
    }
  },
  (error) => {
    // error
    console.error('An error happened initializing the GLTF Loader:', error);
    document.getElementById('loading-text').textContent = "Error Loading Model!";
    document.getElementById('loading-text').style.color = "#ef4444";
  }
);

// Reset functionality
resetBtn.addEventListener('click', () => {
  // Animate camera back smoothly using simple interpolation
  const startPos = camera.position.clone();
  const endPos = initialCameraPosition.clone();
  const startTarget = controls.target.clone();
  const endTarget = new THREE.Vector3(0, 0, 0);

  let time = 0;
  const duration = 60; // frames

  function animateReset() {
    time++;
    const t = Math.min(1, time / duration);
    // easeInOutQuad
    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;

    camera.position.lerpVectors(startPos, endPos, ease);
    controls.target.lerpVectors(startTarget, endTarget, ease);

    if (time < duration) {
      requestAnimationFrame(animateReset);
    }
  }

  animateReset();
});

// Render Loop
const clock = new THREE.Clock();
function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();

  raycaster.setFromCamera(mouse, camera);
  if (rootModel) {
    const intersects = raycaster.intersectObject(rootModel, true);
    if (intersects.length > 0) {
      if (hoveredObject !== intersects[0].object) {
        if (hoveredObject && hoveredObject.material) {
          if (hoveredObject.material.color) hoveredObject.material.color.setHex(hoveredObject.currentColor);
        }
        hoveredObject = intersects[0].object;
        if (hoveredObject.material) {
          if (hoveredObject.material.color) {
            hoveredObject.currentColor = hoveredObject.material.color.getHex();
            // Highlight color by blending base with a slight tint
            hoveredObject.material.color.setHex(0xa5b4fc);
          }
        }
      }
    } else {
      if (hoveredObject && hoveredObject.material) {
        if (hoveredObject.material.color) hoveredObject.material.color.setHex(hoveredObject.currentColor);
      }
      hoveredObject = null;
    }
  }

  controls.update();
  renderer.render(scene, camera);
}

animate();
