// Match flow: freeze time, the live round, the end banner, then the next round.
// First team to 5 rounds takes the match. Money is earned per kill and per round
// result, and the buy window stays open through the freeze plus 15 seconds of
// the round. Timeouts go to the team with more players standing.
export const ROUND_TIME = 100;
export const FREEZE_TIME = 5;
export const BUY_EXTRA_TIME = 15;
export const ROUNDS_TO_WIN = 5;
export const START_MONEY = 800;
export const KILL_REWARD = 300;
export const WIN_REWARD = 3250;
export const LOSS_REWARD = 1400;
export const MAX_MONEY = 16000;

export function createRounds() {
  const state = {
    phase: 'lobby', // lobby | freeze | live | ended | matchEnd
    round: 0,
    score: { vanguard: 0, jackal: 0 },
    timer: 0,
    phaseTimer: 0,
    money: START_MONEY,
    armor: 0,
    kills: 0,
    deaths: 0,
    roundKills: 0,
    lastResult: null,
    lastReason: '',
  };

  return {
    state,
    startMatch() {
      state.phase = 'freeze';
      state.round = 1;
      state.score = { vanguard: 0, jackal: 0 };
      state.timer = ROUND_TIME;
      state.phaseTimer = FREEZE_TIME;
      state.money = START_MONEY;
      state.armor = 0;
      state.kills = 0;
      state.deaths = 0;
      state.roundKills = 0;
      state.lastResult = null;
    },
    nextRound() {
      state.round += 1;
      state.phase = 'freeze';
      state.phaseTimer = FREEZE_TIME;
      state.timer = ROUND_TIME;
      state.roundKills = 0;
      state.lastResult = null;
    },
    endRound(winner, reason) {
      state.phase = 'ended';
      state.phaseTimer = 3.5;
      state.lastResult = winner;
      state.lastReason = reason;
      if (winner === 'draw') {
        state.money = Math.min(MAX_MONEY, state.money + LOSS_REWARD);
        return;
      }
      state.score[winner] += 1;
      const playerWon = winner === 'vanguard';
      state.money = Math.min(MAX_MONEY, state.money + (playerWon ? WIN_REWARD : LOSS_REWARD));
    },
    matchOver() {
      return state.score.vanguard >= ROUNDS_TO_WIN || state.score.jackal >= ROUNDS_TO_WIN;
    },
    matchWinner() {
      if (state.score.vanguard >= ROUNDS_TO_WIN) return 'vanguard';
      if (state.score.jackal >= ROUNDS_TO_WIN) return 'jackal';
      return null;
    },
    buyWindowOpen() {
      if (state.phase === 'freeze') return true;
      if (state.phase === 'live' && state.timer > ROUND_TIME - BUY_EXTRA_TIME) return true;
      return false;
    },
    canAfford(price) {
      return state.money >= price;
    },
    spend(price) {
      if (!this.canAfford(price)) return false;
      state.money -= price;
      return true;
    },
    onKill() {
      state.kills += 1;
      state.roundKills += 1;
      state.money = Math.min(MAX_MONEY, state.money + KILL_REWARD);
    },
    onDeath() {
      state.deaths += 1;
      state.armor = 0;
    },
    buyArmor() {
      if (state.armor > 0 || !this.canAfford(650)) return false;
      state.money -= 650;
      state.armor = 50;
      return true;
    },
    step(dt) {
      if (state.phase === 'freeze') {
        state.phaseTimer -= dt;
        if (state.phaseTimer <= 0) {
          state.phase = 'live';
          return 'roundStart';
        }
      } else if (state.phase === 'live') {
        state.timer -= dt;
        if (state.timer <= 0) {
          state.timer = 0;
          return 'timeout';
        }
      } else if (state.phase === 'ended') {
        state.phaseTimer -= dt;
        if (state.phaseTimer <= 0) {
          if (this.matchOver()) {
            state.phase = 'matchEnd';
            return 'matchEnd';
          }
          this.nextRound();
          return 'nextRound';
        }
      }
      return null;
    },
  };
}
