// Combat feedback, all pooled: tracer lines, impact sparks and bot muzzle
// flashes. Nothing allocates per shot; the pools recycle.
import * as THREE from 'three';

const TRACERS = 28;
const BURSTS = 14;
const FLASHES = 12;

export function createEffects(scene) {
  const tracers = [];
  for (let i = 0; i < TRACERS; i++) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(6), 3));
    const line = new THREE.Line(geo, new THREE.LineBasicMaterial({
      color: 0xffd27a, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false,
    }));
    line.frustumCulled = false;
    line.visible = false;
    scene.add(line);
    tracers.push({ line, life: 0 });
  }

  const bursts = [];
  for (let i = 0; i < BURSTS; i++) {
    const n = 9;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    const pts = new THREE.Points(geo, new THREE.PointsMaterial({
      color: 0xffc46b, size: 0.09, transparent: true, opacity: 0,
      depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    pts.frustumCulled = false;
    pts.visible = false;
    scene.add(pts);
    bursts.push({ pts, vel: new Float32Array(n * 3), life: 0, max: 0.4 });
  }

  const flashTex = (() => {
    const c = document.createElement('canvas');
    c.width = 64;
    c.height = 64;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,230,160,1)');
    g.addColorStop(0.4, 'rgba(255,170,60,0.8)');
    g.addColorStop(1, 'rgba(255,120,20,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const flashes = [];
  for (let i = 0; i < FLASHES; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({
      map: flashTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    }));
    s.scale.set(0.7, 0.7, 1);
    s.visible = false;
    scene.add(s);
    flashes.push({ s, life: 0 });
  }

  let ti = 0;
  let bi = 0;
  let fi = 0;

  return {
    tracer(from, to, color = 0xffd27a) {
      const t = tracers[ti];
      ti = (ti + 1) % TRACERS;
      const p = t.line.geometry.attributes.position.array;
      p[0] = from.x; p[1] = from.y; p[2] = from.z;
      p[3] = to.x; p[4] = to.y; p[5] = to.z;
      t.line.geometry.attributes.position.needsUpdate = true;
      t.line.material.color.setHex(color);
      t.line.material.opacity = 0.85;
      t.line.visible = true;
      t.life = 0.07;
    },
    impact(point, normal, color = 0xffc46b) {
      const b = bursts[bi];
      bi = (bi + 1) % BURSTS;
      const p = b.pts.geometry.attributes.position.array;
      for (let i = 0; i < 9; i++) {
        p[i * 3] = point.x;
        p[i * 3 + 1] = point.y;
        p[i * 3 + 2] = point.z;
        b.vel[i * 3] = normal.x * 2 + (Math.random() - 0.5) * 3;
        b.vel[i * 3 + 1] = Math.abs(normal.y) * 2 + Math.random() * 2.5;
        b.vel[i * 3 + 2] = normal.z * 2 + (Math.random() - 0.5) * 3;
      }
      b.pts.geometry.attributes.position.needsUpdate = true;
      b.pts.material.color.setHex(color);
      b.pts.material.opacity = 1;
      b.pts.visible = true;
      b.life = b.max;
    },
    muzzle(point) {
      const f = flashes[fi];
      fi = (fi + 1) % FLASHES;
      f.s.position.copy(point);
      f.s.material.opacity = 0.95;
      f.s.visible = true;
      f.life = 0.05;
    },
    step(dt) {
      for (const t of tracers) {
        if (t.life <= 0) continue;
        t.life -= dt;
        t.line.material.opacity = Math.max(0, t.life / 0.07) * 0.85;
        if (t.life <= 0) t.line.visible = false;
      }
      for (const b of bursts) {
        if (b.life <= 0) continue;
        b.life -= dt;
        const p = b.pts.geometry.attributes.position.array;
        for (let i = 0; i < 9; i++) {
          b.vel[i * 3 + 1] -= 9 * dt;
          p[i * 3] += b.vel[i * 3] * dt;
          p[i * 3 + 1] += b.vel[i * 3 + 1] * dt;
          p[i * 3 + 2] += b.vel[i * 3 + 2] * dt;
        }
        b.pts.geometry.attributes.position.needsUpdate = true;
        b.pts.material.opacity = Math.max(0, b.life / b.max);
        if (b.life <= 0) b.pts.visible = false;
      }
      for (const f of flashes) {
        if (f.life <= 0) continue;
        f.life -= dt;
        f.s.material.opacity = Math.max(0, f.life / 0.05) * 0.95;
        if (f.life <= 0) f.s.visible = false;
      }
    },
  };
}
