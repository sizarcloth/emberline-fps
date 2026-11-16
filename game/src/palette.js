// EMBERLINE look plan: one palette for the whole game, in code and in CSS.
// Golden hour over a desert brickworks: warm sand and brick, cool steel shadows,
// one amber accent for the sun and the HUD. Lighting makes every other shade.
export const PALETTE = {
  sky: '#e8a35c', // low sun haze
  skyTop: '#7d94b8', // dusk blue overhead
  sand: '#b98d5f', // yard ground
  brick: '#8a5a44', // kiln and walls
  concrete: '#8d8a82', // barriers and floors
  steel: '#4a5058', // silos, pipes, crates
  darkSteel: '#2e333a', // gunmetal
  rust: '#7a4a2e', // barrels and trim
  ink: '#f2ead9', // HUD text
  muted: '#b8ab90', // secondary HUD text
  accent: '#ffb347', // sun amber, HUD accent
  vanguard: '#57a8ff', // player team
  jackal: '#ff7a3c', // enemy team
  danger: '#ff4d4d',
  health: '#7dd069',
};

// Deterministic seeded RNG (mulberry32) for screenshot staging and bot
// decisions, so `?shot=…&seed=N` renders the same frame every time.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
