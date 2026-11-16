// EMBERLINE — Kiln Yard. Boot, the fixed-step loop, combat resolution and the
// screenshot staging used for the entry images. The game is a 5v5 round-based
// tactical FPS: you are Vanguard, the Jackals hold the far spawn, first to 5.
import * as THREE from 'three';
import { PALETTE, mulberry32 } from './palette.js';
import { createWorld, SPAWNS } from './world.js';
import { createPlayer } from './player.js';
import { createInput } from './input.js';
import { createLoadout, WEAPONS, ARMOR_PRICE } from './weapons.js';
import { createBots } from './bots.js';
import { createRounds, ROUND_TIME, FREEZE_TIME } from './rounds.js';
import { createAudio } from './audio.js';
import { createEffects } from './effects.js';
import { createHUD } from './hud.js';

const params = new URLSearchParams(location.search);
const SHOT = params.get('shot');
const SEED = parseInt(params.get('seed') || '1', 10);
// ?quality=low is the fallback for weak machines: no shadow pass, no dust,
// pixel ratio 1. The default stays full quality.
const QUALITY = params.get('quality') === 'low' ? 'low' : 'high';
const random = mulberry32(SEED);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(QUALITY === 'low' ? 1 : Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = QUALITY !== 'low';
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 300);
scene.add(camera);

const world = createWorld(scene, SEED, QUALITY);
const audio = createAudio();
const effects = createEffects(scene);
const rounds = createRounds();
const bots = createBots(scene, world, random);
const player = createPlayer(world.colliders, SPAWNS.vanguard[0]);
const loadout = createLoadout(camera);
const input = createInput(canvas, (locked) => {
  if (!started) return;
  if (!locked && rounds.state.phase !== 'matchEnd' && !hud.buyOpen() && !dead) {
    hud.showPause(true);
    paused = true;
  } else if (locked) {
    hud.showPause(false);
    paused = false;
  }
});
const hud = createHUD(buy);
hud.setWalls(world.colliders);
loadout.setVisible(false);
bots.reset(1); // teams staged at their spawns behind the lobby screen
hud.drawMinimap(
  { x: 0, z: 19.5, yaw: 0 },
  bots.list.filter((b) => b.team === 'vanguard').map((b) => ({ x: b.model.group.position.x, z: b.model.group.position.z })),
  [],
);

const raycaster = new THREE.Raycaster();
const tmpV = new THREE.Vector3();
const tmpV2 = new THREE.Vector3();
const playerBox = new THREE.Box3();

let started = false;
let paused = false;
let dead = false;
let specTarget = null;
let specYaw = 0;
let specPitch = 0;
let dryTimer = 0;
let stepAcc = 0;
let lastStepX = 0;
let lastStepZ = 0;
let lastMinimap = 0;
let enemyFlashes = [];
let fovTarget = 75;

const playerEntity = {
  isPlayer: true,
  team: 'vanguard',
  name: 'You',
  get position() { return player.state.position; },
  get alive() { return started && !dead; },
};

function falloff(dist, base) {
  return base * Math.max(0.4, 1 - dist / 70);
}

