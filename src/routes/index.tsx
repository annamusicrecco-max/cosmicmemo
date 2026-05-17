import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Universe } from "@/components/Universe";
import { loadState, type GameState } from "@/lib/game-state";
import { startBackgroundMusic } from "@/lib/audio";
import logo from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  component: Welcome,
  head: () => ({
    meta: [
      { title: "Cosmic Memory — Train your memory, restore your attention" },
      { name: "description", content: "Train your memory. Restore your attention. One match at a time. 100 levels of cosmic memory matching." },
    ],
  }),
});

function Welcome() {
  const [state, setState] = useState<GameState | null>(null);
  useEffect(() => {
    const s = loadState();
    setState(s);
    startBackgroundMusic(s.muted);
  }, []);

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-10 text-center overflow-hidden">
      <Universe />
      <div className="absolute inset-0 nebula-drift opacity-60 -z-10 pointer-events-none"
        style={{ background: "radial-gradient(circle at 30% 40%, oklch(0.5 0.25 320 / 0.4), transparent 50%), radial-gradient(circle at 70% 60%, oklch(0.5 0.25 200 / 0.35), transparent 55%)" }} />

      {/* Rewards button — top right */}
      <Link
        to="/rewards"
        className="absolute top-4 right-4 sm:top-6 sm:right-6 btn-cosmic !py-2 !px-5 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-accent"
      >
        Rewards
      </Link>

      <img
        src={logo}
        alt="Cosmic Memory logo"
        width={128}
        height={128}
        className="w-28 h-28 sm:w-32 sm:h-32 mb-4 drop-shadow-[0_0_30px_oklch(0.72_0.22_320_/_0.6)] pop-in"
        style={{ borderRadius: "25%" }}
      />
      <h1 className="text-5xl sm:text-7xl md:text-8xl font-black tracking-tight text-glow pop-in leading-[1.05]">
        Cosmic <span style={{ background: "linear-gradient(135deg,var(--primary),var(--accent))", WebkitBackgroundClip: "text", color: "transparent" }}>Memory</span>
      </h1>
      <p className="mt-5 sm:mt-6 text-base sm:text-xl text-muted-foreground max-w-xl">
        Train your memory. Restore your attention. One match at a time.
      </p>

      {state && (
        <div className="mt-8 glass rounded-2xl px-4 sm:px-6 py-4 grid grid-cols-3 gap-3 sm:gap-6 text-sm w-full max-w-sm">
          <Stat label="Current" value={state.highestUnlocked} />
          <Stat label="Completed" value={state.completed.length} />
          <Stat label="Rewards" value={state.inventory.length} />
        </div>
      )}

      <Link
        to="/levels"
        className="btn-cosmic mt-8 sm:mt-10 text-base sm:text-lg !text-white focus:outline-none focus-visible:ring-4 focus-visible:ring-accent"
        style={{ color: "#fff" }}
      >
        Start Journey
      </Link>
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
