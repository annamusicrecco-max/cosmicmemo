import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Universe } from "@/components/Universe";
import { loadState, type ClaimedReward } from "@/lib/game-state";

export const Route = createFileRoute("/rewards")({
  component: Rewards,
  head: () => ({ meta: [{ title: "My Rewards — Cosmic Memory" }] }),
});

function Rewards() {
  const [list, setList] = useState<ClaimedReward[]>([]);
  useEffect(() => { setList(loadState().claimed); }, []);

  return (
    <main className="relative min-h-screen px-6 py-8">
      <Universe parallax={0.3} />
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link to="/" className="glass rounded-full px-4 py-2 text-sm">← Home</Link>
          <h1 className="text-3xl font-black text-glow">My Rewards</h1>
          <Link to="/levels" className="glass rounded-full px-4 py-2 text-sm">Levels →</Link>
        </div>

        {list.length === 0 ? (
          <p className="text-center text-muted-foreground glass rounded-2xl py-12">No rewards yet — complete a level to claim your first one!</p>
        ) : (
          <div className="grid gap-3">
            {list.map((r, i) => (
              <div key={i} className="glass rounded-2xl p-4 flex justify-between items-center">
                <div>
                  <div className="text-xs uppercase tracking-widest text-accent">{r.advertiser} · Lvl {r.level}</div>
                  <div className="font-bold">{r.title}</div>
                  {r.code && <div className="font-mono text-xs mt-1 opacity-80">{r.code}</div>}
                </div>
                <div className="text-xs text-muted-foreground">{new Date(r.claimedAt).toLocaleDateString()}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
