import * as THREE from 'three';

// Stores for animation
const animatedObjects = [];          // meshes and points that rotate/drift
const twinklingStars = [];            // for starfield animation (if needed)
const pulsatingLights = [];           // anomaly lights for intensity-based pulsing

// Export anomaly positions for intensity calculation (expanded)
export const anomalyPositions = [];

// --- Helper: generate random pastel color ---
function randomPastel() {
    return new THREE.Color().setHSL(Math.random(), 0.7, 0.6);
}

// --- Helper: create star texture for points ---
function createStarTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 32;
    canvas.height = 32;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.arc(16, 16, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.arc(16, 16, 4, 0, Math.PI * 2);
    ctx.fill();
    return new THREE.CanvasTexture(canvas);
}

// --- Helper: create ground texture with more detail ---
function createGroundTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');
    // Base dark color
    ctx.fillStyle = '#0f0f1f';
    ctx.fillRect(0, 0, 1024, 1024);
    // Draw a grid with glowing lines
    ctx.strokeStyle = '#3a2a5a';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 1024; i += 64) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i, 1024);
        ctx.strokeStyle = '#3a2a5a';
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(1024, i);
        ctx.stroke();
    }
    // Add colored specks (crystal reflections)
    for (let s = 0; s < 10000; s++) {
        ctx.fillStyle = `hsl(${Math.random() * 60 + 260}, 80%, 70%)`;
        ctx.fillRect(Math.floor(Math.random() * 1024), Math.floor(Math.random() * 1024), 2, 2);
    }
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(20, 20);
    return texture;
}

