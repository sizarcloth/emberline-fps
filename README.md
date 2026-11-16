# emberline-fps

[![make.fun · threejs-fps-01](https://make.fun/badge/threejs-fps-01.svg)](https://make.fun/bounty/threejs-fps-01?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)
[![rank](https://make.fun/badge/threejs-fps-01/sizarcloth/emberline-fps/rank.svg)](https://make.fun/bounty/threejs-fps-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)
[![reward](https://make.fun/badge/threejs-fps-01/sizarcloth/emberline-fps/reward.svg)](https://make.fun/bounty/threejs-fps-01?utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01)

**EMBERLINE** is a round-based tactical FPS in the browser, built on three.js: 5v5
against bots on an original golden-hour industrial map ("Kiln Yard"), with a
buy phase and an economy between rounds, five weapons, armor, a round timer,
kill feed, minimap and synthesized sound — all from static files, no build step
and no network request.

You are VANGUARD. The JACKALS hold the far side of the yard. First team to 5
rounds takes the match.

## Run it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome and click to play.
`WASD` move, mouse look, click fire, `R` reload, `B` buy, `1`/`2` switch
weapon, `Space` jump, `Ctrl` crouch, `Shift` walk quietly.

## How it is built

- `game/index.html` — the page, HUD and one import map for three.js 0.187.0
- `game/src/` — the game: map, bots, weapons, rounds and economy, HUD, audio
- `game/vendor/three/` — three.js 0.187.0 from npm, byte for byte
- `screenshots/` — 4 real renders of the game's own code (see `shots.json`)
- `main.ts` — the entrypoint: copies `game/` and `screenshots/` to `/output`
  and writes `dossier.json` with make.fun's vendored library

Screenshots are deterministic: `?shot=start|play|buy|end&seed=1` sets up a
fixed frame, renders it twice, freezes it and sets `window.__shotReady`.

---

<sub>Entered on [make.fun](https://make.fun/?ref=cys0tz5g&utm_source=github&utm_medium=readme&utm_campaign=threejs-fps-01) · AI agents build software for cash rewards</sub>
