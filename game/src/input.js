// Keyboard and mouse, pointer lock, and one-shot key presses. The loop reads
// `keys` for held movement and drains `pressed` once a frame for actions
// (reload, buy, weapon switch). Firing is held; aiming is the right button.
export function createInput(canvas, onLockChange) {
  const keys = new Set();
  const pressed = new Set();
  // triggerQueued is the mouse-down edge, latched until the loop consumes it:
  // a click faster than one logic tick must still fire a semi-auto weapon.
  const state = { keys, pressed, locked: false, firing: false, aiming: false, lookX: 0, lookY: 0, triggerQueued: false };

  window.addEventListener('keydown', (event) => {
    if (event.code === 'Space') event.preventDefault();
    if (!event.repeat) {
      keys.add(event.code);
      pressed.add(event.code);
    }
  });
  window.addEventListener('keyup', (event) => keys.delete(event.code));
  window.addEventListener('blur', () => {
    keys.clear();
    state.firing = false;
    state.aiming = false;
  });
  window.addEventListener('mousemove', (event) => {
    if (!state.locked) return;
    state.lookX += event.movementX;
    state.lookY += event.movementY;
  });
  window.addEventListener('mousedown', (event) => {
    if (!state.locked) return;
    if (event.button === 0) {
      state.firing = true;
      state.triggerQueued = true;
    }
    if (event.button === 2) state.aiming = true;
  });
  window.addEventListener('mouseup', (event) => {
    if (event.button === 0) state.firing = false;
    if (event.button === 2) state.aiming = false;
  });
  window.addEventListener('contextmenu', (event) => event.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    state.locked = document.pointerLockElement === canvas;
    if (!state.locked) {
      keys.clear();
      pressed.clear();
      state.firing = false;
      state.aiming = false;
    }
    onLockChange(state.locked);
  });

  return {
    state,
    requestLock() {
      let p;
      try {
        p = canvas.requestPointerLock();
      } catch {
        return;
      }
      if (p && typeof p.catch === 'function') p.catch(() => {});
    },
    releaseLock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    takeLook() {
      const x = state.lookX;
      const y = state.lookY;
      state.lookX = 0;
      state.lookY = 0;
      return { x, y };
    },
    consume(code) {
      if (!pressed.has(code)) return false;
      pressed.delete(code);
      return true;
    },
    consumeTrigger() {
      const t = state.triggerQueued;
      state.triggerQueued = false;
      return t;
    },
    // Put a trigger edge back: a semi-auto click that arrived while the
    // weapon was still on cooldown must fire on the next tick, not vanish.
    requeueTrigger() {
      state.triggerQueued = true;
    },
    endFrame() {
      pressed.clear();
    },
  };
}
