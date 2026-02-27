import * as THREE from 'three';

let listener;
let audioLoader;
let backgroundMusic;
let pillSound;
let sounds = []; // for potential future use

export function setupAudio(scene, audioListener) {
    listener = audioListener;
    audioLoader = new THREE.AudioLoader();

    // --- Background music (non‑positional, loops) ---
    backgroundMusic = new THREE.Audio(listener);
    audioLoader.load('sounds/music.mp3', (buffer) => {
        backgroundMusic.setBuffer(buffer);
        backgroundMusic.setLoop(true);
        backgroundMusic.setVolume(0.5);
        backgroundMusic.play();
    });

    // --- Heartbeat sources (positional) ---
    const heartbeatPositions = [
        { x: 30, y: 5, z: 30 },
        { x: -40, y: 8, z: -20 },
        { x: 10, y: 12, z: -50 },
        { x: -30, y: 3, z: 40 },
        { x: 55, y: 15, z: -55 },
        { x: -55, y: 7, z: 55 }
    ];
    heartbeatPositions.forEach(pos => {
        const sound = new THREE.PositionalAudio(listener);
        audioLoader.load('sounds/heartbeat.mp3', (buffer) => {
            sound.setBuffer(buffer);
            sound.setRefDistance(20);
            sound.setLoop(true);
            sound.setVolume(0.8);
            sound.play();
        });
        sound.position.set(pos.x, pos.y, pos.z);
        scene.add(sound);
    });

    // --- Additional ambient sounds (positional) ---
    const ambientFiles = ['whisper.mp3', 'drone.mp3', 'chime.mp3', 'pad.mp3'];
    for (let i = 0; i < 12; i++) {
        const file = ambientFiles[Math.floor(Math.random() * ambientFiles.length)];
        const sound = new THREE.PositionalAudio(listener);
        audioLoader.load('sounds/' + file, (buffer) => {
            sound.setBuffer(buffer);
            sound.setRefDistance(25);
            sound.setLoop(true);
            sound.setVolume(0.3 + Math.random() * 0.5);
            sound.play();
        });
        // Random positions in a ring
        const angle = Math.random() * Math.PI * 2;
        const radius = 40 + Math.random() * 80;
        sound.position.x = Math.cos(angle) * radius;
        sound.position.z = Math.sin(angle) * radius;
        sound.position.y = 5 + Math.random() * 20;
        scene.add(sound);
    }

    // --- Pill sound (non‑positional, triggered) ---
    pillSound = new THREE.Audio(listener);
    audioLoader.load('sounds/take_pill.mp3', (buffer) => {
        pillSound.setBuffer(buffer);
        pillSound.setVolume(0.8);
    });
}

// Called every frame – here we adjust background music volume based on intensity
export function updateAudio(intensity) {
    if (backgroundMusic) {
        // Make music louder as intensity increases (0.3 → 1.0)
        backgroundMusic.setVolume(0.3 + intensity * 0.7);
    }
}

// Triggered by pressing E
export function triggerPill() {
    if (pillSound && pillSound.buffer) {
        if (pillSound.isPlaying) pillSound.stop();
        pillSound.play();
    }
}