// Resolve one bullet. Returns the hit point, or null for a clean miss.
function resolveShot(from, dir, def, shooter) {
  raycaster.set(from, dir);
  raycaster.far = 140;
  const targets = [...world.shootables, ...bots.hitMeshes];
  const hits = raycaster.intersectObjects(targets, false);
  const wallHit = hits.find((h) => !h.object.userData.hit);
  const botHit = hits.find((h) => h.object.userData.hit);
  let playerDist = Infinity;
  let playerHead = false;
  if (shooter !== playerEntity && playerEntity.alive) {
    playerBox.min.set(player.state.position.x - 0.34, player.state.position.y, player.state.position.z - 0.34);
    playerBox.max.set(player.state.position.x + 0.34, player.state.position.y + player.state.height, player.state.position.z + 0.34);
    const p = raycaster.ray.intersectBox(playerBox, tmpV2);
    if (p) {
      playerDist = from.distanceTo(p);
      playerHead = p.y > player.state.position.y + player.state.height - 0.3;
    }
  }
  const wallDist = wallHit ? wallHit.distance : Infinity;
  const botDist = botHit ? botHit.distance : Infinity;
  const best = Math.min(wallDist, botDist, playerDist);
  const end = from.clone().addScaledVector(dir, Number.isFinite(best) ? best : 120);

  if (playerDist === best) {
    const dmg = falloff(playerDist, def.damage) * (playerHead ? def.headMult : 1);
    damagePlayer(dmg, shooter, def, playerHead);
  } else if (botDist === best) {
    const { bot, part } = botHit.object.userData.hit;
    if (bot.team !== shooter.team) {
      const dmg = falloff(botDist, def.damage) * (part === 'head' ? def.headMult : 1);
      const res = bots.applyDamage(bot, dmg, part);
      if (shooter === playerEntity) {
        hud.hitmarker(res.died);
        if (res.died) audio.kill();
        else audio.hit();
      }
      if (res.died) onKill(bot, shooter, def, part === 'head');
      effects.impact(botHit.point, tmpV.set(0, 1, 0), 0xd43a2a);
    }
  } else if (wallHit) {
    const n = wallHit.face ? wallHit.face.normal.clone().transformDirection(wallHit.object.matrixWorld) : tmpV.set(0, 1, 0);
    effects.impact(wallHit.point, n);
  }
  return end;
}

function damagePlayer(amount, shooter, def, headshot) {
  if (dead || !started) return;
  let remaining = amount;
  if (rounds.state.armor > 0) {
    const absorbed = Math.min(rounds.state.armor, remaining * 0.5);
    rounds.state.armor -= absorbed;
    remaining -= absorbed;
  }
  playerHealth -= remaining;
  hud.damageFlash(amount);
  audio.hurt();
  if (playerHealth <= 0) {
    playerHealth = 0;
    dead = true;
    rounds.onDeath();
    loadout.onDeath();
    specTarget = bots.firstAlive('vanguard');
    hud.setSpectating(specTarget ? specTarget.name : null);
    hud.killfeed(shooter.name, 'You', def.name, headshot, shooter.team);
    checkRoundEnd();
  }
}

let playerHealth = 100;

function onKill(victim, killer, def, headshot) {
  hud.killfeed(killer.name, victim.name, def.name, headshot, killer.team);
  if (killer === playerEntity) {
    rounds.onKill();
    hud.toast(`+$${300}  —  ${victim.name} down`, 1400);
  }
  checkRoundEnd();
}

function aliveCount(team) {
  const botCount = bots.aliveCount(team);
  return team === 'vanguard' ? botCount + (playerEntity.alive ? 1 : 0) : botCount;
}

function checkRoundEnd() {
  if (rounds.state.phase !== 'live') return;
  const v = aliveCount('vanguard');
  const j = aliveCount('jackal');
  if (v === 0 && j === 0) endRound('draw', 'Mutual wipeout');
  else if (j === 0) endRound('vanguard', v === 5 ? 'Flawless round' : `${v} standing`);
  else if (v === 0) endRound('jackal', `${j} standing`);
}

function endRound(winner, reason) {
  rounds.endRound(winner, reason);
  if (winner === 'draw') {
    hud.banner('DRAW', reason, 'draw');
    audio.roundLose();
  } else if (winner === 'vanguard') {
    hud.banner('ROUND WON', `Vanguard takes round ${rounds.state.round} — ${reason}`, 'win');
    audio.roundWin();
  } else {
    hud.banner('ROUND LOST', `Jackals take round ${rounds.state.round} — ${reason}`, 'lose');
    audio.roundLose();
  }
}

