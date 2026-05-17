import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Universe } from "@/components/Universe";
import { loadState, saveState, type InventoryItem } from "@/lib/game-state";
import { REWARDS } from "@/lib/rewards";

export const Route = createFileRoute("/rewards")({
  component: Rewards,
  head: () => ({ meta: [{ title: "My Rewards — Cosmic Memory" }] }),
});

function Rewards() {
  const [tab, setTab] = useState<"available" | "history">("available");
  const [items, setItems] = useState<InventoryItem[]>([]);
  const navigate = useNavigate();

  useEffect(() => { setItems(loadState().inventory); }, []);

  const available = items.filter((i) => !i.usedAt);
  const history = items.filter((i) => i.usedAt);

  const useReward = (item: InventoryItem) => {
    const s = loadState();
    const def = REWARDS[item.kind];
    if (def.cosmetic) {
      // Card back
      const cb = item.kind === "card-back-galaxy" ? "galaxy" : item.kind === "card-back-nebula" ? "nebula" : "starlight";
      if (s.cardBack === cb) { alert("Already equipped."); return; }
      s.cardBack = cb;
      const found = s.inventory.find((x) => x.id === item.id);
      if (found) found.usedAt = Date.now();
      saveState(s);
      setItems([...s.inventory]);
      alert(`${def.name} equipped!`);
      return;
    }
    if (item.kind === "level-skipper") {
      // Skip the next level: bump highestUnlocked
      s.highestUnlocked = Math.min(100, s.highestUnlocked + 1);
      const found = s.inventory.find((x) => x.id === item.id);
      if (found) found.usedAt = Date.now();
      saveState(s);
      setItems([...s.inventory]);
      alert("Next level skipped — your map is unlocked further!");
      return;
    }
    // Functional in-game boost: store as pending and open next level
    sessionStorage.setItem("pendingBoost", item.id);
    navigate({ to: "/levels" });
  };

  return (
    <main className="relative min-h-screen px-4 sm:px-6 py-8">
      <Universe parallax={0.3} />
      <div className="max-w-3xl mx-auto">
        <div className="flex justify-between items-center mb-6 mt-2">
          <Link to="/" className="glass rounded-full px-4 py-2 text-sm font-semibold">← Home</Link>
          <h1 className="text-3xl sm:text-4xl font-black text-glow">Rewards</h1>
          <Link to="/levels" className="glass rounded-full px-4 py-2 text-sm font-semibold">Levels →</Link>
        </div>

        <div className="flex gap-2 mb-5 glass rounded-full p-1 w-fit mx-auto">
          {(["available", "history"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              className={`rounded-full px-5 py-2 text-sm font-semibold capitalize transition ${tab === t ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              {t} ({t === "available" ? available.length : history.length})
            </button>
          ))}
        </div>

        {(tab === "available" ? available : history).length === 0 ? (
          <p className="text-center text-muted-foreground glass rounded-2xl py-12">
            {tab === "available" ? "No rewards yet — complete a level to earn one!" : "No rewards used yet."}
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {(tab === "available" ? available : history).map((item) => {
              const def = REWARDS[item.kind];
              return (
                <div key={item.id} className="glass rounded-2xl p-3 flex gap-3 items-center">
                  <img src={def.image} alt={def.name}
                    className="rounded-2xl shrink-0"
                    style={{ width: 80, height: 80, objectFit: "cover", aspectRatio: "1 / 1" }} />
                  <div className="flex-1 min-w-0">
                    <div className="text-xs uppercase tracking-widest text-accent">Lvl {item.level}</div>
                    <div className="font-bold truncate">{def.name}</div>
                    <div className="text-xs text-muted-foreground line-clamp-2">{def.description}</div>
                    {tab === "available" && (
                      <button onClick={() => useReward(item)} className="btn-cosmic !py-1.5 !px-4 text-xs mt-2">Use Now</button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
