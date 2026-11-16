// The other nine players. Each bot patrols the waypoint graph toward enemy
// ground, and when it sees an enemy — line of sight, in its field of view —
// it stops, strafes and fires in bursts after a human-ish reaction delay.
// Skill varies per bot, so some are pushovers and some are dangerous.
import * as THREE from 'three';
import { WAYPOINTS, EDGES, SPAWNS } from './world.js';
import { WEAPONS } from './weapons.js';
import { PALETTE } from './palette.js';

export const BOT_NAMES = {
  vanguard: ['Rook', 'Sable', 'Wren', 'Onyx'],
  jackal: ['Dune', 'Vex', 'Scorch', 'Ridge', 'Mirage'],
};

const GOALS = {
  vanguard: ['jWest', 'jMid', 'jEast', 'jSpawn'],
  jackal: ['vWest', 'vMid', 'vEast', 'vSpawn'],
};
const HOLD = { vanguard: ['mKilnW', 'wGap', 'eGap'], jackal: ['mKilnE', 'wGap', 'eGap'] };

const TEAM_MAT = {
  vanguard: new THREE.MeshStandardMaterial({ color: 0x3d6fb4, roughness: 0.75, metalness: 0.1 }),
  jackal: new THREE.MeshStandardMaterial({ color: 0xb45a26, roughness: 0.75, metalness: 0.1 }),
};
const DARK = new THREE.MeshStandardMaterial({ color: 0x23262b, roughness: 0.8, metalness: 0.2 });
const VISOR = new THREE.MeshStandardMaterial({ color: 0x0d1117, roughness: 0.25, metalness: 0.6 });