function startRound() {
  bots.reset(rounds.state.round);
  playerHealth = 100;
  dead = false;
  specTarget = null;
  hud.setSpectating(null);
  player.teleport(SPAWNS.vanguard[0][0], SPAWNS.vanguard[0][1], 0);
  loadout.state.cooldown = 0;
  loadout.state.reloadLeft = 0;
  enemyFlashes = [];
}

function buy(id) {
  if (!rounds.buyWindowOpen()) {
    hud.toast('Buy window is closed');
    return;
  }
  if (dead) {
    hud.toast('You are down this round');
    return;
  }
  if (id === 'armor') {
    if (rounds.state.armor > 0) {
      hud.toast('Already wearing armor');
      return;
    }
    if (!rounds.buyArmor()) {
      hud.toast('Not enough money');
      return;
    }
    audio.buy();
    hud.toast('Kevlar vest equipped');
  } else {
    const def = WEAPONS[id];
    if (loadout.state.primary && loadout.state.primary.id === id) {
      hud.toast(`${def.name} already in hand`);
      return;
    }
    if (!rounds.spend(def.price)) {
      hud.toast('Not enough money');
      return;
    }
    loadout.buy(id);
    audio.buy();
    hud.toast(`${def.name} purchased`);
  }
  hud.setBuyOpen(true, rounds.state.money, loadout.state.primary?.id, rounds.state.armor > 0);
}

function botShoot(from, dir, def, shooter) {
  const end = resolveShot(from, dir, def, shooter);
  effects.tracer(from, end, shooter.team === 'vanguard' ? 0x9fd0ff : 0xffd27a);
  effects.muzzle(from);
  const dist = from.distanceTo(camera.position);
  audio.shoot(def.id, dist);
  if (shooter.team === 'jackal') {
    enemyFlashes.push({ x: from.x, z: from.z, t: performance.now() });
  }
}

function playerShoot() {
  const def = loadout.currentDef();
  if (!loadout.fire()) {
    // Only an empty magazine clicks dry; a trigger pull inside the fire
    // gap is silently ignored.
    const slot = loadout.state.current === 'primary' ? loadout.state.primary : loadout.state.secondary;
    if (slot && slot.mag === 0 && loadout.state.reloadLeft === 0 && dryTimer <= 0) {
      audio.dryFire();
      dryTimer = 0.3;
      if (slot.reserve > 0 && loadout.reload()) audio.reload();
    }
    return;
  }
  audio.shoot(def.id, 0);
  const spread = loadout.spread(player.groundSpeed(), input.state.aiming);
  for (let i = 0; i < def.pellets; i++) {
    const dir = tmpV.set(
      (random() - 0.5) * 2 * spread,
      (random() - 0.5) * 2 * spread,
      -1,
    ).normalize().applyQuaternion(camera.quaternion);
    const from = camera.position.clone();
    const end = resolveShot(from, dir.clone(), def, playerEntity);
    const muzzle = new THREE.Vector3(0.26, -0.19, -0.9).applyMatrix4(camera.matrixWorld);
    effects.tracer(muzzle, end, 0x9fd0ff);
  }
  player.recoil(def.kick, (random() - 0.5) * def.kick * 0.5);
}

