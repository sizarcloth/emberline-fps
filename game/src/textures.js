// Procedural textures, painted on canvas at boot: no image files, no network.
// Each returns a CanvasTexture with repeat wrapping; the painter is seeded so a
// screenshot seed reproduces the same yard.
import * as THREE from 'three';

function mulberry32(seed) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function canvas(size) {
  const c = document.createElement('canvas');
  c.width = size;
  c.height = size;
  return [c, c.getContext('2d')];
}

function speckle(ctx, size, rnd, colors, count, maxR) {
  for (let i = 0; i < count; i++) {
    const x = rnd() * size;
    const y = rnd() * size;
    const r = 0.5 + rnd() * maxR;
    ctx.fillStyle = colors[(rnd() * colors.length) | 0];
    ctx.globalAlpha = 0.12 + rnd() * 0.25;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function toTexture(c, repeat = 1) {
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(repeat, repeat);
  t.anisotropy = 4;
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export function createTextures(seed = 1) {
  const rnd = mulberry32(seed * 7919 + 13);

  // Sand yard: warm base, grain, faint tyre arcs.
  const [sandC, sand] = canvas(512);
  sand.fillStyle = '#b98d5f';
  sand.fillRect(0, 0, 512, 512);
  speckle(sand, 512, rnd, ['#a87c4e', '#c99a6b', '#96714a', '#d4ab7d'], 5200, 2.4);
  sand.strokeStyle = 'rgba(120,90,55,0.18)';
  for (let i = 0; i < 7; i++) {
    sand.beginPath();
    sand.arc(rnd() * 512, rnd() * 512, 60 + rnd() * 180, rnd() * 3, rnd() * 3 + 1.6);
    sand.lineWidth = 6 + rnd() * 10;
    sand.stroke();
  }
  const sandTex = toTexture(sandC, 10);

  // Brick: courses with per-brick tone variation and mortar lines.
  const [brickC, brick] = canvas(512);
  brick.fillStyle = '#6e4636';
  brick.fillRect(0, 0, 512, 512);
  const bh = 32;
  const bw = 85;
  for (let row = 0; row < 512 / bh; row++) {
    const off = row % 2 ? -bw / 2 : 0;
    for (let col = -1; col < 512 / bw + 1; col++) {
      const tone = 0.82 + rnd() * 0.36;
      const r = Math.min(255, 150 * tone);
      const g = Math.min(255, 92 * tone);
      const b = Math.min(255, 66 * tone);
      brick.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      brick.fillRect(off + col * bw + 2, row * bh + 2, bw - 4, bh - 4);
    }
  }
  speckle(brick, 512, rnd, ['#5a382a', '#9a6a50'], 900, 2);
  const brickTex = toTexture(brickC, 3);

  // Concrete: pale grey, noise, cracks, stains.
  const [conC, con] = canvas(512);
  con.fillStyle = '#8d8a82';
  con.fillRect(0, 0, 512, 512);
  speckle(con, 512, rnd, ['#7a776e', '#9c998f', '#6e6b63'], 4200, 2.2);
  con.strokeStyle = 'rgba(60,58,52,0.35)';
  con.lineWidth = 1.5;
  for (let i = 0; i < 9; i++) {
    let x = rnd() * 512;
    let y = rnd() * 512;
    con.beginPath();
    con.moveTo(x, y);
    for (let s = 0; s < 6; s++) {
      x += (rnd() - 0.5) * 90;
      y += (rnd() - 0.5) * 90;
      con.lineTo(x, y);
    }
    con.stroke();
  }
  const concreteTex = toTexture(conC, 2);

  // Corrugated steel: vertical ribs with rust streaks.
  const [steelC, steel] = canvas(512);
  steel.fillStyle = '#4a5058';
  steel.fillRect(0, 0, 512, 512);
  for (let x = 0; x < 512; x += 16) {
    steel.fillStyle = 'rgba(255,255,255,0.10)';
    steel.fillRect(x, 0, 4, 512);
    steel.fillStyle = 'rgba(0,0,0,0.22)';
    steel.fillRect(x + 8, 0, 5, 512);
  }
  for (let i = 0; i < 26; i++) {
    const x = rnd() * 512;
    const w = 2 + rnd() * 7;
    const grad = steel.createLinearGradient(0, 0, 0, 512);
    grad.addColorStop(0, 'rgba(122,74,46,0.55)');
    grad.addColorStop(1, 'rgba(122,74,46,0)');
    steel.fillStyle = grad;
    steel.fillRect(x, rnd() * 120, w, 200 + rnd() * 300);
  }
  const steelTex = toTexture(steelC, 2);

  // Crate: planks with frame and stencilled mark.
  const [crateC, crate] = canvas(256);
  crate.fillStyle = '#7c5a38';
  crate.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 42) {
    crate.fillStyle = `rgba(0,0,0,${0.10 + rnd() * 0.12})`;
    crate.fillRect(0, y, 256, 3);
    crate.fillStyle = `rgba(255,235,200,${0.04 + rnd() * 0.05})`;
    crate.fillRect(0, y + 3, 256, 20);
  }
  crate.strokeStyle = '#5d4226';
  crate.lineWidth = 14;
  crate.strokeRect(7, 7, 242, 242);
  crate.strokeStyle = 'rgba(242,234,217,0.75)';
  crate.lineWidth = 5;
  crate.beginPath();
  crate.moveTo(128, 84);
  crate.lineTo(176, 168);
  crate.lineTo(80, 168);
  crate.closePath();
  crate.stroke();
  const crateTex = toTexture(crateC, 1);

  // Hazard stripes: diagonal amber/black for barriers and kiln trim.
  const [hazC, haz] = canvas(256);
  haz.fillStyle = '#1c1c1e';
  haz.fillRect(0, 0, 256, 256);
  haz.fillStyle = '#ffb347';
  for (let i = -256; i < 512; i += 64) {
    haz.beginPath();
    haz.moveTo(i, 0);
    haz.lineTo(i + 32, 0);
    haz.lineTo(i + 32 + 256, 256);
    haz.lineTo(i + 256, 256);
    haz.closePath();
    haz.fill();
  }
  const hazardTex = toTexture(hazC, 1);

  // Ground detail for spawn pads: dark asphalt with faded paint ring.
  const [padC, pad] = canvas(256);
  pad.fillStyle = '#3a3a3e';
  pad.fillRect(0, 0, 256, 256);
  speckle(pad, 256, rnd, ['#2c2c30', '#48484e'], 1400, 2);
  pad.strokeStyle = 'rgba(255,179,71,0.5)';
  pad.lineWidth = 6;
  pad.beginPath();
  pad.arc(128, 128, 100, 0, Math.PI * 2);
  pad.stroke();
  const padTex = toTexture(padC, 1);

  return { sand: sandTex, brick: brickTex, concrete: concreteTex, steel: steelTex, crate: crateTex, hazard: hazardTex, pad: padTex };
}
