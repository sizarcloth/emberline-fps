// Kiln Yard: an abandoned desert brickworks at golden hour. Three lanes run
// north-south between the two spawns — west past the silos, mid through the kiln
// hall, east along the conveyor — with crates, barriers and barrels for cover.
// Every solid is a collider for movement and a surface a bullet stops on.
// Waypoints form the graph the bots path on; edges only join clear lines.
import * as THREE from 'three';
import { PALETTE } from './palette.js';
import { createTextures } from './textures.js';

export const MAP = { minX: -26, maxX: 26, minZ: -22, maxZ: 22 };

export const WAYPOINTS = {
  vSpawn: [0, 19], vWest: [-18, 16], vMid: [0, 14], vEast: [18, 16],
  wMid: [-18, 6], wNorth: [-18, -6], wGap: [-10, 0],
  mSouth: [0, 8], mKilnW: [-5.5, 0], mKilnE: [5.5, 0], mNorth: [0, -8],
  eSouth: [18, 6], eMid: [18, -6], eGap: [10, 0],
  jWest: [-18, -16], jMid: [0, -14], jEast: [18, -16], jSpawn: [0, -19],
  wCornerS: [-22, 10], eCornerS: [22, 10], wCornerN: [-22, -10], eCornerN: [22, -10],
};

export const EDGES = {
  vSpawn: ['vWest', 'vMid', 'vEast'],
  vWest: ['vSpawn', 'wMid', 'wCornerS'],
  vMid: ['vSpawn', 'mSouth'],
  vEast: ['vSpawn', 'eSouth', 'eCornerS'],
  wMid: ['vWest', 'wNorth', 'wGap', 'wCornerS'],
  wGap: ['wMid', 'mKilnW'],
  wNorth: ['wMid', 'jWest', 'wCornerN'],
  mSouth: ['vMid', 'mKilnW', 'mKilnE'],
  mKilnW: ['mSouth', 'wGap', 'mNorth'],
  mKilnE: ['mSouth', 'eGap', 'mNorth'],
  mNorth: ['mKilnW', 'mKilnE', 'jMid'],
  eSouth: ['vEast', 'eMid', 'eCornerS'],
  eGap: ['eMid', 'mKilnE'],
  eMid: ['eSouth', 'eGap', 'jEast', 'eCornerN'],
  jWest: ['wNorth', 'jMid', 'wCornerN'],
  jMid: ['mNorth', 'jWest', 'jEast', 'jSpawn'],
  jEast: ['eMid', 'jMid', 'eCornerN'],
  jSpawn: ['jMid'],
  wCornerS: ['vWest', 'wMid'],
  eCornerS: ['vEast', 'eSouth'],
  wCornerN: ['wNorth', 'jWest'],
  eCornerN: ['eMid', 'jEast'],
};

export const SPAWNS = {
  vanguard: [[-4, 19.5], [-1.5, 20.5], [1.5, 20.5], [4, 19.5], [0, 18]],
  jackal: [[-4, -19.5], [-1.5, -20.5], [1.5, -20.5], [4, -19.5], [0, -18]],
};