function update(dt) {
  const now = performance.now();
  dryTimer = Math.max(0, dryTimer - dt);
  world.step(dt, now / 1000);
  effects.step(dt);

  if (!started) {
    // Lobby: a slow establishing drift over the kiln hall, teams staged.
    const t = now / 1000;
    camera.position.set(Math.sin(t * 0.045) * 7, 5.4 + Math.sin(t * 0.09) * 0.7, 17.5);
    camera.lookAt(0, 1.1, -4);
    return;
  }
  if (paused) return;
  const ev = rounds.step(dt);
  if (ev === 'roundStart') {
    hud.banner(`ROUND ${rounds.state.round}`, 'Eliminate the Jackals', '', 2200);
    audio.roundStart();
  } else if (ev === 'timeout') {
    const v = aliveCount('vanguard');
    const j = aliveCount('jackal');
    if (v === j) endRound('draw', 'Time expired — even numbers');
    else endRound(v > j ? 'vanguard' : 'jackal', 'Time expired — more standing');
  } else if (ev === 'nextRound') {
    startRound();
    hud.banner(`ROUND ${rounds.state.round}`, 'Buy up — press B', '', 2200);
  } else if (ev === 'matchEnd') {
    const winner = rounds.matchWinner();
    hud.showEnd(true, winner, `Final score ${rounds.state.score.vanguard} — ${rounds.state.score.jackal}  ·  K/D ${rounds.state.kills}/${rounds.state.deaths}  ·  ${winner === 'vanguard' ? 'The kiln yard is yours.' : 'The Jackals hold the yard.'}`);
    hud.setBuyOpen(false);
    input.releaseLock();
    if (winner === 'vanguard') audio.roundWin();
    else audio.roundLose();
  }
  if (rounds.state.phase === 'matchEnd') return;

  // Bots think and move during freeze too, but only fight once live.
  bots.step(dt, {
    player: playerEntity,
    shoot: rounds.state.phase === 'live' ? botShoot : () => {},
  });

  // Player.
  const look = input.takeLook();
  const triggerEdge = input.consumeTrigger();
  if (!dead) {
    player.look(look.x, look.y);
    if (rounds.state.phase !== 'ended') player.step(dt, input.state.keys);
    loadout.step(dt, player.groundSpeed(), look);
    camera.position.set(player.state.position.x, player.state.position.y + player.state.eye, player.state.position.z);
    camera.rotation.set(player.state.pitch, player.state.yaw, 0, 'YXZ');
    const dist = Math.hypot(player.state.position.x - lastStepX, player.state.position.z - lastStepZ);
    stepAcc += dist;
    lastStepX = player.state.position.x;
    lastStepZ = player.state.position.z;
    if (stepAcc > 2.4 && player.state.onGround && player.groundSpeed() > 1 && !player.state.walking) {
      stepAcc = 0;
      audio.step();
    }
  } else if (specTarget && specTarget.alive) {
    specYaw -= look.x * 0.0021;
    specPitch = Math.max(-1.2, Math.min(1.2, specPitch - look.y * 0.0021));
    const p = specTarget.model.group.position;
    camera.position.set(p.x, 1.55, p.z);
    camera.rotation.set(specTarget.pitch + specPitch, specTarget.yaw + specYaw, 0, 'YXZ');
    if (triggerEdge) {
      const mates = bots.list.filter((b) => b.alive && b.team === 'vanguard');
      const idx = mates.indexOf(specTarget);
      specTarget = mates[(idx + 1) % mates.length] || specTarget;
      specYaw = 0;
      specPitch = 0;
      hud.setSpectating(specTarget.name);
    }
  }

  // Firing: automatics fire while held, semi-autos fire on the trigger edge.
  // A semi-auto click that lands inside the fire gap is held for the next
  // tick instead of dropped: on a slow renderer game time lags wall time,
  // so a real click can arrive "early" in game time and must still fire.
  if (!dead && input.state.locked && rounds.state.phase === 'live') {
    const def = loadout.currentDef();
    if (def.auto && input.state.firing) {
      playerShoot();
    } else if (!def.auto && triggerEdge) {
      const slot = loadout.state.current === 'primary' ? loadout.state.primary : loadout.state.secondary;
      if (loadout.state.cooldown > 0 && slot && slot.mag > 0 && loadout.state.reloadLeft === 0) {
        input.requeueTrigger();
      } else {
        playerShoot();
      }
    }
  } else {
    // Not in a live round: drop any trigger edge held over from the
    // previous round so it never fires a shot on its own later.
    input.consumeTrigger();
  }

  // Keys.
  if (input.consume('KeyR') && !dead) {
    if (loadout.reload()) audio.reload();
  }
  if (input.consume('Digit1')) loadout.switchTo('primary');
  if (input.consume('Digit2')) loadout.switchTo('secondary');
  if (hud.buyOpen()) {
    const buyKeys = ['Digit1', 'Digit2', 'Digit3', 'Digit4', 'Digit5'];
    const buyIds = ['rifle', 'smg', 'shotgun', 'dmr', 'armor'];
    buyKeys.forEach((code, i) => {
      if (input.consume(code)) buy(buyIds[i]);
    });
  }
  if (input.consume('KeyB') && !dead && rounds.state.phase !== 'matchEnd') {
    if (hud.buyOpen()) {
      hud.setBuyOpen(false);
      input.requestLock();
    } else if (rounds.buyWindowOpen()) {
      hud.setBuyOpen(true, rounds.state.money, loadout.state.primary?.id, rounds.state.armor > 0);
      input.releaseLock();
    } else {
      hud.toast('Buy window is closed');
    }
  }
  input.endFrame();

  // FOV: scope zoom on the DMR, slight tighten otherwise.
  const aiming = input.state.aiming && !dead;
  const def = loadout.currentDef();
  fovTarget = aiming ? (def.zoom ? 42 : 66) : 75;
  if (Math.abs(camera.fov - fovTarget) > 0.1) {
    camera.fov += (fovTarget - camera.fov) * Math.min(1, dt * 10);
    camera.updateProjectionMatrix();
  }

  // HUD snapshot.
  const slot = loadout.state.current === 'primary' ? loadout.state.primary : loadout.state.secondary;
  const spread = loadout.spread(player.groundSpeed(), aiming);
  hud.update({
    scoreV: rounds.state.score.vanguard,
    scoreJ: rounds.state.score.jackal,
    timer: rounds.state.timer,
    round: rounds.state.round,
    health: playerHealth,
    armor: rounds.state.armor,
    money: rounds.state.money,
    mag: slot ? slot.mag : 0,
    reserve: slot ? slot.reserve : 0,
    weaponName: def.name,
    reloading: loadout.state.reloadLeft > 0,
    aliveV: aliveCount('vanguard'),
    aliveJ: aliveCount('jackal'),
    phaseText: rounds.state.phase === 'freeze' ? `BUY PHASE — B TO BUY · ${Math.ceil(rounds.state.phaseTimer)}s`
      : rounds.state.phase === 'ended' ? 'ROUND OVER'
        : dead ? 'YOU ARE DOWN' : '',
    crossGap: Math.max(4, Math.min(42, 5 + spread * 520 + player.groundSpeed() * 1.4)),
    showCrosshair: !dead && (input.state.locked || SHOT === 'play') && !hud.buyOpen(),
  }, now);
  enemyFlashes = enemyFlashes.filter((f) => now - f.t < 2000);
  // The minimap redraws at 10 Hz: it never needs a fresh frame per tick.
  if (now - lastMinimap > 100) {
    lastMinimap = now;
    hud.drawMinimap(
      { x: player.state.position.x, z: player.state.position.z, yaw: player.state.yaw },
      bots.list.filter((b) => b.alive && b.team === 'vanguard').map((b) => ({ x: b.model.group.position.x, z: b.model.group.position.z })),
      enemyFlashes,
    );
  }
}

