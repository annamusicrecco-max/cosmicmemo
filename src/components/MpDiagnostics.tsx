import { useEffect, useMemo, useState } from "react";
import { subscribeMpLog, clearMpLog, summarizeMpLog, type MpLogEntry } from "@/lib/mp-log";

export function MpDiagnostics() {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<MpLogEntry[]>([]);

  useEffect(() => subscribeMpLog(setEntries), []);
  const summary = useMemo(() => summarizeMpLog(entries), [entries]);

  const copy = async () => {
    const blob = JSON.stringify({ summary, entries: entries.slice(-100) }, null, 2);
    try { await navigator.clipboard.writeText(blob); } catch { /* ignore */ }
  };

  const fmt = (n: number | null, unit = "ms") => (n == null ? "—" : `${n}${unit}`);
  const ago = (t: number | null) => {
    if (!t) return "never";
    const s = Math.round((Date.now() - t) / 1000);
    if (s < 60) return `${s}s ago`;
    if (s < 3600) return `${Math.round(s / 60)}m ago`;
    return `${Math.round(s / 3600)}h ago`;
  };

  return (
    <div className="rounded-2xl border border-white/10 overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
        style={{ background: "rgba(255,255,255,0.05)" }}
      >
        <span>📡 Multiplayer Diagnostics</span>
        <span className="text-xs text-muted-foreground">
          {summary.errors > 0 ? `⚠ ${summary.errors} err` : "ok"} · {open ? "▲" : "▼"}
        </span>
      </button>

      {open && (
        <div className="p-4 space-y-3 text-xs">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Last game" value={ago(summary.lastGameAt)} />
            <Stat label="Match wait" value={fmt(summary.matchWaitMs)} />
            <Stat label="Flip p50" value={fmt(summary.flipP50)} />
            <Stat label="Flip p95" value={fmt(summary.flipP95)}
              warn={summary.flipP95 != null && summary.flipP95 > 1500} />
            <Stat label="Flip max" value={fmt(summary.flipMax)}
              warn={summary.flipMax != null && summary.flipMax > 3000} />
            <Stat label="Realtime p95" value={fmt(summary.rtLatencyP95)}
              warn={summary.rtLatencyP95 != null && summary.rtLatencyP95 > 2000} />
            <Stat label="Flips logged" value={String(summary.flipCount)} />
            <Stat label="Errors / Warnings"
              value={`${summary.errors} / ${summary.warnings}`}
              warn={summary.errors > 0} />
          </div>

          <div
            className="rounded-lg p-2 max-h-48 overflow-y-auto font-mono text-[10px] leading-relaxed"
            style={{ background: "rgba(0,0,0,0.4)" }}
          >
            {entries.length === 0 ? (
              <div className="text-muted-foreground">No events yet. Play a multiplayer game to populate logs.</div>
            ) : (
              entries.slice(-80).reverse().map((e, i) => (
                <div key={i} className="flex gap-2">
                  <span className="text-muted-foreground shrink-0">
                    {new Date(e.t).toLocaleTimeString()}
                  </span>
                  <span className={`shrink-0 font-bold ${
                    e.level === "error" ? "text-destructive"
                    : e.level === "warn" ? "text-yellow-400"
                    : e.level === "perf" ? "text-accent"
                    : "text-foreground/80"
                  }`}>[{e.tag}]</span>
                  <span className="break-all">
                    {e.msg}{e.ms != null ? ` · ${e.ms}ms` : ""}
                  </span>
                </div>
              ))
            )}
          </div>

          <div className="flex gap-2">
            <button onClick={copy} className="flex-1 glass rounded-full py-2 text-xs font-semibold">
              📋 Copy logs
            </button>
            <button onClick={clearMpLog} className="flex-1 glass rounded-full py-2 text-xs font-semibold">
              🧹 Clear
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Lower is better. Flip p95 over 1.5s or realtime p95 over 2s indicates the freezing-multiplayer glitch.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, warn = false }: { label: string; value: string; warn?: boolean }) {
  return (
    <div
      className="rounded-lg px-2 py-1.5"
      style={{
        background: warn ? "rgba(239,68,68,0.18)" : "rgba(255,255,255,0.05)",
        border: `1px solid ${warn ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
      }}
    >
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="font-bold">{value}</div>
    </div>
  );
}