export function buildWorld(scene) {
    // --- Sky & Stars ---
    // 1. Distant starfield (150k particles)
    const starCount = 150000;
    const starsGeo = new THREE.BufferGeometry();
    const starsPos = new Float32Array(starCount * 3);
    const starsCol = new Float32Array(starCount * 3);
    const starsSizes = new Float32Array(starCount);

    for (let i = 0; i < starCount; i++) {
        // Place on a sphere of radius 800–1200
        const r = 800 + Math.random() * 400;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        starsPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
        starsPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        starsPos[i*3+2] = r * Math.cos(phi);

        // Color: white with slight blue/pink tint
        const tint = Math.random() * 0.5 + 0.5;
        starsCol[i*3] = 0.8 + 0.2 * Math.random();
        starsCol[i*3+1] = 0.7 + 0.3 * Math.random();
        starsCol[i*3+2] = 1.0;

        starsSizes[i] = 0.5 + Math.random() * 2;
    }
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starsPos, 3));
    starsGeo.setAttribute('color', new THREE.BufferAttribute(starsCol, 3));
    starsGeo.setAttribute('size', new THREE.BufferAttribute(starsSizes, 1));

    const starsMat = new THREE.PointsMaterial({
        size: 1,
        map: createStarTexture(),
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });
    const stars = new THREE.Points(starsGeo, starsMat);
    scene.add(stars);
    animatedObjects.push(stars); // rotate slowly

    // 2. Galaxy (distant torus knot with particle effect)
    const galaxyGeo = new THREE.TorusKnotGeometry(150, 40, 200, 32);
    const galaxyMat = new THREE.MeshStandardMaterial({
        color: 0x8844aa,
        emissive: 0x331166,
        transparent: true,
        opacity: 0.3,
        side: THREE.DoubleSide
    });
    const galaxy = new THREE.Mesh(galaxyGeo, galaxyMat);
    galaxy.position.set(400, 200, -600);
    galaxy.rotation.x = 0.5;
    galaxy.rotation.y = 0.2;
    scene.add(galaxy);
    animatedObjects.push(galaxy);

    // --- Ground (vast plane with texture) ---
    const groundGeo = new THREE.CircleGeometry(1000, 256);
    const groundMat = new THREE.MeshStandardMaterial({
        map: createGroundTexture(),
        emissive: 0x111122,
        roughness: 0.7,
        metalness: 0.2,
        side: THREE.DoubleSide
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -5; // lower to allow floating islands above
    scene.add(ground);

    // Add a faint glowing grid for orientation
    const gridHelper = new THREE.GridHelper(2000, 200, 0xff88ff, 0x442266);
    gridHelper.position.y = -4.9;
    scene.add(gridHelper);

    // --- Floating Islands (large platforms) ---
    const islandCount = 200;
    const islandGeos = [
        new THREE.DodecahedronGeometry(8, 0),
        new THREE.ConeGeometry(6, 10, 8),
        new THREE.CylinderGeometry(7, 9, 4, 8),
        new THREE.SphereGeometry(7, 7, 4)
    ];
    for (let i = 0; i < islandCount; i++) {
        const geo = islandGeos[Math.floor(Math.random() * islandGeos.length)];
        const mat = new THREE.MeshStandardMaterial({
            color: 0x334466,
            emissive: 0x112233,
            roughness: 0.6,
            metalness: 0.1,
            transparent: true,
            opacity: 0.8
        });
        const island = new THREE.Mesh(geo, mat);
        // Random position in a large disc, at varying heights
        const angle = Math.random() * Math.PI * 2;
        const radius = 100 + Math.random() * 700;
        island.position.x = Math.cos(angle) * radius;
        island.position.z = Math.sin(angle) * radius;
        island.position.y = 10 + Math.random() * 100; // floating high
        island.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        scene.add(island);
        animatedObjects.push(island);

        // Add some small crystals on top of each island
        const crystalCount = 10 + Math.floor(Math.random() * 20);
        for (let j = 0; j < crystalCount; j++) {
            const crystalGeo = new THREE.ConeGeometry(0.8, 2, 5);
            const crystalMat = new THREE.MeshStandardMaterial({
                color: randomPastel(),
                emissive: 0x331133
            });
            const crystal = new THREE.Mesh(crystalGeo, crystalMat);
            crystal.position.set(
                island.position.x + (Math.random() - 0.5) * 6,
                island.position.y + 3 + Math.random() * 4,
                island.position.z + (Math.random() - 0.5) * 6
            );
            crystal.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            scene.add(crystal);
            animatedObjects.push(crystal);
        }
    }

    // --- Massive Instanced Objects (rocks, crystals) ---
    const instanceCount = 20000;
    const rockGeos = [
        new THREE.ConeGeometry(0.4, 1.2, 5),
        new THREE.OctahedronGeometry(0.5),
        new THREE.TetrahedronGeometry(0.6),
        new THREE.CylinderGeometry(0.3, 0.5, 1.0, 6),
        new THREE.IcosahedronGeometry(0.4, 0)
    ];
    const rockColors = [0xaa88ff, 0x88ffaa, 0xffaa88, 0xaaccff, 0xffccaa];

    rockGeos.forEach((geo, idx) => {
        const mat = new THREE.MeshStandardMaterial({
            color: rockColors[idx % rockColors.length],
            emissive: 0x221133,
            roughness: 0.3,
            metalness: 0.1
        });
        const instanced = new THREE.InstancedMesh(geo, mat, instanceCount);
        instanced.castShadow = false;
        instanced.receiveShadow = false;
        instanced.frustumCulled = false;

        const dummy = new THREE.Object3D();
        for (let i = 0; i < instanceCount; i++) {
            // Spread across a huge disc, with some floating above ground
            const r = 50 + Math.random() * 800;
            const a = Math.random() * Math.PI * 2;
            const x = Math.cos(a) * r;
            const z = Math.sin(a) * r;
            const y = -4 + Math.random() * 50; // from below ground to high up

            dummy.position.set(x, y, z);
            dummy.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
            dummy.scale.setScalar(0.3 + Math.random() * 2);
            dummy.updateMatrix();
            instanced.setMatrixAt(i, dummy.matrix);
        }
        instanced.instanceMatrix.needsUpdate = true;
        scene.add(instanced);
        // we don't animate instances individually, but could rotate the whole group later
    });

    // --- Unique Large Objects (1500) ---
    const uniqueCount = 1500;
    for (let i = 0; i < uniqueCount; i++) {
        let geometry;
        const r = Math.random();
        if (r < 0.2) geometry = new THREE.TorusKnotGeometry(1.0, 0.3, 64, 8);
        else if (r < 0.4) geometry = new THREE.IcosahedronGeometry(1.5, 1);
        else if (r < 0.6) geometry = new THREE.ConeGeometry(1.2, 3, 8);
        else if (r < 0.8) geometry = new THREE.TorusGeometry(1.2, 0.4, 16, 64);
        else geometry = new THREE.SphereGeometry(1.3, 24, 24);

        const material = new THREE.MeshStandardMaterial({
            color: randomPastel(),
            emissive: 0x331144,
            roughness: 0.2,
            metalness: 0.2,
            transparent: true,
            opacity: 0.6 + Math.random() * 0.4,
            wireframe: Math.random() > 0.9
        });

        const mesh = new THREE.Mesh(geometry, material);
        // Spherical distribution
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const rad = 100 + Math.random() * 400;
        mesh.position.x = rad * Math.sin(phi) * Math.cos(theta);
        mesh.position.y = rad * Math.sin(phi) * Math.sin(theta);
        mesh.position.z = rad * Math.cos(phi);
        mesh.rotation.set(Math.random() * Math.PI, Math.random() * Math.PI, Math.random() * Math.PI);
        scene.add(mesh);
        animatedObjects.push(mesh);
    }

    // --- Particle Systems (dust, sparkles) ---
    // Dense floating particles
    const dustCount = 40000;
    const dustGeo = new THREE.BufferGeometry();
    const dustPos = new Float32Array(dustCount * 3);
    const dustCol = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
        const r = 20 + Math.random() * 900;
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        dustPos[i*3] = r * Math.sin(phi) * Math.cos(theta);
        dustPos[i*3+1] = r * Math.sin(phi) * Math.sin(theta);
        dustPos[i*3+2] = r * Math.cos(phi);

        dustCol[i*3] = 0.7 + 0.3 * Math.random();
        dustCol[i*3+1] = 0.5 + 0.5 * Math.random();
        dustCol[i*3+2] = 1.0;
    }
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dustGeo.setAttribute('color', new THREE.BufferAttribute(dustCol, 3));
    const dustMat = new THREE.PointsMaterial({
        size: 0.3,
        vertexColors: true,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        sizeAttenuation: true
    });
    const dustParticles = new THREE.Points(dustGeo, dustMat);
    scene.add(dustParticles);
    animatedObjects.push(dustParticles);

    // --- Teleporters (glowing rings) ---
    const teleporterPositions = [];
    for (let t = 0; t < 10; t++) {
        const angle = (t / 10) * Math.PI * 2;
        const radius = 300 + Math.random() * 200;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = 20 + Math.random() * 50;
        teleporterPositions.push(new THREE.Vector3(x, y, z));
    }

    teleporterPositions.forEach(pos => {
        // Outer ring
        const ringGeo = new THREE.TorusGeometry(4, 0.5, 16, 64);
        const ringMat = new THREE.MeshStandardMaterial({
            color: 0x66ccff,
            emissive: 0x224466,
            transparent: true,
            opacity: 0.9
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.copy(pos);
        ring.rotation.x = Math.PI / 2;
        scene.add(ring);
        animatedObjects.push(ring);

        // Inner swirling particles (using points in a disc)
        const swirlCount = 200;
        const swirlGeo = new THREE.BufferGeometry();
        const swirlPos = new Float32Array(swirlCount * 3);
        for (let i = 0; i < swirlCount; i++) {
            const r = Math.random() * 3;
            const a = Math.random() * Math.PI * 2;
            swirlPos[i*3] = pos.x + Math.cos(a) * r;
            swirlPos[i*3+1] = pos.y + (Math.random() - 0.5) * 2;
            swirlPos[i*3+2] = pos.z + Math.sin(a) * r;
        }
        swirlGeo.setAttribute('position', new THREE.BufferAttribute(swirlPos, 3));
        const swirlMat = new THREE.PointsMaterial({
            color: 0xaaddff,
            size: 0.3,
            blending: THREE.AdditiveBlending,
            transparent: true
        });
        const swirl = new THREE.Points(swirlGeo, swirlMat);
        scene.add(swirl);
        animatedObjects.push(swirl);

        // Add a point light
        const light = new THREE.PointLight(0x66aaff, 1.5, 50);
        light.position.copy(pos);
        scene.add(light);
        pulsatingLights.push(light);
    });

    // --- Anomaly Zones (20) with complex structures ---
    for (let a = 0; a < 20; a++) {
        const angle = Math.random() * Math.PI * 2;
        const radius = 150 + Math.random() * 500;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = 10 + Math.random() * 100;
        const pos = new THREE.Vector3(x, y, z);
        anomalyPositions.push(pos);

        // Central glowing orb
        const coreGeo = new THREE.SphereGeometry(4 + Math.random() * 3, 32, 32);
        const coreMat = new THREE.MeshStandardMaterial({
            color: 0xaa88ff,
            emissive: 0x442288,
            roughness: 0.1
        });
        const core = new THREE.Mesh(coreGeo, coreMat);
        core.position.copy(pos);
        scene.add(core);
        animatedObjects.push(core);

        // Surrounding rings
        for (let r = 0; r < 3; r++) {
            const ringGeo = new THREE.TorusGeometry(6 + r * 2, 0.4, 16, 64);
            const ringMat = new THREE.MeshStandardMaterial({
                color: 0xffaa88,
                emissive: 0x884422,
                transparent: true,
                opacity: 0.6
            });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.position.copy(pos);
            ring.rotation.x = Math.PI / 2;
            ring.rotation.y = r * 1.5;
            scene.add(ring);
            animatedObjects.push(ring);
        }

        // Small orbiting orbs
        for (let o = 0; o < 8; o++) {
            const orbGeo = new THREE.SphereGeometry(0.8, 16, 16);
            const orbMat = new THREE.MeshStandardMaterial({
                color: randomPastel(),
                emissive: 0x331144
            });
            const orb = new THREE.Mesh(orbGeo, orbMat);
            const orbAngle = (o / 8) * Math.PI * 2;
            orb.position.set(
                pos.x + Math.cos(orbAngle) * 10,
                pos.y + Math.sin(orbAngle * 2) * 3,
                pos.z + Math.sin(orbAngle) * 10
            );
            scene.add(orb);
            animatedObjects.push(orb);
        }

        // Light
        const light = new THREE.PointLight(0xaa88ff, 2, 80);
        light.position.copy(pos);
        scene.add(light);
        pulsatingLights.push(light);
    }

    // --- Lighting: ambient and directional ---
    const ambient = new THREE.AmbientLight(0x40406b);
    scene.add(ambient);
    const dirLight = new THREE.DirectionalLight(0xffccff, 1.2);
    dirLight.position.set(20, 50, 20);
    scene.add(dirLight);
    const backLight = new THREE.PointLight(0x4466aa, 0.8, 200);
    backLight.position.set(-50, 30, -80);
    scene.add(backLight);

    // --- Fog for depth ---
    scene.fog = new THREE.FogExp2(0x0a0a14, 0.002);
}

// --- Animation loop: rotate objects, twinkle stars, pulse lights ---
export function updateWorld(time, intensity) {
    // Rotate unique meshes
    animatedObjects.forEach(obj => {
        if (obj.isMesh) {
            obj.rotation.y += 0.0005;
            obj.rotation.x += 0.0002;
        } else if (obj.isPoints) {
            obj.rotation.y += 0.0001; // slow star drift
        }
    });

    // Pulse anomaly lights based on intensity (passed from main)
    pulsatingLights.forEach(light => {
        light.intensity = 1.5 + intensity * 1.5 + Math.sin(time * 3) * 0.5;
    });
}