function bfsPath(from, to) {
  const prev = new Map([[from, null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    if (cur === to) break;
    for (const next of EDGES[cur] || []) {
      if (!prev.has(next)) {
        prev.set(next, cur);
        queue.push(next);
      }
    }
  }
  if (!prev.has(to)) return [to];
  const path = [];
  let cur = to;
  while (cur) {
    path.unshift(cur);
    cur = prev.get(cur);
  }
  return path;
}

function nearestWaypoint(x, z) {
  let best = null;
  let bestD = Infinity;
  for (const [name, [wx, wz]] of Object.entries(WAYPOINTS)) {
    const d = (wx - x) ** 2 + (wz - z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = name;
    }
  }
  return best;
}

function makePlate(name, teamColor) {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  function draw(health) {
    ctx.clearRect(0, 0, 256, 64);
    ctx.fillStyle = 'rgba(10,10,14,0.55)';
    ctx.fillRect(28, 6, 200, 52);
    ctx.fillStyle = '#f2ead9';
    ctx.font = '700 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(name, 128, 30);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(48, 40, 160, 8);
    ctx.fillStyle = health > 50 ? teamColor : health > 25 ? '#ffb347' : '#e5484d';
    ctx.fillRect(48, 40, 160 * Math.max(0, health) / 100, 8);
    tex.needsUpdate = true;
  }
  draw(100);
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sprite.scale.set(1.5, 0.375, 1);
  sprite.position.y = 2.25;
  return { sprite, draw };
}

export function createBots(scene, world, random) {
  const tmpEye = new THREE.Vector3();
  const tmpChest = new THREE.Vector3();
  const bots = [];
  let hitMeshes = [];

  function buildModel(team, name) {
    const g = new THREE.Group();
    const teamMat = TEAM_MAT[team];
    const legL = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.78, 0.22), DARK);
    legL.position.set(-0.13, 0.39, 0);
    legL.geometry.translate(0, -0.39, 0);
    legL.position.y = 0.78;
    const legR = legL.clone();
    legR.position.x = 0.13;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.62, 0.32), teamMat);
    torso.position.y = 1.1;
    const vest = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.34, 0.36), DARK);
    vest.position.y = 1.14;
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.28, 0.3), teamMat);
    head.position.y = 1.62;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.32, 0.1, 0.04), VISOR);
    visor.position.set(0, 1.63, -0.16);
    const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 0.6), DARK);
    gun.position.set(0.2, 1.32, -0.28);
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.13, 0.42), teamMat);
    arm.position.set(0.2, 1.32, -0.05);
    const ring = new THREE.Mesh(
      new THREE.CircleGeometry(0.5, 24),
      new THREE.MeshBasicMaterial({
        color: team === 'vanguard' ? PALETTE.vanguard : PALETTE.jackal,
        transparent: true, opacity: 0.35, depthWrite: false,
      }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    const plate = makePlate(name, team === 'vanguard' ? PALETTE.vanguard : PALETTE.jackal);
    g.add(legL, legR, torso, vest, head, visor, gun, arm, ring, plate.sprite);
    for (const m of g.children) {
      if (m.isMesh) {
        m.castShadow = true;
        m.receiveShadow = false;
      }
    }
    scene.add(g);
    return { group: g, legL, legR, torso, head, gun, ring, plate };
  }

  function weaponForRound(round) {
    if (round <= 1) return 'pistol';
    const r = random();
    if (r < 0.45) return 'rifle';
    if (r < 0.7) return 'smg';
    if (r < 0.85) return 'shotgun';
    return 'dmr';
  }

  function spawnBot(team, index, round) {
    const name = BOT_NAMES[team][index];
    const [sx, sz] = SPAWNS[team][team === 'vanguard' ? index + 1 : index];
    const model = buildModel(team, name);
    model.group.position.set(sx, 0, sz);
    const yaw = team === 'vanguard' ? 0 : Math.PI; // face the enemy spawn
    model.group.rotation.y = yaw;
    const bot = {
      id: `${team}-${name}`,
      name,
      team,
      model,
      yaw,
      pitch: 0,
      health: 100,
      armor: round >= 3 ? 50 : 0,
      weaponId: weaponForRound(round),
      alive: true,
      speed: 3.4 + random() * 1.2,
      skill: 0.35 + random() * 0.6,
      anchor: index === 0,
      path: [],
      pathIdx: 0,
      goal: null,
      state: 'patrol',
      target: null,
      targetLost: 0,
      reaction: 0,
      burstLeft: 0,
      burstTimer: 0,
      fireTimer: 0,
      strafeDir: 1,
      strafeTimer: 0,
      losTimer: random() * 0.15,
      walkPhase: 0,
      lastX: sx,
      lastZ: sz,
      stuckTimer: 0,
      deathT: 0,
    };
    model.torso.userData.hit = { bot, part: 'torso' };
    model.head.userData.hit = { bot, part: 'head' };
    model.vest = model.group.children.find((c) => c.geometry && c.geometry.parameters && c.geometry.parameters.width === 0.58);
    if (model.vest) model.vest.userData.hit = { bot, part: 'torso' };
    pickGoal(bot);
    return bot;
  }

  function pickGoal(bot) {
    const pool = bot.anchor && random() < 0.6 ? HOLD[bot.team] : GOALS[bot.team];
    bot.goal = pool[Math.floor(random() * pool.length)];
    const from = nearestWaypoint(bot.model.group.position.x, bot.model.group.position.z);
    bot.path = bfsPath(from, bot.goal);
    bot.pathIdx = 0;
  }

  function reset(round) {
    for (const b of bots) {
      scene.remove(b.model.group);
      b.model.plate.sprite.material.map.dispose();
      b.model.plate.sprite.material.dispose();
    }
    bots.length = 0;
    for (let i = 0; i < 4; i++) bots.push(spawnBot('vanguard', i, round));
    for (let i = 0; i < 5; i++) bots.push(spawnBot('jackal', i, round));
    hitMeshes = bots.flatMap((b) => [b.model.torso, b.model.head, b.model.vest].filter(Boolean));
  }

  function chestOf(entity, out) {
    if (entity.isPlayer) out.set(entity.position.x, entity.position.y + 1.2, entity.position.z);
    else out.set(entity.model.group.position.x, 1.2, entity.model.group.position.z);
    return out;
  }

  // 3D segment vs every collider box, slab method. Exact for this flat map
  // (all solids are axis-aligned boxes) and far cheaper than mesh raycasts,
  // which matters: nine bots re-check sight several times a second.
  function segmentBlocked(from, to) {
    const d = { x: to.x - from.x, y: to.y - from.y, z: to.z - from.z };
    const o = { x: from.x, y: from.y, z: from.z };
    for (const c of world.colliders) {
      let tmin = 0;
      let tmax = 1;
      let hit = true;
      for (const axis of ['x', 'y', 'z']) {
        const dd = d[axis];
        const oo = o[axis];
        const mn = c.min[axis];
        const mx = c.max[axis];
        if (Math.abs(dd) < 1e-9) {
          if (oo < mn || oo > mx) {
            hit = false;
            break;
          }
        } else {
          let t1 = (mn - oo) / dd;
          let t2 = (mx - oo) / dd;
          if (t1 > t2) {
            const tmp = t1;
            t1 = t2;
            t2 = tmp;
          }
          tmin = Math.max(tmin, t1);
          tmax = Math.min(tmax, t2);
          if (tmin > tmax) {
            hit = false;
            break;
          }
        }
      }
      if (hit) return true;
    }
    return false;
  }

  function canSee(bot, entity) {
    const from = tmpEye.set(bot.model.group.position.x, 1.5, bot.model.group.position.z);
    const to = chestOf(entity, tmpChest);
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const dz = to.z - from.z;
    const dist = Math.hypot(dx, dy, dz);
    if (dist > 52) return false;
    const facingX = -Math.sin(bot.yaw);
    const facingZ = -Math.cos(bot.yaw);
    if ((dx * facingX + dz * facingZ) / dist < 0.35) return false;
    return !segmentBlocked(from, to);
  }

  function acquireTarget(bot, ctx) {
    let best = null;
    let bestD = Infinity;
    const candidates = [];
    if (ctx.player.alive && ctx.player.team !== bot.team) candidates.push(ctx.player);
    for (const other of bots) {
      if (other.alive && other.team !== bot.team) candidates.push(other);
    }
    for (const e of candidates) {
      const d = bot.model.group.position.distanceTo(
        e.isPlayer ? e.position : e.model.group.position,
      );
      if (d < bestD && canSee(bot, e)) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  function collideMove(bot, dx, dz) {
    const p = bot.model.group.position;
    const probe = new THREE.Box3();
    function blocked(x, z) {
      probe.min.set(x - 0.35, 0.1, z - 0.35);
      probe.max.set(x + 0.35, 1.6, z + 0.35);
      for (const c of world.colliders) if (probe.intersectsBox(c)) return true;
      return false;
    }
    if (!blocked(p.x + dx, p.z)) p.x += dx;
    if (!blocked(p.x, p.z + dz)) p.z += dz;
    for (const other of bots) {
      if (other === bot || !other.alive) continue;
      const o = other.model.group.position;
      const ddx = p.x - o.x;
      const ddz = p.z - o.z;
      const d2 = ddx * ddx + ddz * ddz;
      if (d2 > 0.01 && d2 < 0.49) {
        const d = Math.sqrt(d2);
        const push = (0.7 - d) * 0.5;
        p.x += (ddx / d) * push;
        p.z += (ddz / d) * push;
      }
    }
  }

  function aimAt(bot, target, dt) {
    const p = bot.model.group.position;
    const tp = target.isPlayer ? target.position : target.model.group.position;
    const dx = tp.x - p.x;
    const dz = tp.z - p.z;
    const wantYaw = Math.atan2(-dx, -dz);
    let dyaw = wantYaw - bot.yaw;
    while (dyaw > Math.PI) dyaw -= Math.PI * 2;
    while (dyaw < -Math.PI) dyaw += Math.PI * 2;
    bot.yaw += dyaw * Math.min(1, dt * 9);
    const dist = Math.hypot(dx, dz);
    const wantPitch = Math.atan2(1.2 - 1.5, dist);
    bot.pitch += (wantPitch - bot.pitch) * Math.min(1, dt * 9);
  }

  function shootAt(bot, target, ctx, dt) {
    const def = WEAPONS[bot.weaponId];
    bot.fireTimer -= dt;
    if (bot.fireTimer > 0) return;
    if (bot.burstLeft <= 0) {
      bot.burstTimer -= dt;
      if (bot.burstTimer <= 0) {
        bot.burstLeft = def.auto ? 3 + Math.floor(random() * 3) : 1;
        bot.burstTimer = 0.5 + random() * 0.6;
      }
      return;
    }
    bot.fireTimer = def.gap;
    bot.burstLeft -= 1;
    const from = new THREE.Vector3(bot.model.group.position.x, 1.45, bot.model.group.position.z);
    const to = chestOf(target, new THREE.Vector3());
    const spread = 0.014 + (1 - bot.skill) * 0.022;
    for (let i = 0; i < def.pellets; i++) {
      const dir = to.clone().sub(from).normalize();
      dir.x += (random() - 0.5) * 2 * spread;
      dir.y += (random() - 0.5) * 2 * spread * 0.7;
      dir.z += (random() - 0.5) * 2 * spread;
      dir.normalize();
      ctx.shoot(from, dir, def, bot);
    }
  }

  function step(dt, ctx) {
    for (const bot of bots) {
      const p = bot.model.group.position;
      if (!bot.alive) {
        bot.deathT = Math.min(1, bot.deathT + dt * 2.6);
        bot.model.group.rotation.x = -Math.PI / 2 * bot.deathT * 0.94;
        bot.model.group.position.y = 0.25 * bot.deathT;
        continue;
      }
      bot.losTimer -= dt;
      if (bot.losTimer <= 0) {
        bot.losTimer = 0.13 + random() * 0.06;
        const seen = acquireTarget(bot, ctx);
        if (seen) {
          if (bot.target !== seen) {
            bot.reaction = 0.35 + (1 - bot.skill) * 0.45 + random() * 0.15;
            bot.burstLeft = 0;
            bot.burstTimer = 0;
          }
          bot.target = seen;
          bot.targetLost = 0;
          bot.state = 'combat';
        } else if (bot.target) {
          bot.targetLost += 0.15;
          if (bot.targetLost > 2) {
            bot.target = null;
            bot.state = 'patrol';
            pickGoal(bot);
          }
        }
      }

      let moving = 0;
      if (bot.state === 'combat' && bot.target) {
        const targetAlive = bot.target.isPlayer ? ctx.player.alive : bot.target.alive;
        if (!targetAlive) {
          bot.target = null;
          bot.state = 'patrol';
          pickGoal(bot);
        } else {
          aimAt(bot, bot.target, dt);
          bot.strafeTimer -= dt;
          if (bot.strafeTimer <= 0) {
            bot.strafeTimer = 0.5 + random() * 0.7;
            bot.strafeDir = random() < 0.5 ? -1 : 1;
          }
          const sx = Math.cos(bot.yaw) * bot.strafeDir;
          const sz = -Math.sin(bot.yaw) * bot.strafeDir;
          const sp = bot.speed * 0.45;
          collideMove(bot, sx * sp * dt, sz * sp * dt);
          moving = sp;
          if (bot.reaction > 0) bot.reaction -= dt;
          else if (bot.targetLost < 0.6) shootAt(bot, bot.target, ctx, dt);
        }
      } else {
        if (bot.pathIdx >= bot.path.length) pickGoal(bot);
        const wp = WAYPOINTS[bot.path[bot.pathIdx]];
        if (wp) {
          const dx = wp[0] - p.x;
          const dz = wp[1] - p.z;
          const dist = Math.hypot(dx, dz);
          if (dist < 1.1) {
            bot.pathIdx += 1;
          } else {
            const wantYaw = Math.atan2(-dx, -dz);
            let dyaw = wantYaw - bot.yaw;
            while (dyaw > Math.PI) dyaw -= Math.PI * 2;
            while (dyaw < -Math.PI) dyaw += Math.PI * 2;
            bot.yaw += dyaw * Math.min(1, dt * 6);
            collideMove(bot, (dx / dist) * bot.speed * dt, (dz / dist) * bot.speed * dt);
            moving = bot.speed;
          }
        }
        bot.stuckTimer += dt;
        if (bot.stuckTimer > 1.4) {
          const moved = Math.hypot(p.x - bot.lastX, p.z - bot.lastZ);
          if (moved < 0.25 && bot.pathIdx < bot.path.length) {
            bot.pathIdx += 1;
            if (bot.pathIdx >= bot.path.length) pickGoal(bot);
          }
          bot.lastX = p.x;
          bot.lastZ = p.z;
          bot.stuckTimer = 0;
        }
      }

      bot.walkPhase += dt * moving * 2.2;
      const swing = moving > 0.1 ? Math.min(0.55, moving * 0.14) : 0;
      bot.model.legL.rotation.x = Math.sin(bot.walkPhase) * swing;
      bot.model.legR.rotation.x = -Math.sin(bot.walkPhase) * swing;
      bot.model.group.rotation.y = bot.yaw;
      bot.model.gun.rotation.x = -bot.pitch;
    }
  }

  function applyDamage(bot, amount, part) {
    if (!bot.alive) return { died: false, dealt: 0 };
    let remaining = amount;
    if (bot.armor > 0) {
      const absorbed = Math.min(bot.armor, remaining * 0.5);
      bot.armor -= absorbed;
      remaining -= absorbed;
    }
    bot.health -= remaining;
    bot.model.plate.draw(Math.max(0, bot.health));
    if (bot.health <= 0) {
      bot.health = 0;
      bot.alive = false;
      bot.model.plate.sprite.visible = false;
      bot.model.ring.visible = false;
      hitMeshes = hitMeshes.filter((m) => m.userData.hit.bot !== bot);
      return { died: true, dealt: amount };
    }
    return { died: false, dealt: amount };
  }

  return {
    get list() {
      return bots;
    },
    get hitMeshes() {
      return hitMeshes;
    },
    reset,
    step,
    applyDamage,
    aliveCount(team) {
      return bots.filter((b) => b.alive && b.team === team).length;
    },
    firstAlive(team) {
      return bots.find((b) => b.alive && b.team === team) || null;
    },
    dispose() {
      for (const b of bots) scene.remove(b.model.group);
      bots.length = 0;
    },
  };
}
