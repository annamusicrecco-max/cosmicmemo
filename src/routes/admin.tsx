import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Universe } from "@/components/Universe";
import { loadState, saveState, type Advertiser, type GameState } from "@/lib/game-state";

export const Route = createFileRoute("/admin")({
  component: Admin,
  head: () => ({ meta: [{ title: "Advertiser Dashboard — Cosmic Memory" }] }),
});

function Admin() {
  const [state, setState] = useState<GameState | null>(null);
  const [form, setForm] = useState({ name: "", offer: "", code: "", remaining: 1000 });

  useEffect(() => { setState(loadState()); }, []);

  if (!state) return null;

  const update = (s: GameState) => { saveState(s); setState({ ...s }); };

  const addAdv = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.offer) return;
    state.advertisers.push({ ...form, claims: 0 });
    update(state);
    setForm({ name: "", offer: "", code: "", remaining: 1000 });
  };

  // Mock claims-per-range chart
  const ranges = [
    { label: "1–25", max: 25 }, { label: "26–50", max: 50 },
    { label: "51–75", max: 75 }, { label: "76–100", max: 100 },
  ];
  const claimsByRange = ranges.map((r, i) => {
    const min = i === 0 ? 1 : ranges[i - 1].max + 1;
    return state.claimed.filter((c) => c.level >= min && c.level <= r.max).length;
  });
  const maxCount = Math.max(1, ...claimsByRange);

  return (
    <main className="relative min-h-screen px-6 py-8">
      <Universe parallax={0.2} />
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link to="/" className="glass rounded-full px-4 py-2 text-sm">← Home</Link>
          <h1 className="text-3xl font-black text-glow">Advertiser Dashboard</h1>
          <div className="w-20" />
        </div>

        <section className="glass rounded-2xl p-6 mb-6">
          <h2 className="font-bold mb-4">Reward Pools</h2>
          <div className="grid gap-3">
            {state.advertisers.map((a: Advertiser) => (
              <div key={a.name + a.code} className="grid grid-cols-12 items-center gap-3 p-3 rounded-xl bg-background/30">
                <div className="col-span-3 font-bold">{a.name}</div>
                <div className="col-span-5 text-sm text-muted-foreground">{a.offer} <span className="font-mono opacity-70">({a.code})</span></div>
                <div className="col-span-2 text-sm">Remaining: <b>{a.remaining}</b></div>
                <div className="col-span-2 text-sm">Claims: <b className="text-accent">{a.claims}</b></div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-2xl p-6 mb-6">
          <h2 className="font-bold mb-4">Claims per Level Range</h2>
          <div className="flex items-end gap-4 h-40">
            {ranges.map((r, i) => (
              <div key={r.label} className="flex-1 flex flex-col items-center gap-2">
                <div className="w-full rounded-t-lg transition-all"
                  style={{ height: `${(claimsByRange[i] / maxCount) * 100}%`, minHeight: 6, background: "linear-gradient(180deg,var(--accent),var(--primary))" }} />
                <div className="text-xs text-muted-foreground">{r.label}</div>
                <div className="text-sm font-bold">{claimsByRange[i]}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass rounded-2xl p-6">
          <h2 className="font-bold mb-4">Add Advertiser</h2>
          <form onSubmit={addAdv} className="grid sm:grid-cols-2 gap-3">
            <input className="bg-background/40 rounded-lg px-3 py-2 border border-border" placeholder="Advertiser name"
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="bg-background/40 rounded-lg px-3 py-2 border border-border" placeholder="Offer text"
              value={form.offer} onChange={(e) => setForm({ ...form, offer: e.target.value })} />
            <input className="bg-background/40 rounded-lg px-3 py-2 border border-border" placeholder="Code or link"
              value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            <input type="number" className="bg-background/40 rounded-lg px-3 py-2 border border-border" placeholder="Remaining"
              value={form.remaining} onChange={(e) => setForm({ ...form, remaining: parseInt(e.target.value) || 0 })} />
            <button className="btn-cosmic sm:col-span-2">Add Reward</button>
          </form>
        </section>
      </div>
    </main>
  );
}
