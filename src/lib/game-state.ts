// Game state, levels config, rewards, persistence
import type { RewardKind } from "./rewards";

export type LevelConfig = {
  level: number;
  rows: number;
  cols: number;
  timeLimit?: number;
  moveLimit?: number;
  emojiSet: string[];
};

const EMOJI_POOL: string[] = [
  "🌞","🌙","⭐","🌈","🔥","💧","❄️","🧊","⚡","🌪️",
  "🐱","🐶","🦊","🐻","🐼","🐨","🐯","🦁","🐸","🐵",
  "🐙","🐳","🐬","🦋","🐞","🦄","🐢","🦉","🦩","🐝",
  "🍎","🍊","🍋","🍉","🍇","🍓","🍑","🍍","🥝","🍒",
  "🍕","🍔","🍟","🌮","🍩","🍪","🎂","🍫","🍿","🍣",
  "🚀","🛸","🪐","☄️","🌌","🛰️","👽","🤖","🎈","🎁",
  "❤️","💎","🎲","🎵","⚽","🏆","🎯","🎨","🎮","🃏",
];

const HARD_CATEGORIES: string[][] = [
  ["🍋","🍌","🍍","🍊","🍑","🥭","🍈","🌽","🧀","🥯","🟡","🟨"],
  ["🔵","🟦","💙","🧊","💎","🫐","🌐","🔷","🔹","💧","🐳","🐬"],
  ["❤️","🍎","🍓","🍒","🌹","🟥","🔴","💖","💗","💓","💘","🍅"],
  ["🥝","🥦","🥒","🍀","🌿","🍃","🌵","🟢","🟩","💚","🐸","🥬"],
  ["😀","😃","😄","😁","😆","😊","🙂","😉","😌","😋","🤗","🤩"],
  ["🌑","🌒","🌓","🌔","🌕","🌖","🌗","🌘","🪐","☄️","🌌","🛸"],
  ["🟣","🟪","💜","🍇","🔮","☂️","👾","🦄","🦝","🪻","🫐","🍆"],
];

export function getLevelConfig(level: number): LevelConfig {
  let rows = 2, cols = 2, timeLimit: number | undefined, moveLimit: number | undefined;
  if (level === 1)          { rows = 2; cols = 2; }
  else if (level <= 3)      { rows = 2; cols = 3; }
  else if (level <= 6)      { rows = 3; cols = 4; }
  else if (level <= 9)      { rows = 4; cols = 4; }
  else if (level === 10)    { rows = 4; cols = 4; timeLimit = 75; }
  else if (level <= 15)     { rows = 4; cols = 5; timeLimit = 90; }
  else if (level <= 25)     { rows = 5; cols = 6; timeLimit = 120; }
  else if (level <= 40)     { rows = 6; cols = 6; timeLimit = 150; }
  else if (level <= 60)     { rows = 6; cols = 6; timeLimit = 120; }
  else if (level <= 80)     { rows = 6; cols = 6; timeLimit = 90;  moveLimit = 60; }
  else                      { rows = 6; cols = 6; timeLimit = 75;  moveLimit = 50; }

  let emojiSet = EMOJI_POOL;
  if (level >= 26) {
    const cat = HARD_CATEGORIES[Math.floor(Math.random() * HARD_CATEGORIES.length)];
    if (cat.length >= (rows * cols) / 2) emojiSet = cat;
  }
  return { level, rows, cols, timeLimit, moveLimit, emojiSet };
}

// ---------- Persistence ----------
const KEY = "cosmic-memory-v2";

export type InventoryItem = {
  id: string;
  kind: RewardKind;
  level: number;
  earnedAt: number;
  usedAt?: number;
};

export type CardBack = "default" | "galaxy" | "nebula" | "starlight";

export type GameState = {
  highestUnlocked: number;
  completed: number[];
  streak: number;
  inventory: InventoryItem[];
  premium: boolean;
  muted: boolean;
  cardBack: CardBack;
  times: Record<number, number>;
};

export function defaultState(): GameState {
  return {
    highestUnlocked: 1,
    completed: [],
    streak: 0,
    inventory: [],
    premium: false,
    muted: false,
    cardBack: "default",
    times: {},
  };
}

export function loadState(): GameState {
  if (typeof window === "undefined") return defaultState();
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return defaultState();
    return { ...defaultState(), ...(JSON.parse(raw) as Partial<GameState>) };
  } catch {
    return defaultState();
  }
}

export function saveState(s: GameState) {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function resetState() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

export function vibrate(ms: number | number[]) {
  if (typeof navigator !== "undefined" && "vibrate" in navigator) {
    try { navigator.vibrate(ms); } catch { /* ignore */ }
  }
}

export function buildDeck(cfg: LevelConfig): string[] {
  const total = cfg.rows * cfg.cols;
  const pairs = total / 2;
  const pool = [...cfg.emojiSet];
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

export function beep(type: "click" | "match" | "miss" | "win") {
  if (typeof window === "undefined") return;
  try {
    const s = loadState();
    if (s.muted) return;
    const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    const freqs = { click: 600, match: 880, miss: 160, win: 1200 };
    o.frequency.value = freqs[type];
    o.type = type === "miss" ? "sawtooth" : "sine";
    g.gain.setValueAtTime(0.12, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (type === "win" ? 0.6 : 0.2));
    o.start();
    o.stop(ctx.currentTime + (type === "win" ? 0.6 : 0.2));
  } catch { /* ignore */ }
}
