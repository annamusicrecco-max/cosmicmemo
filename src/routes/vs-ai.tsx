import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Universe } from "@/components/Universe";
import { Confetti } from "@/components/Confetti";
import { GridSizeSelector, getStoredGrid } from "@/components/GridSizeSelector";
import { getGrid, gridStyle } from "@/lib/grid-sizes";
import { beep, vibrate } from "@/lib/game-state";
import { pickAiMove } from "@/lib/vs-ai.functions";

export const Route = createFileRoute("/vs-ai")({
  component: VsAIPage,
  head: () => ({
    meta: [
      { title: "Play vs AI — Cosmic Memory" },
      { name: "description", content: "Challenge a thinking AI opponent powered by Lovable AI. Full memory and reasoning." },
    ],
  }),
});

const EMOJI_POOL = [
  "🌞","🌙","⭐","🌈","🔥","💧","❄️","🧊","⚡","🌪️",
  "🐱","🐶","🦊","🐻","🐼","🐨","🐯","🦁","🐸","🐵",
  "🚀","🛸","🪐","☄️","🌌","🛰️","👽","🤖","🎈","🎁",
];

type Card = { emoji: string; flipped: boolean; matched: boolean; seen: boolean };
type HistoryEntry = { actor: "human" | "ai"; a: number; b: number; emojiA: string; emojiB: string; match: boolean };

