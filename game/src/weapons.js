// The armoury: five original weapons, each with its own view model, feel and
// price. Accuracy beats speed: spread grows with movement and falls when still
// or aiming, and every gun kicks the view. The loadout owns magazines, reloads
// and the buy; main.js owns the ray and the damage.
import * as THREE from 'three';
import { PALETTE } from './palette.js';

export const WEAPONS = {
  pistol: {
    id: 'pistol', name: 'P9 Sidearm', slot: 'secondary', price: 0,
    damage: 26, headMult: 3, mag: 12, reserve: 48, gap: 0.19, auto: false,
    pellets: 1, reload: 1.5, spreadStill: 0.0016, spreadMove: 0.02, kick: 0.008, zoom: 0,
    blurb: 'Reliable sidearm. Free, and it stays with you.',
  },
  smg: {
    id: 'smg', name: 'VK-9 Hornet', slot: 'primary', price: 1200,
    damage: 16, headMult: 2.5, mag: 30, reserve: 120, gap: 0.075, auto: true,
    pellets: 1, reload: 1.8, spreadStill: 0.0035, spreadMove: 0.034, kick: 0.005, zoom: 0,
    blurb: 'Fast hose for close lanes. Cheap, hungry, loud.',
  },
  rifle: {
    id: 'rifle', name: 'AR-77 Longbow', slot: 'primary', price: 2700,
    damage: 30, headMult: 3, mag: 30, reserve: 90, gap: 0.105, auto: true,
    pellets: 1, reload: 2.1, spreadStill: 0.0018, spreadMove: 0.026, kick: 0.009, zoom: 0,
    blurb: 'The workhorse. Accurate, steady, worth every credit.',
  },
  dmr: {
    id: 'dmr', name: 'DMR Needle', slot: 'primary', price: 4500,
    damage: 68, headMult: 2, mag: 10, reserve: 30, gap: 0.5, auto: false,
    pellets: 1, reload: 2.6, spreadStill: 0.0006, spreadMove: 0.04, kick: 0.02, zoom: 1,
    blurb: 'One shot, one down. Right-click to steady the scope.',
  },
  shotgun: {
    id: 'shotgun', name: 'M870 Breacher', slot: 'primary', price: 1800,
    damage: 9, headMult: 1.5, mag: 6, reserve: 24, gap: 0.85, auto: false,
    pellets: 8, reload: 2.4, spreadStill: 0.016, spreadMove: 0.03, kick: 0.028, zoom: 0,
    blurb: 'Eight pellets of bad news at arm\u2019s length.',
  },
};

export const ARMOR_PRICE = 650;
export const ARMOR_POINTS = 50;

const BODY = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x424852), roughness: 0.5, metalness: 0.45 });
const GRIP = new THREE.MeshStandardMaterial({ color: new THREE.Color(0x2b2e35), roughness: 0.8, metalness: 0.15 });
const ACCENT = new THREE.MeshStandardMaterial({ color: new THREE.Color(PALETTE.accent), roughness: 0.4, metalness: 0.4 });

function part(w, h, d, x, y, z, material = BODY) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  m.position.set(x, y, z);
  return m;
}

function buildViewModel(id) {
  const g = new THREE.Group();
  if (id === 'pistol') {
    g.add(part(0.055, 0.07, 0.22, 0, 0.01, -0.05));
    g.add(part(0.05, 0.11, 0.07, 0, -0.07, 0.05, GRIP));
    g.add(part(0.02, 0.025, 0.03, 0, 0.055, -0.13, ACCENT));
  } else if (id === 'smg') {
    g.add(part(0.07, 0.09, 0.34, 0, 0, -0.02));
    g.add(part(0.035, 0.035, 0.3, 0, 0.02, -0.32));
    g.add(part(0.05, 0.16, 0.06, 0, -0.11, -0.08, GRIP));
    g.add(part(0.06, 0.07, 0.14, 0, -0.01, 0.2, GRIP));
  } else if (id === 'rifle') {
    g.add(part(0.075, 0.1, 0.46, 0, 0, -0.04));
    g.add(part(0.04, 0.04, 0.34, 0, 0.025, -0.4));
    g.add(part(0.05, 0.15, 0.07, 0, -0.11, -0.1, GRIP));
    g.add(part(0.065, 0.08, 0.2, 0, -0.015, 0.28, GRIP));
    g.add(part(0.03, 0.05, 0.09, 0, 0.075, -0.08, ACCENT));
  } else if (id === 'dmr') {
    g.add(part(0.06, 0.08, 0.5, 0, 0, -0.06));
    g.add(part(0.03, 0.03, 0.5, 0, 0.02, -0.52));
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.16, 12), ACCENT);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.075, -0.08);
    g.add(scope);
    g.add(part(0.05, 0.13, 0.06, 0, -0.09, -0.02, GRIP));
    g.add(part(0.055, 0.07, 0.24, 0, -0.01, 0.3, GRIP));
  } else {
    g.add(part(0.085, 0.1, 0.5, 0, 0, -0.05));
    g.add(part(0.06, 0.06, 0.42, 0, 0.03, -0.42));
    g.add(part(0.07, 0.07, 0.16, 0, -0.02, -0.28, GRIP));
    g.add(part(0.06, 0.08, 0.2, 0, -0.01, 0.3, GRIP));
  }
  return g;
}