function softCircleTexture(inner, outer) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function signTexture(lines, accent) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 160;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#23262b';
  ctx.fillRect(0, 0, 512, 160);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 6;
  ctx.strokeRect(8, 8, 496, 144);
  ctx.fillStyle = '#f2ead9';
  ctx.textAlign = 'center';
  ctx.font = '700 52px system-ui, sans-serif';
  ctx.fillText(lines[0], 256, 72);
  ctx.fillStyle = accent;
  ctx.font = '600 30px system-ui, sans-serif';
  ctx.fillText(lines[1], 256, 124);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createWorld(scene, seed = 1, quality = 'high') {
  const tex = createTextures(seed);
  const group = new THREE.Group();
  scene.add(group);
  const colliders = [];
  const shootables = [];

  const mat = {
    sand: new THREE.MeshStandardMaterial({ map: tex.sand, roughness: 1, metalness: 0 }),
    brick: new THREE.MeshStandardMaterial({ map: tex.brick, roughness: 0.95, metalness: 0 }),
    concrete: new THREE.MeshStandardMaterial({ map: tex.concrete, roughness: 0.92, metalness: 0.02 }),
    steel: new THREE.MeshStandardMaterial({ map: tex.steel, roughness: 0.6, metalness: 0.55 }),
    darkSteel: new THREE.MeshStandardMaterial({ color: 0x2e333a, roughness: 0.55, metalness: 0.6 }),
    rust: new THREE.MeshStandardMaterial({ color: 0x7a4a2e, roughness: 0.85, metalness: 0.25 }),
    crate: new THREE.MeshStandardMaterial({ map: tex.crate, roughness: 0.9, metalness: 0 }),
    hazard: new THREE.MeshStandardMaterial({ map: tex.hazard, roughness: 0.7, metalness: 0.1 }),
    kiln: new THREE.MeshStandardMaterial({ color: 0x8a6248, roughness: 0.7, metalness: 0.35 }),
    pad: new THREE.MeshStandardMaterial({ map: tex.pad, roughness: 0.95, metalness: 0 }),
  };

  function solid(mesh, collide = true) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    if (collide) {
      colliders.push(new THREE.Box3().setFromObject(mesh));
      shootables.push(mesh);
    }
    return mesh;
  }
  function box(w, h, d, x, y, z, material, ry = 0) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat[material]);
    m.position.set(x, y, z);
    m.rotation.y = ry;
    return solid(m);
  }
  function cylinder(rt, rb, h, x, y, z, material, seg = 20) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat[material]);
    m.position.set(x, y, z);
    return solid(m);
  }

  // Ground and perimeter.
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(53.2, 45.2), mat.sand);
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  group.add(floor);
  box(53.2, 5, 0.6, 0, 2.5, -22.3, 'brick');
  box(53.2, 5, 0.6, 0, 2.5, 22.3, 'brick');
  box(0.6, 5, 45.2, -26.3, 2.5, 0, 'brick');
  box(0.6, 5, 45.2, 26.3, 2.5, 0, 'brick');
  // Brick trim caps on the perimeter.
  box(53.2, 0.35, 0.9, 0, 5.1, -22.3, 'concrete');
  box(53.2, 0.35, 0.9, 0, 5.1, 22.3, 'concrete');

  // Lane dividers: two walls with a doorway gap at z = 0.
  for (const x of [-10, 10]) {
    box(0.6, 3.4, 16, x, 1.7, -10, 'brick');
    box(0.6, 3.4, 16, x, 1.7, 10, 'brick');
    box(0.9, 0.5, 4.6, x, 3.6, 0, 'concrete'); // lintel over the doorway
    box(0.9, 0.35, 4.6, x, 0.18, 0, 'hazard'); // threshold stripe
  }

  // The kiln: a horizontal drum on cradles, and its chimney.
  const kiln = new THREE.Mesh(new THREE.CylinderGeometry(2.05, 2.05, 7.4, 24), mat.kiln);
  kiln.rotation.z = Math.PI / 2;
  kiln.position.set(0, 2.1, 0);
  solid(kiln);
  for (const x of [-2.6, 2.6]) box(0.7, 1.1, 3.4, x, 0.55, 0, 'darkSteel');
  box(7.6, 0.3, 0.9, 0, 4.25, 0, 'hazard');
  cylinder(1.15, 1.4, 11, 6.2, 5.5, -4.2, 'brick', 18);
  box(3, 0.6, 3, 6.2, 0.3, -4.2, 'concrete');

  // Silos in opposite corners.
  cylinder(2.5, 2.5, 9, -22, 4.5, -18, 'steel', 22);
  cylinder(0.4, 2.5, 1.6, -22, 9.8, -18, 'darkSteel', 22);
  cylinder(2.5, 2.5, 9, 22, 4.5, 18, 'steel', 22);
  cylinder(0.4, 2.5, 1.6, 22, 9.8, 18, 'darkSteel', 22);

  // Conveyor gantry over the east lane (visual, high above the fight).
  box(1.4, 0.5, 26, 15.5, 6.2, 0, 'darkSteel');
  for (const z of [-10, 0, 10]) box(0.5, 6.2, 0.5, 15.5, 3.1, z, 'darkSteel');
  box(1.8, 0.9, 2.2, 15.5, 5.4, -12.5, 'rust');

  // Crates: cover clusters, some stacked.
  const crates = [
    [-3, 8], [3.5, 9], [-3, -8], [3.5, -9], [-18, 6], [-16, -4], [-20, -12],
    [-14, 14], [18, -6], [16, 4], [20, 12], [14, -14], [-7, 3], [7, -3],
  ];
  for (const [x, z] of crates) box(1.25, 1.25, 1.25, x, 0.62, z, 'crate', (x * 7 + z * 3) % 0.6);
  box(1.25, 1.25, 1.25, 0, 0.62, 12, 'crate');
  box(1.25, 1.25, 1.25, 0, 1.87, 12, 'crate', 0.3);
  box(1.25, 1.25, 1.25, 0, 0.62, -12, 'crate');
  box(1.25, 1.25, 1.25, 0, 1.87, -12, 'crate', -0.25);
  box(1.25, 1.25, 1.25, -18, 1.87, 6, 'crate', 0.5);
  box(1.25, 1.25, 1.25, 18, 1.87, -6, 'crate', 0.2);

  // Concrete barriers.
  box(2.6, 1.05, 0.55, -5, 0.52, 15, 'concrete');
  box(2.6, 1.05, 0.55, 5, 0.52, -15, 'concrete');
  box(2.6, 1.05, 0.55, -18, 0.52, 0, 'concrete', Math.PI / 2);
  box(2.6, 1.05, 0.55, 18, 0.52, 0, 'concrete', Math.PI / 2);
  box(2.6, 0.18, 0.6, -5, 1.12, 15, 'hazard');
  box(2.6, 0.18, 0.6, 5, 1.12, -15, 'hazard');

  // Barrel clusters.
  const barrels = [[-12, 10], [-11, 11], [-12.8, 11], [12, -10], [11, -11], [12.8, -11], [-22, 18], [-21, 18.8], [22, -18], [21, -18.8]];
  for (const [x, z] of barrels) cylinder(0.45, 0.45, 1.1, x, 0.55, z, 'rust', 14);

  // Spawn pads and floodlight poles.
  for (const [x, z] of [[0, 19.5], [0, -19.5]]) {
    const pad = new THREE.Mesh(new THREE.CircleGeometry(3.4, 28), mat.pad);
    pad.rotation.x = -Math.PI / 2;
    pad.position.set(x, 0.02, z);
    pad.receiveShadow = true;
    group.add(pad);
  }
  for (const [x, z] of [[-7, 19], [7, 19], [-7, -19], [7, -19]]) {
    cylinder(0.09, 0.12, 5.4, x, 2.7, z, 'darkSteel', 8);
    box(0.9, 0.35, 0.4, x, 5.4, z, 'darkSteel');
    const lamp = new THREE.PointLight(0xffc98a, 14, 16, 1.8);
    lamp.position.set(x, 5.2, z);
    scene.add(lamp);
  }

  // Signs.
  function sign(lines, x, y, z, ry, w = 4.6) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, w * 0.3125),
      new THREE.MeshStandardMaterial({ map: signTexture(lines, PALETTE.accent), roughness: 0.7 }),
    );
    m.position.set(x, y, z);
    m.rotation.y = ry;
    group.add(m);
  }
  sign(['KILN YARD', 'SECTOR 7 — NO ENTRY'], -10.35, 2.4, -6, -Math.PI / 2);
  sign(['KILN YARD', 'SECTOR 7 — NO ENTRY'], 10.35, 2.4, 6, Math.PI / 2);

  // Sky: warm haze, low sun disc, drifting clouds.
  scene.background = new THREE.Color(PALETTE.sky);
  scene.fog = new THREE.Fog(new THREE.Color(PALETTE.sky), 42, 115);
  const sunTex = softCircleTexture('rgba(255,240,200,1)', 'rgba(255,170,80,0)');
  const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false }));
  sun.scale.set(46, 46, 1);
  sun.position.set(60, 26, -70);
  scene.add(sun);
  const cloudTex = softCircleTexture('rgba(255,225,190,0.55)', 'rgba(255,225,190,0)');
  const clouds = [];
  const crnd = (() => { let a = seed * 31 + 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; })();
  for (let i = 0; i < 7; i++) {
    const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: cloudTex, transparent: true, opacity: 0.5, depthWrite: false, fog: false }));
    c.scale.set(34 + crnd() * 30, 9 + crnd() * 6, 1);
    c.position.set(-90 + crnd() * 180, 42 + crnd() * 22, -80 + crnd() * 120);
    c.userData.speed = 0.25 + crnd() * 0.4;
    scene.add(c);
    clouds.push(c);
  }

  // Lighting: low warm key sun, cool fill, warm hemisphere. The hemisphere
  // and fill are strong on purpose: the key comes from the north-east, so
  // every south face would otherwise fall to black.
  scene.add(new THREE.HemisphereLight(0xffd9a0, 0x6b543a, 1.25));
  const key = new THREE.DirectionalLight(0xffb066, 2.7);
  key.position.set(34, 30, -20);
  key.target.position.set(0, 0, 2);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -36;
  key.shadow.camera.right = 36;
  key.shadow.camera.top = 36;
  key.shadow.camera.bottom = -36;
  key.shadow.camera.far = 120;
  key.shadow.bias = -0.0006;
  scene.add(key, key.target);
  const fill = new THREE.DirectionalLight(0x7d94b8, 0.7);
  fill.position.set(-24, 18, 26);
  scene.add(fill);

  // Drifting dust motes (skipped entirely on low quality).
  const dustCount = quality === 'low' ? 0 : 420;
  const dustPos = new Float32Array(dustCount * 3);
  const dustSeed = new Float32Array(dustCount);
  for (let i = 0; i < dustCount; i++) {
    dustPos[i * 3] = MAP.minX + Math.random() * (MAP.maxX - MAP.minX);
    dustPos[i * 3 + 1] = 0.2 + Math.random() * 7;
    dustPos[i * 3 + 2] = MAP.minZ + Math.random() * (MAP.maxZ - MAP.minZ);
    dustSeed[i] = Math.random() * Math.PI * 2;
  }
  let dust = null;
  if (dustCount > 0) {
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
      color: 0xffd9a0, size: 0.055, transparent: true, opacity: 0.4,
      depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
    }));
    scene.add(dust);
  }

  // Chimney smoke: a loop of rising, swelling, fading sprites.
  const smokeTex = softCircleTexture('rgba(120,110,100,0.5)', 'rgba(120,110,100,0)');
  const puffs = [];
  for (let i = 0; i < 9; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, opacity: 0, depthWrite: false }));
    s.userData.phase = i / 9;
    scene.add(s);
    puffs.push(s);
  }

  function step(dt, time) {
    for (const c of clouds) {
      c.position.x += c.userData.speed * dt;
      if (c.position.x > 110) c.position.x = -110;
    }
    if (dust) {
      const p = dust.geometry.attributes.position;
      for (let i = 0; i < dustCount; i++) {
        p.array[i * 3] += Math.sin(time * 0.12 + dustSeed[i]) * dt * 0.12;
        p.array[i * 3 + 1] += Math.cos(time * 0.09 + dustSeed[i] * 1.7) * dt * 0.08;
      }
      p.needsUpdate = true;
    }
    for (const s of puffs) {
      const ph = (s.userData.phase + time * 0.045) % 1;
      s.position.set(6.2 + ph * 3.2, 11 + ph * 9, -4.2 + ph * 1.5);
      const sc = 2.5 + ph * 6;
      s.scale.set(sc, sc, 1);
      s.material.opacity = 0.42 * Math.sin(ph * Math.PI);
    }
  }

  return { colliders, shootables, step, group };
}
