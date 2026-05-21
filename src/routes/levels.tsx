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
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          Settings
        </button>
      </header>

      <h1 className="text-center text-3xl sm:text-5xl font-black text-glow mt-4 mb-2">Choose a Level</h1>

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
                  className={`shrink-0 w-24 h-32 sm:w-28 sm:h-36 rounded-2xl glass relative flex flex-col items-center justify-center transition-transform hover:scale-110 focus:outline-none focus-visible:ring-4 focus-visible:ring-accent ${unlocked ? "" : "level-locked"}`}
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
    </main>
  );
}
