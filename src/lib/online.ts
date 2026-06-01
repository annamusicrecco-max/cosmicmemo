// Device-scoped player ID for online multiplayer (no Supabase Auth).
const KEY = "cosmic_player_id";
const NAME_KEY = "cosmic_player_name";

export function getPlayerId(): string {
  if (typeof window === "undefined") return "";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `p_${Math.random().toString(36).slice(2)}_${Date.now()}`;
    localStorage.setItem(KEY, id);
  }
  return id;
}

export function getPlayerName(): string {
  if (typeof window === "undefined") return "Player";
  return localStorage.getItem(NAME_KEY) || "";
}

export function setPlayerName(name: string) {
  localStorage.setItem(NAME_KEY, name.slice(0, 20));
}

export const CARD_EMOJIS = [
  "🌞", "🌙", "⭐", "🌈", "🔥", "💧", "❄️", "⚡",
  "🐱", "🐶", "🦊", "🐻", "🐼", "🐨", "🐯", "🦁",
  "🚀", "🛸", "🪐", "☄️", "🌌", "👽", "🤖", "🎈",
];

export type BoardCard = { id: number; emoji: string; matched: boolean };

export function buildBoard(): BoardCard[] {
  const pool = [...CARD_EMOJIS];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, 8);
  const deck = [...chosen, ...chosen].map((emoji, id) => ({ id, emoji, matched: false }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck.map((c, i) => ({ ...c, id: i }));
}
