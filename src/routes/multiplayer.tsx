import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Universe } from "@/components/Universe";
import { Confetti } from "@/components/Confetti";
import { GridSizeSelector, getStoredGrid } from "@/components/GridSizeSelector";
import { getGrid, gridStyle } from "@/lib/grid-sizes";
import { beep, vibrate } from "@/lib/game-state";

export const Route = createFileRoute("/multiplayer")({
  component: MultiplayerPage,
  head: () => ({
    meta: [
      { title: "Pass & Play — Cosmic Memory" },
      { name: "description", content: "Local two-player Cosmic Memory. Take turns and find the most pairs." },
    ],
  }),
});

const EMOJI_POOL = [
  "🌞","🌙","⭐","🌈","🔥","💧","❄️","🧊","⚡","🌪️",
  "🐱","🐶","🦊","🐻","🐼","🐨","🐯","🦁","🐸","🐵",
  "🚀","🛸","🪐","☄️","🌌","🛰️","👽","🤖","🎈","🎁",
];

type Card = { emoji: string; flipped: boolean; matched: boolean };

function buildDeck(totalCards = 16): Card[] {
  const pairs = Math.max(2, Math.floor(totalCards / 2));
  const pool = [...EMOJI_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, pairs);
  const deck = [...chosen, ...chosen].map((e) => ({ emoji: e, flipped: false, matched: false }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function MultiplayerPage() {
  const [phase, setPhase] = useState<"names" | "play">("names");
  const [p1, setP1] = useState("Player 1");
  const [p2, setP2] = useState("Player 2");
  const [gridLabel, setGridLabel] = useState<string>(() => getStoredGrid());
  const [deck, setDeck] = useState<Card[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [turn, setTurn] = useState<0 | 1>(0);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [locked, setLocked] = useState(false);
  const [confetti, setConfetti] = useState(false);

  const names = useMemo(() => [p1.trim() || "Player 1", p2.trim() || "Player 2"] as const, [p1, p2]);
  const grid = useMemo(() => getGrid(gridLabel), [gridLabel]);
  const allMatched = deck.length > 0 && deck.every((c) => c.matched);

  const start = () => {
    setDeck(buildDeck(grid.total));
    setSelected([]); setTurn(0); setScores([0, 0]); setLocked(false);
    setPhase("play");
  };

  const reset = () => {
    setDeck(buildDeck(grid.total));
    setSelected([]); setTurn(0); setScores([0, 0]); setLocked(false);
    setConfetti(false);
  };

  useEffect(() => {
    if (allMatched && !confetti) {
      beep("win");
      setConfetti(true);
      setTimeout(() => setConfetti(false), 2400);
    }
  }, [allMatched, confetti]);

  const onFlip = (idx: number) => {
    if (locked || allMatched) return;
    const c = deck[idx];
    if (!c || c.flipped || c.matched) return;
    if (selected.length >= 2) return;
    beep("click");
    const next = deck.slice();
    next[idx] = { ...c, flipped: true };
    setDeck(next);
    const sel = [...selected, idx];
    setSelected(sel);

    if (sel.length === 2) {
      setLocked(true);
      const [a, b] = sel;
      if (next[a].emoji === next[b].emoji) {
        setTimeout(() => {
          setDeck((d) => {
            const nd = d.slice();
            nd[a] = { ...nd[a], matched: true };
            nd[b] = { ...nd[b], matched: true };
            return nd;
          });
          beep("match");
          setScores((s) => {
            const ns: [number, number] = [s[0], s[1]];
            ns[turn] += 1;
            return ns;
          });
          setSelected([]);
          setLocked(false);
        }, 350);
      } else {
        setTimeout(() => {
          beep("miss"); vibrate(50);
          setDeck((d) => {
            const nd = d.slice();
            nd[a] = { ...nd[a], flipped: false };
            nd[b] = { ...nd[b], flipped: false };
            return nd;
          });
          setSelected([]);
          setTurn((t) => (t === 0 ? 1 : 0));
          setLocked(false);
        }, 700);
      }
    }
  };

  const winnerText = () => {
    if (scores[0] === scores[1]) return `It's a tie! ${scores[0]} – ${scores[1]}`;
    const w = scores[0] > scores[1] ? 0 : 1;
    return `${names[w]} wins! Final score: ${scores[w]} – ${scores[w === 0 ? 1 : 0]}`;
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Universe parallax={0.2} />
      <Confetti active={confetti} />

      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 pt-3 mt-3">
        <Link to="/levels" className="glass rounded-full px-4 py-2 text-sm font-semibold">← Map</Link>
        <h1 className="text-lg sm:text-2xl font-black text-glow">Pass & Play</h1>
        <div className="w-16" />
      </header>

      {phase === "names" && (
        <div className="flex items-center justify-center p-6">
          <div className="glass rounded-3xl p-6 w-full max-w-md pop-in">
            <h2 className="text-xl font-black mb-1 text-center">Enter Player Names</h2>
            <p className="text-xs text-muted-foreground text-center mb-5">Two players. One device. Take turns.</p>

            <label className="text-xs uppercase tracking-widest text-accent">Player 1</label>
            <input value={p1} onChange={(e) => setP1(e.target.value.slice(0, 20))}
              className="w-full mt-1 mb-4 px-4 py-3 rounded-xl bg-background/40 border border-white/15 focus:outline-none focus:border-accent text-sm"
              placeholder="Player 1" />

            <label className="text-xs uppercase tracking-widest text-accent">Player 2</label>
            <input value={p2} onChange={(e) => setP2(e.target.value.slice(0, 20))}
              className="w-full mt-1 mb-5 px-4 py-3 rounded-xl bg-background/40 border border-white/15 focus:outline-none focus:border-accent text-sm"
              placeholder="Player 2" />

            <button onClick={start} className="btn-cosmic w-full !py-3 text-base">Start Game</button>
          </div>
        </div>
      )}

      {phase === "play" && (
        <>
          <div className="flex items-center justify-center gap-2 px-4 mt-3 flex-wrap">
            <PlayerBadge name={names[0]} score={scores[0]} active={turn === 0 && !allMatched} />
            <span className="text-xs text-muted-foreground">vs</span>
            <PlayerBadge name={names[1]} score={scores[1]} active={turn === 1 && !allMatched} />
          </div>

          <div className="text-center mt-2 text-sm font-semibold text-accent">
            {allMatched ? "Game Over" : `${names[turn]}'s Turn`}
          </div>

          <div className="flex items-center justify-center p-4">
            <div className="grid grid-cols-4 gap-2 sm:gap-3 w-full max-w-[min(90vw,90vh)]">
              {deck.map((c, i) => (
                <MPCard key={i} card={c} onClick={() => onFlip(i)} />
              ))}
            </div>
          </div>

          <div className="flex justify-center gap-2 pb-6">
            <button onClick={reset} className="glass rounded-full px-4 py-2 text-sm font-semibold">Reset Game</button>
            <Link to="/levels" className="glass rounded-full px-4 py-2 text-sm font-semibold">Back to Map</Link>
          </div>

          {allMatched && (
            <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm">
              <div className="glass rounded-3xl p-6 max-w-md w-full text-center pop-in">
                <div className="text-5xl mb-3">🏆</div>
                <h2 className="text-2xl font-black text-glow mb-3">{winnerText()}</h2>
                <div className="flex gap-2 justify-center">
                  <button className="btn-cosmic !px-5 !py-2.5 text-sm" onClick={reset}>Play Again</button>
                  <button className="glass rounded-full px-5 py-2.5 text-sm font-semibold" onClick={() => setPhase("names")}>Edit Names</button>
                  <Link to="/levels" className="glass rounded-full px-5 py-2.5 text-sm font-semibold">Back to Map</Link>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function PlayerBadge({ name, score, active }: { name: string; score: number; active: boolean }) {
  return (
    <div
      className={`rounded-full px-4 py-2 text-sm font-bold transition ${active ? "scale-105" : "opacity-60"}`}
      style={active ? {
        background: "linear-gradient(135deg,#a855f7,#ec4899)",
        boxShadow: "0 0 22px rgba(236,72,153,0.55)",
        color: "#fff",
      } : { background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.15)" }}
    >
      {name}: {score}
    </div>
  );
}

function MPCard({ card, onClick }: { card: Card; onClick: () => void }) {
  const showFront = card.flipped || card.matched;
  return (
    <button
      onClick={onClick}
      disabled={card.matched}
      className="relative aspect-square w-full rounded-2xl"
      style={{ perspective: "800px" }}
      aria-label={showFront ? card.emoji : "hidden card"}
    >
      <div className={`absolute inset-0 card-3d rounded-2xl ${showFront ? "flipped" : ""} ${card.matched ? "matched-glow" : ""}`}>
        <div className="card-face absolute inset-0 rounded-2xl overflow-hidden flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, oklch(0.55 0.18 290), oklch(0.45 0.18 240))", border: "1px solid oklch(1 0 0 / 0.18)" }}>
          <span className="text-glow text-2xl">✦</span>
        </div>
        <div className="card-face card-back absolute inset-0 rounded-2xl overflow-hidden flex items-center justify-center text-4xl sm:text-5xl"
          style={{ background: "linear-gradient(135deg, oklch(0.97 0.04 90), oklch(0.92 0.08 320))", color: "oklch(0.15 0 0)", border: "1px solid oklch(1 0 0 / 0.3)" }}>
          <span>{card.emoji}</span>
        </div>
      </div>
    </button>
  );
}