// Logic and rendering run on separate clocks. The simulation ticks at 60 Hz
// on a timer, so game time tracks wall time even when rendering dips (a
// software renderer can take hundreds of ms per frame; tying the sim to it
// would run the whole match in slow motion). Rendering just shows the
// latest state as fast as the machine allows. Each tick catches up the
// elapsed time in substeps of at most 50 ms (bullets are raycasts, bodies
// move < 0.3 m per substep, so nothing tunnels); the catch-up is capped so
// a long stall never spirals into a backlog of catch-up steps.
let lastLogic = performance.now();
const STEP = 1 / 60;
let frozen = false;
setInterval(() => {
  if (frozen) return;
  const now = performance.now();
  let elapsed = Math.min(0.15, Math.max(0, (now - lastLogic) / 1000));
  lastLogic = now;
  while (elapsed > 0.001) {
    const dt = Math.min(0.05, elapsed);
    update(dt);
    elapsed -= dt;
  }
}, 1000 / 60);
function frame() {
  requestAnimationFrame(frame);
  renderer.render(scene, camera);
}

function beginGame() {
  audio.unlock();
  hud.hideStart();
  hud.showPause(false);
  loadout.setVisible(true);
  started = true;
  rounds.startMatch();
  startRound();
  hud.banner('ROUND 1', 'Buy up — press B', '', 2200);
  input.requestLock();
}

