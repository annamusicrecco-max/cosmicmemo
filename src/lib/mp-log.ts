// Multiplayer telemetry logger.
// Keeps a ring buffer of structured events in localStorage so beta testers can
// share their experience from Settings → Multiplayer Diagnostics, and mirrors
// every event to console.* so devs reading DevTools see them too.

export type MpLogLevel = "info" | "warn" | "error" | "perf";

export type MpLogEntry = {
  t: number; // epoch ms
  level: MpLogLevel;
  tag: string; // short category, e.g. "match", "flip", "rt"
  msg: string;
  ms?: number; // duration when relevant
  meta?: Record<string, unknown>;
};

const KEY = "cosmic_mp_log_v1";
const MAX = 300;

function read(): MpLogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as MpLogEntry[]) : [];
  } catch {
    return [];
  }
}
function write(entries: MpLogEntry[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(-MAX)));
  } catch {
    /* quota — ignore */
  }
}

type Listener = (entries: MpLogEntry[]) => void;
const listeners = new Set<Listener>();

function emit() {
  const all = read();
  listeners.forEach((l) => {
    try { l(all); } catch { /* swallow */ }
  });
}

export function subscribeMpLog(l: Listener): () => void {
  listeners.add(l);
  l(read());
  return () => listeners.delete(l);
}

export function getMpLog(): MpLogEntry[] {
  return read();
}

export function clearMpLog() {
  write([]);
  emit();
}

function push(entry: MpLogEntry) {
  const all = read();
  all.push(entry);
  write(all);
  emit();
  const line = `[MP ${entry.tag}]${entry.ms != null ? ` ${entry.ms}ms` : ""} ${entry.msg}`;
  const meta = entry.meta;
  if (entry.level === "error") console.error(line, meta ?? "");
  else if (entry.level === "warn") console.warn(line, meta ?? "");
  else if (entry.level === "perf") console.info(line, meta ?? "");
  else console.log(line, meta ?? "");
}

export const mpLog = {
  info(tag: string, msg: string, meta?: Record<string, unknown>) {
    push({ t: Date.now(), level: "info", tag, msg, meta });
  },
  warn(tag: string, msg: string, meta?: Record<string, unknown>) {
    push({ t: Date.now(), level: "warn", tag, msg, meta });
  },
  error(tag: string, msg: string, meta?: Record<string, unknown>) {
    push({ t: Date.now(), level: "error", tag, msg, meta });
  },
  perf(tag: string, msg: string, ms: number, meta?: Record<string, unknown>) {
    push({ t: Date.now(), level: "perf", tag, msg, ms: Math.round(ms), meta });
  },
  /** Time an async block and log its duration. */
  async time<T>(tag: string, msg: string, fn: () => Promise<T>, meta?: Record<string, unknown>): Promise<T> {
    const start = performance.now();
    try {
      const out = await fn();
      mpLog.perf(tag, msg, performance.now() - start, meta);
      return out;
    } catch (e) {
      mpLog.error(tag, `${msg} failed: ${(e as Error).message}`, { ...meta, ms: Math.round(performance.now() - start) });
      throw e;
    }
  },
};

// ---- Speed summary ----

export type MpSpeedSummary = {
  flipCount: number;
  flipP50: number | null;
  flipP95: number | null;
  flipMax: number | null;
  matchWaitMs: number | null;
  rtLatencyP50: number | null;
  rtLatencyP95: number | null;
  errors: number;
  warnings: number;
  lastGameAt: number | null;
};

function pct(sorted: number[], p: number): number | null {
  if (!sorted.length) return null;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((p / 100) * sorted.length)));
  return Math.round(sorted[idx]);
}

export function summarizeMpLog(entries: MpLogEntry[] = read()): MpSpeedSummary {
  const flips = entries.filter((e) => e.tag === "flip" && e.level === "perf" && typeof e.ms === "number").map((e) => e.ms!) ;
  const rt = entries.filter((e) => e.tag === "rt" && e.level === "perf" && typeof e.ms === "number").map((e) => e.ms!);
  const flipSorted = [...flips].sort((a, b) => a - b);
  const rtSorted = [...rt].sort((a, b) => a - b);
  const matchPerf = [...entries].reverse().find((e) => e.tag === "match" && e.level === "perf");
  const lastGame = [...entries].reverse().find((e) => e.tag === "match" || e.tag === "flip");
  return {
    flipCount: flips.length,
    flipP50: pct(flipSorted, 50),
    flipP95: pct(flipSorted, 95),
    flipMax: flipSorted.length ? Math.round(flipSorted[flipSorted.length - 1]) : null,
    matchWaitMs: matchPerf?.ms ?? null,
    rtLatencyP50: pct(rtSorted, 50),
    rtLatencyP95: pct(rtSorted, 95),
    errors: entries.filter((e) => e.level === "error").length,
    warnings: entries.filter((e) => e.level === "warn").length,
    lastGameAt: lastGame?.t ?? null,
  };
}
