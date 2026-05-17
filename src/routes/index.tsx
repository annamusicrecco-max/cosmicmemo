import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Universe } from "@/components/Universe";
import { loadState, type GameState } from "@/lib/game-state";

export const Route = createFileRoute("/")({
  component: Welcome,
  head: () => ({
    meta: [
      { title: "Cosmic Memory — Match pairs, earn real rewards" },
      { name: "description", content: "Play 100 levels of cosmic memory matching and unlock real-world rewards from top brands." },
    ],
  }),
});

function Welcome() {
  const [state, setState] = useState<GameState | null>(null);
  useEffect(() => { setState(loadState()); }, []);

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-10 text-center overflow-hidden">
      <Universe />
      <div className="absolute inset-0 nebula-drift opacity-60 -z-10 pointer-events-none"
        style={{ background: "radial-gradient(circle at 30% 40%, oklch(0.5 0.25 320 / 0.4), transparent 50%), radial-gradient(circle at 70% 60%, oklch(0.5 0.25 200 / 0.35), transparent 55%)" }} />

      <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight text-glow pop-in leading-[1.05]">
        Cosmic <span style={{ background: "linear-gradient(135deg,var(--primary),var(--accent))", WebkitBackgroundClip: "text", color: "transparent" }}>Memory</span>
      </h1>
      <p className="mt-5 sm:mt-6 text-base sm:text-xl text-muted-foreground max-w-xl">
        Match pairs, unlock 100 levels, earn real rewards.
      </p>

      {state && (
        <div className="mt-8 glass rounded-2xl px-4 sm:px-6 py-4 grid grid-cols-3 gap-3 sm:gap-6 text-sm w-full max-w-sm">
          <Stat label="Current" value={state.highestUnlocked} />
          <Stat label="Completed" value={state.completed.length} />
          <Stat label="Rewards" value={state.claimed.length} />
        </div>
      )}

      <Link
        to="/levels"
        className="btn-cosmic mt-8 sm:mt-10 text-base sm:text-lg focus:outline-none focus-visible:ring-4 focus-visible:ring-accent"
      >
        🚀 Start Journey
      </Link>

      <div className="mt-6 flex flex-wrap justify-center gap-x-3 gap-y-1 text-sm">
        <Link to="/rewards" className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">My Rewards</Link>
        <span className="text-muted-foreground">·</span>
        <Link to="/admin" className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">Admin</Link>
      </div>
    </main>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="text-muted-foreground uppercase tracking-wider text-xs">{label}</div>
    </div>
  );
}