document.getElementById('play-btn').addEventListener('click', beginGame);
document.getElementById('resume-btn').addEventListener('click', () => {
  audio.unlock();
  input.requestLock();
});
document.getElementById('again-btn').addEventListener('click', () => location.reload());
document.getElementById('buy-close').addEventListener('click', () => {
  hud.setBuyOpen(false);
  input.requestLock();
});

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---- Screenshot staging: deterministic frames for the entry images ----
function stageShot() {
  if (!SHOT) return;
  try {
    stageShotInner();
  } catch (err) {
    console.error('shot staging failed:', err);
  }
  renderer.render(scene, camera);
  renderer.render(scene, camera);
  frozen = true;
  window.__shotReady = true;
}

function stageShotInner() {
  if (!SHOT) return;
  const sim = (seconds) => {
    const steps = Math.round(seconds * 60);
    for (let i = 0; i < steps; i++) update(STEP);
    renderer.render(scene, camera);
  };
  if (SHOT === 'start') {
    // Lobby view over the kiln hall, teams at their spawns.
    bots.reset(1);
    player.teleport(0, 14, 0);
    camera.position.set(-3.5, 6.8, 17.5);
    camera.lookAt(1.5, 0.8, -8);
    hud.setStartButton('DEPLOY — CLICK TO PLAY');
  } else if (SHOT === 'buy') {
    started = true;
    rounds.startMatch();
    startRound();
    rounds.state.money = 5400;
    hud.hideStart();
    loadout.setVisible(true);
    hud.setBuyOpen(true, rounds.state.money, null, false);
    player.teleport(0, 16.5, 0); // spawn bots stay behind the camera
    sim(0.5);
  } else if (SHOT === 'play') {
    started = true;
    rounds.startMatch();
    startRound();
    rounds.state.money = 5400;
    rounds.spend(WEAPONS.rifle.price);
    loadout.buy('rifle');
    loadout.setVisible(true);
    hud.hideStart();
    // Skip the freeze, then let the bots push into the lanes for a few
    // seconds before framing the player at mid.
    rounds.state.phaseTimer = 0.01;
    sim(3.2);
    // Staging insurance: the player must be alive and the round live for the shot.
    if (dead) {
      dead = false;
      playerHealth = 100;
      hud.setSpectating(null);
    }
    if (!loadout.state.primary || loadout.state.primary.id !== 'rifle') {
      loadout.buy('rifle');
    }
    if (rounds.state.phase === 'ended') {
      rounds.state.phase = 'live';
      rounds.state.timer = 87;
    }
    hud.hideBanner(); // clean action frame: no round banner over the fight
    // Frame down the east side of the kiln: three Jackals spread across the
    // view, a tracer coming in, the chimney behind them.
    player.teleport(0, 11.5, -0.45);
    player.state.pitch = 0.02;
    camera.position.set(0, 1.6, 11.5);
    camera.rotation.set(0.02, -0.45, 0, 'YXZ');
    const jackals = bots.list.filter((b) => b.alive && b.team === 'jackal');
    const spots = [[0, 3, Math.PI], [5.5, 2, Math.PI * 0.8], [11, 0, Math.PI * 0.7]];
    for (let i = 0; i < 3 && jackals[i]; i++) {
      jackals[i].model.group.position.set(spots[i][0], 0, spots[i][1]);
      jackals[i].yaw = spots[i][2];
      jackals[i].model.group.rotation.y = spots[i][2];
    }
    // One clean kill in the feed, one tracer across the frame.
    const victim = jackals[3];
    if (victim) {
      bots.applyDamage(victim, 500, 'torso');
      onKill(victim, playerEntity, WEAPONS.rifle, true);
    }
    effects.tracer(new THREE.Vector3(5.5, 1.45, 2), new THREE.Vector3(3.2, 1.0, 8.6), 0xffd27a);
    effects.muzzle(new THREE.Vector3(5.5, 1.45, 2));
    effects.impact(new THREE.Vector3(3.2, 1.0, 8.6), new THREE.Vector3(0, 0, 1));
    update(STEP);
  } else if (SHOT === 'end') {
    started = true;
    rounds.startMatch();
    rounds.state.score = { vanguard: 5, jackal: 3 };
    rounds.state.round = 8;
    rounds.state.phase = 'matchEnd';
    startRound();
    hud.hideStart();
    hud.showEnd(true, 'vanguard', 'Final score 5 — 3  ·  K/D 14/6  ·  The kiln yard is yours.');
    // The HUD never updates in the match-end phase, so set the final
    // scoreboard by hand or the top bar would still read 0 — 0.
    hud.update({
      scoreV: 5, scoreJ: 3, timer: 0, round: 8, health: 100, armor: 0,
      money: 800, mag: 12, reserve: 48, weaponName: 'P9 Sidearm',
      reloading: false, aliveV: 3, aliveJ: 0, phaseText: '',
      crossGap: 8, showCrosshair: false,
    }, performance.now());
    player.teleport(0, 12, 0.35);
    camera.position.set(0, 2.2, 12);
    camera.rotation.set(-0.08, 0.35, 0, 'YXZ');
    sim(0.2);
  }
}

