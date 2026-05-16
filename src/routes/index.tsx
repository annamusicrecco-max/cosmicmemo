import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Universe } from "@/components/Universe";
import { loadState, vibrate, type GameState } from "@/lib/game-state";

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
    <main className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden">
      <Universe />
      <div className="absolute inset-0 nebula-drift opacity-60 -z-10 pointer-events-none"
        style={{ background: "radial-gradient(circle at 30% 40%, oklch(0.5 0.25 320 / 0.4), transparent 50%), radial-gradient(circle at 70% 60%, oklch(0.5 0.25 200 / 0.35), transparent 55%)" }} />

      <h1 className="text-6xl sm:text-8xl font-black tracking-tight text-glow pop-in">
        Cosmic <span style={{ background: "linear-gradient(135deg,var(--primary),var(--accent))", WebkitBackgroundClip: "text", color: "transparent" }}>Memory</span>
      </h1>
      <p className="mt-6 text-lg sm:text-xl text-muted-foreground max-w-xl">
        Match pairs, unlock 100 levels, earn real rewards.
      </p>

      {state && (
        <div className="mt-8 glass rounded-2xl px-6 py-4 grid grid-cols-3 gap-6 text-sm">
          <Stat label="Current" value={state.highestUnlocked} />
          <Stat label="Completed" value={state.completed.length} />
          <Stat label="Rewards" value={state.claimed.length} />
        </div>
      )}

      <Link
        to="/levels"
        onClick={() => vibrate(10)}
        className="btn-cosmic mt-10 text-lg"
      >
        🚀 Start Journey
      </Link>

      <div className="mt-6 flex gap-3 text-sm">
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
