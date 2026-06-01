import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Universe } from "@/components/Universe";
import { SettingsPanel } from "@/components/SettingsPanel";
import { loadState, type GameState } from "@/lib/game-state";

export const Route = createFileRoute("/levels")({
  component: LevelsPage,
  head: () => ({
    meta: [
      { title: "Levels — Cosmic Memory" },
      { name: "description", content: "Drag through 100 cosmic levels and unlock rewards as you progress." },
    ],
  }),
});


function LevelsPage() {
  const [state, setState] = useState<GameState | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [mpOpen, setMpOpen] = useState(false);
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0, moved: 0 });

  useEffect(() => { setState(loadState()); }, []);

  // Auto-scroll to current level when ready
  useEffect(() => {
    if (!state || !scrollerRef.current) return;
    const target = scrollerRef.current.querySelector<HTMLButtonElement>(`[data-level="${state.highestUnlocked}"]`);
    if (target && scrollerRef.current) {
      const el = scrollerRef.current;
      const offset = target.offsetLeft - el.clientWidth / 2 + target.clientWidth / 2;
      el.scrollTo({ left: Math.max(0, offset), behavior: "smooth" });
    }
  }, [state]);

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  const onPointerDown = (e: React.PointerEvent) => {
    const el = scrollerRef.current; if (!el) return;
    drag.current = { active: true, startX: e.clientX, scrollLeft: el.scrollLeft, moved: 0 };
    el.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const el = scrollerRef.current; if (!el) return;
    const dx = e.clientX - drag.current.startX;
    drag.current.moved = Math.abs(dx);
    el.scrollLeft = drag.current.scrollLeft - dx;
  };
  const onPointerUp = (e: React.PointerEvent) => {
    drag.current.active = false;
    try { scrollerRef.current?.releasePointerCapture(e.pointerId); } catch { /* ignore */ }
  };

  const launch = (lvl: number, unlocked: boolean) => {
    if (drag.current.moved > 6) return;
    if (!unlocked) return;
    navigate({ to: "/play/$level", params: { level: String(lvl) } });
  };

  const highest = state?.highestUnlocked ?? 1;

  return (
    <main className="relative min-h-screen flex flex-col overflow-hidden">
      <Universe parallax={0.4} />

      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 pt-3 sm:pt-4 mt-3">
        <Link to="/" className="glass rounded-full px-4 py-2 text-sm sm:text-base font-semibold hover:scale-105 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent">← Home</Link>
        <button
          onClick={() => setSettingsOpen(true)}
          className="glass rounded-full px-4 py-2 text-sm sm:text-base font-semibold hover:scale-105 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent inline-flex items-center gap-2"
          aria-label="Settings"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M12 1v6m0 6v6M4.22 4.22l4.24 4.24m3.08 3.08l4.24 4.24M1 12h6m6 0h6M4.22 19.78l4.24-4.24m3.08-3.08l4.24-4.24" /></svg>
          Settings
        </button>
      </header>

      <h1 className="text-center text-3xl sm:text-5xl font-black text-glow mt-4 mb-2">Choose a Level</h1>

      <div className="flex flex-col items-center gap-4 px-4">
        <button
          onClick={() => setMpOpen(true)}
          className="rounded-full px-6 py-2 text-sm sm:text-base font-black text-white hover:scale-105 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent inline-flex items-center"
          style={{
            background: "linear-gradient(135deg,#a855f7 0%,#ec4899 100%)",
            boxShadow: "0 8px 24px rgba(236,72,153,0.45), inset 0 1px 0 rgba(255,255,255,0.35)",
          }}
        >
          Multiplayer
        </button>
      </div>

      <div className="flex-1 flex items-center">
        <div
          ref={scrollerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="cosmic-scroller w-full overflow-x-auto overflow-y-hidden cursor-grab active:cursor-grabbing select-none py-10"
          style={{ scrollBehavior: "smooth" }}
        >
          <div className="flex gap-5 px-10">
            {Array.from({ length: 100 }, (_, i) => i + 1).map((lvl) => {
              const unlocked = highest >= lvl;
              const completed = state?.completed.includes(lvl) ?? false;
              const isCurrent = unlocked && !completed;
              return (
                <button
                  key={lvl}
                  data-level={lvl}
                  onClick={() => launch(lvl, unlocked)}
                  className={`shrink-0 w-24 h-32 sm:w-28 sm:h-36 rounded-2xl glass relative flex flex-col items-center justify-center transition-transform hover:scale-110 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${!unlocked ? "opacity-50 cursor-not-allowed" : ""}`}
                  style={unlocked ? { boxShadow: "0 0 30px oklch(0.72 0.22 320 / 0.45)", border: "1px solid oklch(0.78 0.2 195 / 0.4)" } : {}}
                  aria-label={`Level ${lvl} ${unlocked ? "unlocked" : "locked"}`}
                >
                  <div className="text-3xl font-black text-glow">{lvl}</div>
                  <div className="mt-2 text-xl">
                    {completed ? (
                      <span aria-label="completed">⭐</span>
                    ) : isCurrent ? (
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="white"><path d="M8 5v14l11-7z" /></svg>
                    ) : (
                      <span aria-label="locked">🔒</span>
                    )}
                  </div>
                  {completed && state?.times[lvl] != null && (
                    <div className="text-[10px] text-accent font-semibold mt-1 tabular-nums">{fmtTime(state.times[lvl])}</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground pb-4">Drag horizontally or swipe to explore all 100 levels</p>

      <SettingsPanel open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {mpOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={() => setMpOpen(false)}>
          <div
            className="rounded-3xl p-6 w-full max-w-md pop-in relative overflow-hidden"
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(160deg, oklch(0.25 0.12 290) 0%, oklch(0.18 0.1 320) 100%)",
              border: "1px solid oklch(1 0 0 / 0.15)",
              boxShadow: "0 30px 60px -10px rgba(0,0,0,0.6), 0 0 40px rgba(168,85,247,0.35)",
            }}
          >
            <div className="text-center mb-1 text-4xl">👥</div>
            <h2 className="text-2xl font-black text-center mb-1" style={{ background: "linear-gradient(135deg,#fff,#f0abfc)", WebkitBackgroundClip: "text", color: "transparent" }}>Multiplayer</h2>
            <p className="text-xs text-muted-foreground text-center mb-5">Choose a mode</p>

            <div className="grid grid-cols-2 gap-3">
              <MPOption emoji="🌐" label="vs Human" sub="Online" highlight onClick={() => { setMpOpen(false); navigate({ to: "/online-match" }); }} />
              <MPOption emoji="🎮" label="vs Human" sub="Offline" highlight onClick={() => { setMpOpen(false); navigate({ to: "/multiplayer" }); }} />
              <MPOption emoji="🎲" label="vs Bot" sub="Random" onClick={() => { setMpOpen(false); navigate({ to: "/vs-bot" }); }} />
              <MPOption emoji="🧠" label="vs Bot" sub="Memory" onClick={() => toast("Coming soon ✨")} />
            </div>

            <button onClick={() => setMpOpen(false)} className="glass rounded-full w-full mt-5 py-2 text-sm font-semibold">Close</button>
          </div>
        </div>
      )}
    </main>
  );
}

function MPOption({ emoji, label, sub, highlight, onClick }: { emoji: string; label: string; sub: string; highlight?: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl p-4 text-center transition hover:scale-105 active:scale-95"
      style={highlight ? {
        background: "linear-gradient(135deg,#a855f7,#ec4899)",
        boxShadow: "0 10px 24px rgba(236,72,153,0.45), inset 0 1px 0 rgba(255,255,255,0.35)",
        color: "#fff",
      } : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }}
    >
      <div className="text-3xl mb-1">{emoji}</div>
      <div className="text-sm font-black leading-tight">{label}</div>
      <div className="text-[11px] opacity-80">{sub}</div>
    </button>
  );
}
