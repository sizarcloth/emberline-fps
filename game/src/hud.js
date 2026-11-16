// Every DOM surface of the game: the scoreboard, minimap, kill feed, health and
// ammo readouts, the buy menu and the start/pause/end screens. Values are only
// written when they change, so the frame loop stays cheap.
import { WEAPONS, ARMOR_PRICE } from './weapons.js';
import { MAP } from './world.js';

function el(id) {
  return document.getElementById(id);
}

export function createHUD(onBuy) {
  const refs = {
    scoreV: el('score-v'), scoreJ: el('score-j'), timer: el('timer'), round: el('round-label'),
    healthNum: el('health-num'), healthFill: el('health-fill'), armorFill: el('armor-fill'),
    armorRow: el('armor-row'), money: el('money'), ammoMag: el('ammo-mag'),
    ammoRes: el('ammo-res'), weaponName: el('weapon-name'), reloadHint: el('reload-hint'),
    killfeed: el('killfeed'), banner: el('banner'), bannerTitle: el('banner-title'),
    bannerSub: el('banner-sub'), crosshair: el('crosshair'), hitmarker: el('hitmarker'),
    vignette: el('vignette'), buyMenu: el('buy-menu'), start: el('start-screen'),
    pause: el('pause-screen'), end: el('end-screen'), endTitle: el('end-title'),
    endStats: el('end-stats'), spectate: el('spectate'), toast: el('toast'),
    minimap: el('minimap'), pipsV: el('pips-v'), pipsJ: el('pips-j'),
    phaseLabel: el('phase-label'), buyMoney: el('buy-money'),
  };
  const mm = refs.minimap.getContext('2d');
  const last = {};
  let hitUntil = 0;
  let bannerUntil = 0;
  let toastUntil = 0;
  let damage = 0;
  let wallRects = [];

  function set(key, node, value) {
    if (last[key] === value) return;
    last[key] = value;
    node.textContent = value;
  }

  function setWidth(key, node, value) {
    if (last[key] === value) return;
    last[key] = value;
    node.style.width = `${value}%`;
  }

  // Build the buy menu once.
  const buyItems = [
    { id: 'rifle', key: '1' }, { id: 'smg', key: '2' }, { id: 'shotgun', key: '3' },
    { id: 'dmr', key: '4' }, { id: 'armor', key: '5' },
  ];
  const buyGrid = el('buy-grid');
  for (const item of buyItems) {
    const b = document.createElement('button');
    b.className = 'buy-item';
    b.dataset.buy = item.id;
    if (item.id === 'armor') {
      b.innerHTML = `<span class="buy-key">${item.key}</span><span class="buy-name">Kevlar Vest</span><span class="buy-blurb">50 armor. Absorbs half of every hit.</span><span class="buy-price">$${ARMOR_PRICE}</span>`;
    } else {
      const w = WEAPONS[item.id];
      b.innerHTML = `<span class="buy-key">${item.key}</span><span class="buy-name">${w.name}</span><span class="buy-blurb">${w.blurb}</span><span class="buy-price">$${w.price}</span>`;
    }
    b.addEventListener('click', () => onBuy(item.id));
    buyGrid.appendChild(b);
  }

  function fmtTime(seconds) {
    const s = Math.max(0, Math.ceil(seconds));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  function pips(node, alive, total, cls) {
    const key = `pips-${cls}`;
    if (last[key] === alive) return;
    last[key] = alive;
    node.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const s = document.createElement('span');
      s.className = `pip ${cls}${i < alive ? '' : ' dead'}`;
      node.appendChild(s);
    }
  }

  return {
    setWalls(colliders) {
      wallRects = colliders.map((c) => ({
        x: c.min.x, z: c.min.z, w: c.max.x - c.min.x, d: c.max.z - c.min.z,
      }));
    },
    update(s, now) {
      set('scoreV', refs.scoreV, s.scoreV);
      set('scoreJ', refs.scoreJ, s.scoreJ);
      set('timer', refs.timer, fmtTime(s.timer));
      set('round', refs.round, `ROUND ${s.round}`);
      set('health', refs.healthNum, Math.max(0, Math.ceil(s.health)));
      setWidth('healthW', refs.healthFill, Math.max(0, s.health));
      setWidth('armorW', refs.armorFill, Math.max(0, s.armor * 2));
      refs.armorRow.style.opacity = s.armor > 0 ? '1' : '0.25';
      set('money', refs.money, `$${s.money}`);
      set('buyMoney', refs.buyMoney, `$${s.money}`);
      set('mag', refs.ammoMag, s.mag);
      set('res', refs.ammoRes, s.reserve);
      set('weapon', refs.weaponName, s.weaponName);
      refs.reloadHint.style.opacity = s.reloading ? '1' : '0';
      refs.ammoMag.classList.toggle('low', s.mag === 0);
      set('phase', refs.phaseLabel, s.phaseText);
      pips(refs.pipsV, s.aliveV, 5, 'v');
      pips(refs.pipsJ, s.aliveJ, 5, 'j');
      refs.crosshair.style.setProperty('--gap', `${s.crossGap}px`);
      refs.crosshair.style.opacity = s.showCrosshair ? '1' : '0';
      if (now > hitUntil) refs.hitmarker.classList.remove('show');
      if (now > bannerUntil) refs.banner.classList.remove('show');
      if (now > toastUntil) refs.toast.classList.remove('show');
      damage = Math.max(0, damage - 0.02);
      const lowHp = s.health > 0 && s.health < 30 ? 0.18 + 0.1 * Math.sin(now * 0.006) : 0;
      refs.vignette.style.opacity = Math.min(0.85, damage + lowHp).toFixed(2);
    },
    drawMinimap(player, mates, flashes) {
      const W = refs.minimap.width;
      const H = refs.minimap.height;
      const sx = W / (MAP.maxX - MAP.minX);
      const sz = H / (MAP.maxZ - MAP.minZ);
      const px = (x) => (x - MAP.minX) * sx;
      const pz = (z) => (z - MAP.minZ) * sz;
      mm.clearRect(0, 0, W, H);
      mm.fillStyle = 'rgba(12,14,18,0.72)';
      mm.fillRect(0, 0, W, H);
      mm.fillStyle = 'rgba(242,234,217,0.28)';
      for (const r of wallRects) mm.fillRect(px(r.x), pz(r.z), Math.max(1.5, r.w * sx), Math.max(1.5, r.d * sz));
      mm.fillStyle = 'rgba(255,122,60,0.9)';
      for (const f of flashes) {
        mm.beginPath();
        mm.arc(px(f.x), pz(f.z), 3.5, 0, Math.PI * 2);
        mm.fill();
      }
      mm.fillStyle = '#57a8ff';
      for (const m of mates) {
        mm.beginPath();
        mm.arc(px(m.x), pz(m.z), 3, 0, Math.PI * 2);
        mm.fill();
      }
      mm.save();
      mm.translate(px(player.x), pz(player.z));
      mm.rotate(Math.atan2(Math.sin(player.yaw), Math.cos(player.yaw)) + Math.PI);
      mm.fillStyle = '#ffffff';
      mm.beginPath();
      mm.moveTo(0, -6);
      mm.lineTo(4.5, 5);
      mm.lineTo(-4.5, 5);
      mm.closePath();
      mm.fill();
      mm.restore();
    },
    killfeed(killer, victim, weaponName, headshot, killerTeam) {
      const row = document.createElement('div');
      row.className = 'feed-row';
      const k = document.createElement('span');
      k.className = killerTeam === 'vanguard' ? 'feed-v' : 'feed-j';
      k.textContent = killer;
      const w = document.createElement('span');
      w.className = 'feed-w';
      w.textContent = headshot ? ` ◉ ${weaponName} ` : ` ${weaponName} `;
      const v = document.createElement('span');
      v.className = killerTeam === 'vanguard' ? 'feed-j' : 'feed-v';
      v.textContent = victim;
      row.append(k, w, v);
      refs.killfeed.prepend(row);
      while (refs.killfeed.children.length > 5) refs.killfeed.lastChild.remove();
      setTimeout(() => row.classList.add('fade'), 8000);
      setTimeout(() => row.remove(), 10000);
    },
    banner(title, sub, cls, ms = 3000) {
      refs.bannerTitle.textContent = title;
      refs.bannerSub.textContent = sub || '';
      refs.banner.className = `show ${cls || ''}`;
      bannerUntil = performance.now() + ms;
    },
    hideBanner() {
      refs.banner.classList.remove('show');
      bannerUntil = 0;
    },
    toast(msg, ms = 1800) {
      refs.toast.textContent = msg;
      refs.toast.classList.add('show');
      toastUntil = performance.now() + ms;
    },
    hitmarker(kill) {
      refs.hitmarker.classList.add('show');
      refs.hitmarker.classList.toggle('kill', !!kill);
      hitUntil = performance.now() + 140;
    },
    damageFlash(amount) {
      damage = Math.min(0.8, damage + 0.25 + amount * 0.004);
    },
    setBuyOpen(open, money, ownedPrimary, hasArmor) {
      refs.buyMenu.classList.toggle('open', open);
      if (!open) return;
      for (const b of buyGrid.children) {
        const id = b.dataset.buy;
        const price = id === 'armor' ? ARMOR_PRICE : WEAPONS[id].price;
        const owned = id === 'armor' ? hasArmor : ownedPrimary === id;
        b.classList.toggle('cant', money < price && !owned);
        b.classList.toggle('owned', owned);
      }
    },
    buyOpen() {
      return refs.buyMenu.classList.contains('open');
    },
    showStart() { refs.start.classList.remove('hidden'); },
    hideStart() { refs.start.classList.add('hidden'); },
    showPause(show) { refs.pause.classList.toggle('hidden', !show); },
    showEnd(show, winner, stats) {
      refs.end.classList.toggle('hidden', !show);
      if (!show) return;
      refs.endTitle.textContent = winner === 'vanguard' ? 'VANGUARD WINS' : 'JACKALS WIN';
      refs.endTitle.className = winner === 'vanguard' ? 'win-v' : 'win-j';
      refs.endStats.textContent = stats;
    },
    setSpectating(name) {
      refs.spectate.classList.toggle('hidden', !name);
      if (name) refs.spectate.textContent = `SPECTATING ${name} — click to follow another`;
    },
    setStartButton(text) {
      el('play-btn').textContent = text;
    },
  };
}