// Playtest hooks (read-only state plus two shortcuts used by the local
// headless playtest to drive round transitions quickly). Harmless in play:
// nothing here is reachable from the game's own UI.
window.__emberline = {
  get state() {
    return {
      started, paused, dead,
      phase: rounds.state.phase,
      round: rounds.state.round,
      score: { ...rounds.state.score },
      timer: Math.round(rounds.state.timer * 10) / 10,
      health: Math.round(playerHealth),
      money: rounds.state.money,
      aliveV: aliveCount('vanguard'),
      aliveJ: aliveCount('jackal'),
      kills: rounds.state.kills,
      deaths: rounds.state.deaths,
    };
  },
  get player() {
    return {
      x: +player.state.position.x.toFixed(2),
      z: +player.state.position.z.toFixed(2),
      yaw: +player.state.yaw.toFixed(2),
      pitch: +player.state.pitch.toFixed(2),
    };
  },
  get bots() {
    return bots.list.map((b) => ({
      name: b.name, team: b.team, alive: b.alive,
      x: +b.model.group.position.x.toFixed(1),
      z: +b.model.group.position.z.toFixed(1),
      state: b.state,
    }));
  },
  debugKillTeam(team) {
    for (const b of bots.list) {
      if (b.team === team && b.alive) {
        bots.applyDamage(b, 9999, 'torso');
        onKill(b, playerEntity, WEAPONS.rifle, false);
      }
    }
  },
  debugSkipFreeze() {
    if (rounds.state.phase === 'freeze') rounds.state.phaseTimer = 0.01;
  },
};

requestAnimationFrame(frame);
if (SHOT) {
  // Let the first frame lay out the DOM, then stage and freeze.
  setTimeout(stageShot, 60);
}