export function createLoadout(camera) {
  const models = {};
  for (const id of Object.keys(WEAPONS)) {
    const m = buildViewModel(id);
    m.position.set(0.26, -0.22, -0.45);
    m.visible = false;
    camera.add(m);
    models[id] = m;
  }
  const flash = new THREE.Mesh(
    new THREE.PlaneGeometry(0.3, 0.3),
    new THREE.MeshBasicMaterial({ color: 0xffc46b, transparent: true, opacity: 0.95, depthWrite: false, side: THREE.DoubleSide }),
  );
  flash.position.set(0.26, -0.19, -1.0);
  flash.visible = false;
  camera.add(flash);
  const flashLight = new THREE.PointLight(0xffb347, 0, 7, 1.6);
  flashLight.position.set(0.26, -0.16, -0.7);
  camera.add(flashLight);
  // A soft fill light riding with the camera, so the view model reads clearly
  // even when the sun is behind the player.
  const fillLight = new THREE.PointLight(0xffe0b8, 3.5, 4, 1.5);
  fillLight.position.set(0.2, 0.35, -0.2);
  camera.add(fillLight);

  const state = {
    primary: null, // { id, mag, reserve }
    secondary: { id: 'pistol', mag: WEAPONS.pistol.mag, reserve: WEAPONS.pistol.reserve },
    current: 'secondary',
    cooldown: 0,
    reloadLeft: 0,
    reloadTotal: 0,
    flash: 0,
    kick: 0,
    bobPhase: 0,
    swayX: 0,
    swayY: 0,
  };

  let modelsVisible = true;
  function currentDef() {
    const slot = state.current === 'primary' ? state.primary : state.secondary;
    return slot ? WEAPONS[slot.id] : WEAPONS.pistol;
  }
  function currentSlot() {
    return state.current === 'primary' ? state.primary : state.secondary;
  }
  function showModel() {
    for (const [id, m] of Object.entries(models)) m.visible = modelsVisible && id === currentDef().id;
    fillLight.visible = modelsVisible;
  }
  showModel();

  return {
    state,
    currentDef,
    setVisible(v) {
      modelsVisible = v;
      showModel();
    },
    ready() {
      const slot = currentSlot();
      return slot && slot.mag > 0 && state.cooldown === 0 && state.reloadLeft === 0;
    },
    fire() {
      const slot = currentSlot();
      if (!slot || slot.mag <= 0 || state.cooldown > 0 || state.reloadLeft > 0) return false;
      slot.mag -= 1;
      const def = WEAPONS[slot.id];
      state.cooldown = def.gap;
      state.flash = 0.06;
      state.kick = Math.min(0.09, state.kick + 0.03);
      return true;
    },
    reload() {
      const slot = currentSlot();
      const def = currentDef();
      if (!slot || state.reloadLeft > 0 || slot.mag === def.mag || slot.reserve === 0) return false;
      state.reloadLeft = def.reload;
      state.reloadTotal = def.reload;
      return true;
    },
    switchTo(slotName) {
      if (slotName === 'primary' && !state.primary) return false;
      if (state.current === slotName) return false;
      state.current = slotName;
      state.reloadLeft = 0;
      state.cooldown = Math.max(state.cooldown, 0.25);
      showModel();
      return true;
    },
    buy(id) {
      const def = WEAPONS[id];
      if (!def) return null;
      const entry = { id, mag: def.mag, reserve: def.reserve };
      if (def.slot === 'primary') state.primary = entry;
      else state.secondary = entry;
      state.current = def.slot;
      state.reloadLeft = 0;
      state.cooldown = 0.3;
      showModel();
      return entry;
    },
    onDeath() {
      state.primary = null;
      state.current = 'secondary';
      state.secondary = { id: 'pistol', mag: WEAPONS.pistol.mag, reserve: WEAPONS.pistol.reserve };
      state.reloadLeft = 0;
      state.cooldown = 0;
      showModel();
    },
    spread(speed, aiming) {
      const def = currentDef();
      const move = Math.min(1, speed / 5.4);
      let s = def.spreadStill + move * def.spreadMove;
      if (aiming) s *= 0.45;
      return s;
    },
    step(dt, speed, lookDelta) {
      state.cooldown = Math.max(0, state.cooldown - dt);
      state.flash = Math.max(0, state.flash - dt);
      state.kick += (0 - state.kick) * Math.min(1, dt * 12);
      state.bobPhase += dt * speed * 1.6;
      state.swayX += ((-lookDelta.x * 0.0011) - state.swayX) * Math.min(1, dt * 10);
      state.swayY += ((lookDelta.y * 0.0011) - state.swayY) * Math.min(1, dt * 10);
      const model = models[currentDef().id];
      const bob = Math.min(1, speed / 5.4) * 0.011;
      model.position.set(
        0.26 + state.swayX,
        -0.22 + Math.sin(state.bobPhase * 2) * bob + state.swayY,
        -0.45 + state.kick,
      );
      model.rotation.x = state.kick * 2.4;
      model.rotation.z = Math.sin(state.bobPhase) * bob * 0.6;
      if (state.reloadLeft > 0) {
        state.reloadLeft = Math.max(0, state.reloadLeft - dt);
        const p = 1 - state.reloadLeft / state.reloadTotal;
        model.rotation.x = -0.6 * Math.sin(p * Math.PI);
        model.position.y -= 0.09 * Math.sin(p * Math.PI);
        if (state.reloadLeft === 0) {
          const slot = currentSlot();
          const def = currentDef();
          const take = Math.min(def.mag - slot.mag, slot.reserve);
          slot.mag += take;
          slot.reserve -= take;
        }
      }
      flash.visible = state.flash > 0;
      flash.rotation.z = state.flash * 40;
      flashLight.intensity = state.flash > 0 ? 22 : 0;
    },
  };
}
