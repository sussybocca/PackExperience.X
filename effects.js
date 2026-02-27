import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { FilmPass } from 'three/addons/postprocessing/FilmPass.js';
import { RGBShiftShader } from 'three/addons/shaders/RGBShiftShader.js';

// Custom vignette shader
const VignetteShader = {
    uniforms: {
        tDiffuse: { value: null },
        offset: { value: 1.0 },
        darkness: { value: 1.0 }
    },
    vertexShader: `
        varying vec2 vUv;
        void main() {
            vUv = uv;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        uniform sampler2D tDiffuse;
        uniform float offset;
        uniform float darkness;
        varying vec2 vUv;

        void main() {
            vec4 color = texture2D(tDiffuse, vUv);
            float dist = distance(vUv, vec2(0.5, 0.5));
            float vignette = smoothstep(0.8, offset * 0.5, dist);
            color.rgb = mix(color.rgb, color.rgb * darkness, vignette);
            gl_FragColor = color;
        }
    `
};

let bloomPass, rgbShiftPass, filmPass, vignettePass;

export function setupEffects(scene, camera, renderer) {
    const renderScene = new RenderPass(scene, camera);

    // --- Bloom Pass ---
    bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
    bloomPass.threshold = 0.1;
    bloomPass.strength = 1.2;
    bloomPass.radius = 0.5;

    // --- RGB Shift Pass (chromatic aberration) ---
    rgbShiftPass = new ShaderPass(RGBShiftShader);
    rgbShiftPass.uniforms['amount'].value = 0.0025;

    // --- Film Pass (grain & scanlines) ---
    filmPass = new FilmPass(0.35, 0.5, 2048, false); // noise intensity, scanline intensity, scanline count, grayscale
    filmPass.renderToScreen = false; // we'll let vignette be the last

    // --- Vignette Pass ---
    vignettePass = new ShaderPass(VignetteShader);
    vignettePass.uniforms['offset'].value = 0.8;
    vignettePass.uniforms['darkness'].value = 1.2;

    // --- Compose in order: bloom -> rgb shift -> film -> vignette ---
    const composer = new EffectComposer(renderer);
    composer.addPass(renderScene);
    composer.addPass(bloomPass);
    composer.addPass(rgbShiftPass);
    composer.addPass(filmPass);
    composer.addPass(vignettePass);
    vignettePass.renderToScreen = true; // last pass renders to screen

    return composer;
}

// Called every frame with intensity (0–1)
export function updateEffects(intensity) {
    // Bloom: strength and radius increase with intensity
    if (bloomPass) {
        bloomPass.strength = 0.8 + intensity * 2.0;      // 0.8 → 2.8
        bloomPass.radius = 0.3 + intensity * 0.7;        // 0.3 → 1.0
    }

    // RGB shift: amount increases with intensity
    if (rgbShiftPass) {
        rgbShiftPass.uniforms['amount'].value = 0.001 + intensity * 0.012; // 0.001 → 0.013
    }

    // Film grain: noise intensity and scanlines increase
    if (filmPass) {
        // CORRECTED: use nIntensity and sIntensity (not intensity/scanlines)
        filmPass.uniforms.nIntensity.value = 0.2 + intensity * 0.8;      // noise intensity
        filmPass.uniforms.sIntensity.value = 0.3 + intensity * 0.7;      // scanline intensity
    }

    // Vignette: edges darken with intensity
    if (vignettePass) {
        vignettePass.uniforms['offset'].value = 0.9 - intensity * 0.4;   // 0.9 → 0.5 (smaller offset = stronger vignette)
        vignettePass.uniforms['darkness'].value = 1.0 + intensity * 0.8; // 1.0 → 1.8 (darker)
    }
}