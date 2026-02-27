import * as THREE from 'three';
import { FlyControls } from 'three/addons/controls/FlyControls.js';
import { setupEffects, updateEffects } from './effects.js';
import { buildWorld, updateWorld, anomalyPositions } from './world.js';
import { setupAudio, updateAudio, triggerPill } from './audio.js';

// --- Setup scene, camera, renderer ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510); // deep purple/black
scene.fog = new THREE.FogExp2(0x050510, 0.008);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 10, 20);

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(window.devicePixelRatio);
renderer.toneMapping = THREE.ReinhardToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.appendChild(renderer.domElement);

// --- Controls (fly mode) ---
const controls = new FlyControls(camera, renderer.domElement);
controls.movementSpeed = 10;
controls.rollSpeed = 0.5;
controls.dragToLook = true; // click + drag to rotate

// --- Build the world (geometry, lights, objects) ---
buildWorld(scene);

// --- Set up audio (listener attached to camera) ---
const listener = new THREE.AudioListener();
camera.add(listener);
setupAudio(scene, listener);

// --- Set up post-processing effects (bloom, RGB shift) ---
const composer = setupEffects(scene, camera, renderer);

// --- State for pill effect ---
let pillIntensity = 0.0; // additional intensity from pill (fades over time)

// --- Animation loop ---
const clock = new THREE.Clock();

function animate() {
    const delta = clock.getDelta();
    const elapsedTime = performance.now() / 1000;

    // Update controls
    controls.update(delta);

    // Update world animations (slow rotations)
    updateWorld(elapsedTime);

    // Compute intensity based on proximity to anomaly points (from world.js)
    let baseIntensity = 0;
    anomalyPositions.forEach(pos => {
        const dist = camera.position.distanceTo(pos);
        if (dist < 40) {
            baseIntensity += (1 - dist / 40) * 0.33; // up to ~1 if multiple overlap
        }
    });
    baseIntensity = Math.min(baseIntensity, 1);

    // Pill effect fades over ~5 seconds
    if (pillIntensity > 0) {
        pillIntensity *= 0.99; // exponential fade
        if (pillIntensity < 0.01) pillIntensity = 0;
    }
    const totalIntensity = Math.min(1, baseIntensity + pillIntensity);

    // Update effects (bloom, RGB shift) based on total intensity
    updateEffects(totalIntensity);

    // Update audio (background music volume, etc.)
    updateAudio(totalIntensity);

    // Render via composer
    composer.render();

    requestAnimationFrame(animate);
}
animate();

// --- Resize handler ---
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
    composer.setSize(window.innerWidth, window.innerHeight);
});

// --- Pill interaction (key E) ---
window.addEventListener('keydown', (e) => {
    if (e.code === 'KeyE') {
        triggerPill();          // play pill sound
        pillIntensity = 1.0;    // boost visual intensity
    }
});