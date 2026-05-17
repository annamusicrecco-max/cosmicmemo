// Game state, levels config, rewards, persistence

export type LevelConfig = {
  level: number;
  rows: number;
  cols: number;
  timeLimit?: number; // seconds
  moveLimit?: number;
  emojiSet: string[];
};

// Single large pool — every level draws randomly from this pool.
const EMOJI_POOL: string[] = [
  "🌞","🌙","⭐","🌈","🔥","💧","❄️","🧊","⚡","🌪️",
  "🐱","🐶","🦊","🐻","🐼","🐨","🐯","🦁","🐸","🐵",
  "🐙","🐳","🐬","🦋","🐞","🦄","🐢","🦉","🦩","🐝",
  "🍎","🍊","🍋","🍉","🍇","🍓","🍑","🍍","🥝","🍒",
  "🍕","🍔","🍟","🌮","🍩","🍪","🎂","🍫","🍿","🍣",
  "🚀","🛸","🪐","☄️","🌌","🛰️","👽","🤖","🎈","🎁",
  "❤️","💎","🎲","🎵","⚽","🏆","🎯","🎨","🎮","🃏",
];

export function getLevelConfig(level: number): LevelConfig {
  let rows = 2, cols = 2, timeLimit: number | undefined, moveLimit: number | undefined;
  if (level <= 15) { rows = 2; cols = 2; }
  else if (level <= 30) { rows = 2; cols = 3; }
  else if (level <= 45) { rows = 3; cols = 4; timeLimit = 60; }
  else if (level <= 60) { rows = 4; cols = 4; timeLimit = 75; }
  else if (level <= 75) { rows = 4; cols = 5; timeLimit = 90; moveLimit = 50; }
  else if (level <= 90) { rows = 5; cols = 6; timeLimit = 120; moveLimit = 60; }
  else { rows = 6; cols = 6; timeLimit = 150; moveLimit = 70; }
  return { level, rows, cols, timeLimit, moveLimit, emojiSet: EMOJI_POOL };
}

// ---------- Rewards ----------
export type Reward = {
  id: string;
  advertiser: string;
  title: string;
  code?: string;
  url?: string;
  tier: 1 | 2 | 3;
};

export const REWARD_POOLS: Reward[] = [
  // Tier 1
  { id: "spotify-playlist", advertiser: "Spotify", title: "Relaxing Cosmic playlist", url: "https://open.spotify.com", tier: 1 },
  { id: "mock-10", advertiser: "MockStore", title: "10% off MockStore", code: "MOCK10", tier: 1 },
  { id: "duolingo-7", advertiser: "Duolingo", title: "7-day Super trial", code: "COSMIC7", tier: 1 },
  // Tier 2
  { id: "sbux-5", advertiser: "Starbucks", title: "$5 Starbucks gift card raffle", code: "SBUX-RAFFLE", tier: 2 },
  { id: "nike-20", advertiser: "Nike", title: "20% off Nike", code: "NIKE20", tier: 2 },
  { id: "uber-10", advertiser: "Uber", title: "$10 Uber ride credit", code: "UBER10", tier: 2 },
  // Tier 3
  { id: "netflix-1m", advertiser: "Netflix", title: "1 month free Netflix raffle", code: "NFLX-RAFFLE", tier: 3 },
  { id: "amazon-10", advertiser: "Amazon", title: "$10 Amazon gift card", code: "AMZN-COSMIC10", tier: 3 },
  { id: "apple-music", advertiser: "Apple Music", title: "3 months Apple Music free", code: "APL-MUSIC3", tier: 3 },
];

export function pickReward(level: number, streak: number): Reward {
  let tier: 1 | 2 | 3 = 1;
  if (level >= 51) tier = 3;
  else if (level >= 11) tier = 2;
  // streak bonus: 30% chance to bump tier
  if (streak >= 5 && Math.random() < 0.3 && tier < 3) tier = (tier + 1) as 1 | 2 | 3;
  const pool = REWARD_POOLS.filter((r) => r.tier === tier);
  return pool[Math.floor(Math.random() * pool.length)];
}

// ---------- Persistence ----------
const KEY = "cosmic-memory-v1";

export type ClaimedReward = Reward & { level: number; claimedAt: number };

export type Advertiser = {
  name: string;
  offer: string;
  code: string;
  remaining: number;
  claims: number;
};

export type GameState = {
  highestUnlocked: number;
  completed: number[];
  streak: number;
  claimed: ClaimedReward[];
  advertisers: Advertiser[];
};

const DEFAULT_ADVERTISERS: Advertiser[] = [
  { name: "Nike", offer: "20% off Nike", code: "NIKE20", remaining: 1000, claims: 0 },
  { name: "Spotify", offer: "Relaxing Cosmic playlist", code: "SPOT-LINK", remaining: 1000, claims: 0 },
  { name: "Starbucks", offer: "$5 Starbucks gift card raffle", code: "SBUX-RAFFLE", remaining: 500, claims: 0 },
  { name: "Netflix", offer: "1 month free Netflix raffle", code: "NFLX-RAFFLE", remaining: 250, claims: 0 },
  { name: "Amazon", offer: "$10 Amazon gift card", code: "AMZN-COSMIC10", remaining: 250, claims: 0 },
];

export function loadState(): GameState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw) as GameState;
    if (!parsed.advertisers) parsed.advertisers = DEFAULT_ADVERTISERS;
    return parsed;
  } catch {
    return defaultState();
  }
}

export function defaultState(): GameState {
  return { highestUnlocked: 1, completed: [], streak: 0, claimed: [], advertisers: DEFAULT_ADVERTISERS };
}

export function saveState(s: GameState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function vibrate(ms: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate(ms); } catch { /* ignore */ }
  }
}

// Build shuffled card deck for a level
export function buildDeck(cfg: LevelConfig): string[] {
  const total = cfg.rows * cfg.cols;
  const pairs = total / 2;
  const pool = [...cfg.emojiSet];
  // shuffle pool
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, pairs);
  const deck = [...chosen, ...chosen];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

// Sound — simple Web Audio beeps
export function beep(type: "click" | "match" | "miss" | "win") {
  if (typeof window === "undefined") return;
  try {
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    const freqs = { click: 600, match: 880, miss: 160, win: 1200 };
    o.frequency.value = freqs[type];
    o.type = type === "miss" ? "sawtooth" : "sine";
    g.gain.setValueAtTime(0.15, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (type === "win" ? 0.6 : 0.2));
    o.start();
    o.stop(ctx.currentTime + (type === "win" ? 0.6 : 0.2));
  } catch { /* ignore */ }
}
