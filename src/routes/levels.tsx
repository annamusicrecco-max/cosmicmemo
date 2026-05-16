import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Universe } from "@/components/Universe";
import { loadState, vibrate, type GameState } from "@/lib/game-state";

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
  const navigate = useNavigate();
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const drag = useRef({ active: false, startX: 0, scrollLeft: 0, moved: 0 });

  useEffect(() => { setState(loadState()); }, []);

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
    try { scrollerRef.current?.releasePointerCapture(e.pointerId); } catch {}
  };

  const launch = (lvl: number, unlocked: boolean) => {
    if (drag.current.moved > 6) return; // was a drag
    if (!unlocked) { vibrate(50); return; }
    vibrate(10);
    navigate({ to: "/play/$level", params: { level: String(lvl) } });
  };

  return (
    <main className="relative min-h-screen flex flex-col overflow-hidden">
      <Universe parallax={0.4} />

      <header className="flex items-center justify-between px-6 py-4">
        <Link to="/" className="glass rounded-full px-4 py-2 text-sm hover:scale-105 transition">← Home</Link>
        <h1 className="text-2xl font-black text-glow">Choose a Level</h1>
        <Link to="/rewards" className="glass rounded-full px-4 py-2 text-sm hover:scale-105 transition">🎁 Rewards</Link>
      </header>

      <div className="flex-1 flex items-center">
        <div
          ref={scrollerRef}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          className="w-full overflow-x-auto overflow-y-hidden cursor-grab active:cursor-grabbing select-none py-10"
          style={{ scrollBehavior: "smooth", scrollbarWidth: "thin" }}
        >
          <div className="flex gap-5 px-10">
            {Array.from({ length: 100 }, (_, i) => i + 1).map((lvl) => {
              const unlocked = (state?.highestUnlocked ?? 1) >= lvl;
              const completed = state?.completed.includes(lvl) ?? false;
              return (
                <button
                  key={lvl}
                  onClick={() => launch(lvl, unlocked)}
                  className={`shrink-0 w-28 h-36 rounded-2xl glass relative flex flex-col items-center justify-center transition-transform hover:scale-110 ${unlocked ? "" : "level-locked"}`}
                  style={unlocked ? { boxShadow: "0 0 30px oklch(0.72 0.22 320 / 0.45)", border: "1px solid oklch(0.78 0.2 195 / 0.4)" } : {}}
                  aria-label={`Level ${lvl} ${unlocked ? "unlocked" : "locked"}`}
                >
                  <div className="text-3xl font-black text-glow">{lvl}</div>
                  <div className="mt-2 text-xl">
                    {completed ? "⭐" : unlocked ? "✨" : "🔒"}
                  </div>
                  {lvl % 10 === 0 && unlocked && (
                    <div className="absolute -top-2 -right-2 bg-flame text-background text-[10px] rounded-full px-2 py-0.5 font-bold">BOSS</div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-center text-xs text-muted-foreground pb-4">Drag horizontally or swipe to explore all 100 levels</p>
    </main>
  );
}