function buildDeck(totalCards = 16): Card[] {
  const pairs = Math.max(2, Math.floor(totalCards / 2));
  const pool = [...EMOJI_POOL];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  const chosen = pool.slice(0, pairs);
  const deck = [...chosen, ...chosen].map((e) => ({ emoji: e, flipped: false, matched: false, seen: false }));
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function VsAIPage() {
  const [phase, setPhase] = useState<"name" | "play">("name");
  const [humanName, setHumanName] = useState("You");
  const [gridLabel, setGridLabel] = useState<string>(() => getStoredGrid());
  const [deck, setDeck] = useState<Card[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [turn, setTurn] = useState<0 | 1>(0);
  const [scores, setScores] = useState<[number, number]>([0, 0]);
  const [locked, setLocked] = useState(false);
  const [confetti, setConfetti] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const [aiReasoning, setAiReasoning] = useState<string>("");
  const history = useRef<HistoryEntry[]>([]);
  const callAi = useServerFn(pickAiMove);

  const name = useMemo(() => humanName.trim() || "You", [humanName]);
  const grid = useMemo(() => getGrid(gridLabel), [gridLabel]);
  const allMatched = deck.length > 0 && deck.every((c) => c.matched);

  const start = () => {
    setDeck(buildDeck(grid.total));
    setSelected([]); setTurn(0); setScores([0, 0]); setLocked(false);
    history.current = [];
    setAiReasoning("");
    setPhase("play");
  };

  const reset = () => {
    setDeck(buildDeck(grid.total));
    setSelected([]); setTurn(0); setScores([0, 0]); setLocked(false);
    setConfetti(false);
    history.current = [];
    setAiReasoning("");
  };

  useEffect(() => {
    if (allMatched && !confetti) {
      beep("win");
      setConfetti(true);
      setTimeout(() => setConfetti(false), 2400);
    }
  }, [allMatched, confetti]);

  // AI turn
  useEffect(() => {
    if (phase !== "play" || allMatched) return;
    if (turn !== 1 || locked) return;

    let cancelled = false;
    setAiThinking(true);

    (async () => {
      const board = deck.map((c, i) => ({
        pos: i,
        emoji: c.matched || c.seen ? c.emoji : null,
        matched: c.matched,
      }));
      try {
        const move = await callAi({
          data: {
            board,
            humanScore: scores[0],
            aiScore: scores[1],
            humanName: name,
            turnHistory: history.current,
          },
        });
        if (cancelled) return;
        // small delay for UX
        await new Promise((r) => setTimeout(r, 350));
        if (cancelled) return;
        setAiReasoning(move.reasoning || "");
        beep("click");
        setDeck((d) => {
          const nd = d.slice();
          if (nd[move.first]) nd[move.first] = { ...nd[move.first], flipped: true };
          if (nd[move.second]) nd[move.second] = { ...nd[move.second], flipped: true };
          return nd;
        });
        setSelected([move.first, move.second]);
        setLocked(true);
      } catch (e) {
        console.error(e);
      } finally {
        if (!cancelled) setAiThinking(false);
      }
    })();

    return () => { cancelled = true; };
  }, [turn, phase, allMatched, locked, deck, scores, name, callAi]);

  // Resolve selection
  useEffect(() => {
    if (selected.length !== 2) return;
    const [a, b] = selected;
    const ca = deck[a]; const cb = deck[b];
    if (!ca || !cb) return;
    const match = ca.emoji === cb.emoji;
    const actor: "human" | "ai" = turn === 0 ? "human" : "ai";

    const t = setTimeout(() => {
      history.current = [
        ...history.current,
        { actor, a, b, emojiA: ca.emoji, emojiB: cb.emoji, match },
      ].slice(-40);

      if (match) {
        beep("match");
        setDeck((d) => {
          const nd = d.slice();
          nd[a] = { ...nd[a], matched: true, seen: true };
          nd[b] = { ...nd[b], matched: true, seen: true };
          return nd;
        });
        setScores((s) => {
          const ns: [number, number] = [s[0], s[1]];
          ns[turn] += 1;
          return ns;
        });
        setSelected([]);
        setLocked(false);
      } else {
        beep("miss"); vibrate(50);
        setDeck((d) => {
          const nd = d.slice();
          nd[a] = { ...nd[a], flipped: false, seen: true };
          nd[b] = { ...nd[b], flipped: false, seen: true };
          return nd;
        });
        setSelected([]);
        setTurn((tt) => (tt === 0 ? 1 : 0));
        setLocked(false);
      }
    }, match ? 380 : 850);

    return () => clearTimeout(t);
  }, [selected, deck, turn]);

  const onHumanFlip = (idx: number) => {
    if (phase !== "play" || allMatched) return;
    if (turn !== 0 || locked) return;
    const c = deck[idx];
    if (!c || c.flipped || c.matched) return;
    if (selected.length >= 2) return;
    beep("click");
    const next = deck.slice();
    next[idx] = { ...c, flipped: true };
    setDeck(next);
    const sel = [...selected, idx];
    setSelected(sel);
    if (sel.length === 2) setLocked(true);
  };

  const winnerText = () => {
    if (scores[0] === scores[1]) return `It's a tie! ${scores[0]} – ${scores[1]}`;
    const humanWins = scores[0] > scores[1];
    return humanWins
      ? `${name} wins! Final score: ${scores[0]} – ${scores[1]}`
      : `AI wins! Final score: ${scores[1]} – ${scores[0]}`;
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Universe parallax={0.2} />
      <Confetti active={confetti} />

      <header className="flex items-center justify-between gap-3 px-4 sm:px-6 pt-3 mt-3">
        <Link to="/levels" className="glass rounded-full px-4 py-2 text-sm font-semibold">← Map</Link>
        <h1 className="text-lg sm:text-2xl font-black text-glow">vs AI</h1>
        <div className="w-16" />
      </header>

      {phase === "name" && (
        <div className="flex items-center justify-center p-6">
          <div className="glass rounded-3xl p-6 w-full max-w-md pop-in">
            <div className="text-center text-5xl mb-2">🧠</div>
            <h2 className="text-xl font-black mb-1 text-center">Challenge the AI</h2>
            <p className="text-xs text-muted-foreground text-center mb-5">Powered by Lovable AI — full memory, real reasoning.</p>

            <label className="text-xs uppercase tracking-widest text-accent">Your name</label>
            <input value={humanName} onChange={(e) => setHumanName(e.target.value.slice(0, 20))}
              className="w-full mt-1 mb-4 px-4 py-3 rounded-xl bg-background/40 border border-white/15 focus:outline-none focus:border-accent text-sm"
              placeholder="You" />

            <GridSizeSelector value={gridLabel} onChange={setGridLabel} className="mb-5" />

            <button onClick={start} className="btn-cosmic w-full !py-3 text-base">Start Game</button>
          </div>
        </div>
      )}

      {phase === "play" && (
        <>
          <div className="flex items-center justify-center gap-2 px-4 mt-3 flex-wrap">
            <PlayerBadge name={name} score={scores[0]} active={turn === 0 && !allMatched} />
            <span className="text-xs text-muted-foreground">vs</span>
            <PlayerBadge name="AI 🧠" score={scores[1]} active={turn === 1 && !allMatched} />
          </div>

          <div className="text-center mt-2 text-sm font-semibold text-accent min-h-[1.25rem]">
            {allMatched ? "Game Over" : turn === 0 ? "Your turn" : (aiThinking ? "AI is thinking…" : "AI's turn")}
          </div>
          {aiReasoning && turn === 1 && !aiThinking && (
            <div className="text-center text-[11px] text-muted-foreground italic px-4 max-w-md mx-auto truncate">
              💭 {aiReasoning}
            </div>
          )}

          <div className="flex items-center justify-center p-4">
            <div className="grid gap-2 sm:gap-3 w-full max-w-[min(92vw,90vh)]" style={gridStyle(grid.cols)}>
              {deck.map((c, i) => (
                <MPCard key={i} card={c} onClick={() => onHumanFlip(i)} disabled={turn !== 0 || locked} />
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
                <div className="text-5xl mb-3">{scores[0] >= scores[1] ? "🏆" : "🧠"}</div>
                <h2 className="text-2xl font-black text-glow mb-3">{winnerText()}</h2>
                <div className="flex gap-2 justify-center flex-wrap">
                  <button className="btn-cosmic !px-5 !py-2.5 text-sm" onClick={() => { reset(); setPhase("name"); }}>Play Again</button>
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

function MPCard({ card, onClick, disabled }: { card: Card; onClick: () => void; disabled?: boolean }) {
  const showFront = card.flipped || card.matched;
  return (
    <button
      onClick={onClick}
      disabled={card.matched || disabled}
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
