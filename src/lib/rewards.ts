// 10 in-app rewards definitions

export type RewardKind =
  | "level-skipper"
  | "extra-time"
  | "reveal-peek"
  | "card-back-galaxy"
  | "card-back-nebula"
  | "card-back-starlight"
  | "memory-booster"
  | "freeze-timer"
  | "shuffle-swap"
  | "hint-spark";

export type RewardDef = {
  kind: RewardKind;
  name: string;
  description: string;
  image: string;
  cosmetic?: boolean;
  // Functional boosts that can be applied before/during a level
  boost?: "extra-time" | "reveal-peek" | "freeze-timer" | "memory-booster" | "shuffle-swap" | "hint-spark";
};

export const REWARDS: Record<RewardKind, RewardDef> = {
  "level-skipper":     { kind: "level-skipper",     name: "Level Skipper",      description: "Skip the next level (no reward for skipped level).",   image: "/images/rewards/level-skipper.jpg" },
  "extra-time":        { kind: "extra-time",        name: "Extra Time",         description: "+15 seconds on a timed level (once per level).",       image: "/images/rewards/extra-time.jpg", boost: "extra-time" },
  "reveal-peek":       { kind: "reveal-peek",       name: "Reveal Peek",        description: "Peek at all cards for 1.5 seconds (once per level).",  image: "/images/rewards/reveal-peek.jpg", boost: "reveal-peek" },
  "card-back-galaxy":  { kind: "card-back-galaxy",  name: "Card Back: Galaxy",  description: "Cosmetic – Galaxy card back design.",                  image: "/images/rewards/card-back-galaxy.jpg", cosmetic: true },
  "card-back-nebula":  { kind: "card-back-nebula",  name: "Card Back: Nebula",  description: "Cosmetic – Nebula card back design.",                  image: "/images/rewards/card-back-nebula.jpg", cosmetic: true },
  "card-back-starlight":{kind:"card-back-starlight",name: "Card Back: Starlight",description:"Cosmetic – Starlight card back design.",               image: "/images/rewards/card-back-starlight.jpg", cosmetic: true },
  "memory-booster":    { kind: "memory-booster",    name: "Memory Booster",     description: "Double streak points for one level.",                  image: "/images/rewards/memory-booster.jpg", boost: "memory-booster" },
  "freeze-timer":      { kind: "freeze-timer",      name: "Freeze Timer",       description: "Pause the timer for 5 seconds (once per level).",      image: "/images/rewards/freeze-timer.jpg", boost: "freeze-timer" },
  "shuffle-swap":      { kind: "shuffle-swap",      name: "Shuffle Swap",       description: "Shuffle unmatched cards (once per level).",            image: "/images/rewards/shuffle-swap.jpg", boost: "shuffle-swap" },
  "hint-spark":        { kind: "hint-spark",        name: "Hint Spark",         description: "Highlight one matching pair for 1 sec (once per level).",image: "/images/rewards/hint-spark.jpg", boost: "hint-spark" },
};

export const REWARD_KINDS = Object.keys(REWARDS) as RewardKind[];

// Pick a random reward weighted slightly by level (rarer rewards later)
export function pickRandomReward(level: number): RewardKind {
  const easy: RewardKind[] = ["extra-time", "reveal-peek", "hint-spark", "freeze-timer", "shuffle-swap"];
  const mid: RewardKind[] = ["memory-booster", "card-back-galaxy", "card-back-nebula", "card-back-starlight"];
  const rare: RewardKind[] = ["level-skipper"];
  let pool: RewardKind[];
  if (level <= 10) pool = easy;
  else if (level <= 40) pool = [...easy, ...mid];
  else pool = [...easy, ...mid, ...rare, ...mid];
  return pool[Math.floor(Math.random() * pool.length)];
}
