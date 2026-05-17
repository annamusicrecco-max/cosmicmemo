import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Universe } from "@/components/Universe";
import { Confetti } from "@/components/Confetti";
import {
  beep,
  buildDeck,
  getLevelConfig,
  loadState,
  pickReward,
  saveState,
  vibrate,
  type ClaimedReward,
  type Reward,
} from "@/lib/game-state";

export const Route = createFileRoute("/play/$level")({
  component: Play,
  head: ({ params }) => ({
    meta: [
      { title: `Level ${params.level} — Cosmic Memory` },
      { name: "description", content: `Play level ${params.level} of Cosmic Memory.` },
    ],
  }),
});

type CardState = { emoji: string; flipped: boolean; matched: boolean; mismatch: boolean };

function Play() {
  const { level: levelStr } = Route.useParams();
  const level = Math.max(1, Math.min(100, parseInt(levelStr, 10) || 1));
  const cfg = useMemo(() => getLevelConfig(level), [level]);
  const navigate = useNavigate();

  const [deck, setDeck] = useState<CardState[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [timeLeft, setTimeLeft] = useState(cfg.timeLimit ?? 0);
  const [started, setStarted] = useState(false);
  const [won, setWon] = useState(false);
  const [failed, setFailed] = useState(false);
  const [reward, setReward] = useState<Reward | null>(null);
  const [streak, setStreak] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetBoard = () => {
    setDeck(buildDeck(cfg).map((emoji) => ({ emoji, flipped: false, matched: false, mismatch: false })));
    setSelected([]); setMoves(0); setElapsed(0); setTimeLeft(cfg.timeLimit ?? 0);
    setStarted(false); setWon(false); setFailed(false); setReward(null);
  };

  useEffect(() => {
    const s = loadState();
    setStreak(s.streak);
    resetBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // Timer
  useEffect(() => {
    if (!started || won || failed) return;
    intervalRef.current = setInterval(() => {
      setElapsed((t) => t + 1);
      if (cfg.timeLimit) {
        setTimeLeft((t) => {
          if (t <= 1) { fail("time"); return 0; }
          return t - 1;
        });
      }
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, won, failed]);

  const fail = (_reason: "time" | "moves") => {
    setFailed(true);
    const s = loadState();
    s.streak = 0;
    saveState(s);
    setStreak(0);
    
    beep("miss");
  };

  const onFlip = (idx: number) => {
    if (won || failed) return;
    const c = deck[idx];
    if (!c || c.flipped || c.matched) return;
    if (selected.length >= 2) return;
    beep("click");
    if (!started) setStarted(true);

    const next = deck.slice();
    next[idx] = { ...c, flipped: true };
    setDeck(next);
    const sel = [...selected, idx];
    setSelected(sel);

    if (sel.length === 2) {
      const newMoves = moves + 1;
      setMoves(newMoves);
      const [a, b] = sel;
      if (next[a].emoji === next[b].emoji) {
        // match
        setTimeout(() => {
          setDeck((d) => {
            const nd = d.slice();
            nd[a] = { ...nd[a], matched: true };
            nd[b] = { ...nd[b], matched: true };
            return nd;
          });
          beep("match");
          setSelected([]);
          // win check
          setTimeout(() => checkWin(), 50);
        }, 250);
      } else {
        // mismatch
        setTimeout(() => {
          setDeck((d) => {
            const nd = d.slice();
            nd[a] = { ...nd[a], mismatch: true };
            nd[b] = { ...nd[b], mismatch: true };
            return nd;
          });
          beep("miss"); vibrate(50);
        }, 250);
        setTimeout(() => {
          setDeck((d) => {
            const nd = d.slice();
            nd[a] = { ...nd[a], flipped: false, mismatch: false };
            nd[b] = { ...nd[b], flipped: false, mismatch: false };
            return nd;
          });
          setSelected([]);
        }, 800);
      }
      if (cfg.moveLimit && newMoves >= cfg.moveLimit) {
        setTimeout(() => {
          // only fail if not won
          setDeck((d) => {
            const allMatched = d.every((c) => c.matched);
            if (!allMatched) fail("moves");
            return d;
          });
        }, 900);
      }
    }
  };

  const checkWin = () => {
    setDeck((d) => {
      if (d.every((c) => c.matched)) winLevel();
      return d;
    });
  };

  const winLevel = () => {
    setWon(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    beep("win");
    const s = loadState();
    if (!s.completed.includes(level)) s.completed.push(level);
    s.streak += 1;
    s.highestUnlocked = Math.max(s.highestUnlocked, Math.min(100, level + 1));
    saveState(s);
    setStreak(s.streak);
    setReward(pickReward(level, s.streak));
  };

  const claimReward = () => {
    if (!reward) return;
    const s = loadState();
    const claim: ClaimedReward = { ...reward, level, claimedAt: Date.now() };
    s.claimed.unshift(claim);
    // increment advertiser claims
    const ad = s.advertisers.find((a) => a.name === reward.advertiser);
    if (ad) { ad.claims += 1; ad.remaining = Math.max(0, ad.remaining - 1); }
    saveState(s);
    try {
      if (reward.code) navigator.clipboard?.writeText(reward.code);
    } catch { /* ignore */ }
    
    alert(`Reward claimed! ${reward.code ? `Code "${reward.code}" copied to clipboard. ` : ""}In production, this would be a real code or link.`);
  };

  const next = () => {
    if (level >= 100) {
      alert("🌌 You completed all 100 levels! You are a Cosmic Master.");
      navigate({ to: "/levels" });
      return;
    }
    navigate({ to: "/play/$level", params: { level: String(level + 1) } });
  };

  const minSec = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  const timePct = cfg.timeLimit ? (timeLeft / cfg.timeLimit) * 100 : 0;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Universe parallax={0.2} />
      <Confetti active={won} />

      <header className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap">
        <Link to="/levels" className="glass rounded-full px-4 py-2 text-sm hover:scale-105 transition">← Map</Link>
        <div className="flex gap-3 items-center text-sm">
          <Badge>🎯 L{level}</Badge>
          <Badge>⏱ {cfg.timeLimit ? minSec(timeLeft) : minSec(elapsed)}</Badge>
          <Badge>🎲 {cfg.moveLimit ? `${cfg.moveLimit - moves}` : moves}{cfg.moveLimit ? "" : " moves"}</Badge>
          <Badge>🔥 {streak}</Badge>
        </div>
      </header>

      {cfg.timeLimit && (
        <div className="h-1.5 bg-muted/40 mx-4 rounded-full overflow-hidden">
          <div className="h-full transition-[width] duration-1000 ease-linear"
            style={{ width: `${timePct}%`, background: timePct > 30 ? "linear-gradient(90deg,var(--accent),var(--primary))" : "var(--destructive)" }} />
        </div>
      )}

      <div className="flex items-center justify-center p-4">
        <div
          className="grid gap-2 sm:gap-3 w-full max-w-[min(90vw,90vh)]"
          style={{ gridTemplateColumns: `repeat(${cfg.cols}, minmax(0, 1fr))` }}
        >
          {deck.map((c, i) => (
            <Card key={i} card={c} onClick={() => onFlip(i)} />
          ))}
        </div>
      </div>

      {failed && (
        <Modal>
          <div className="text-6xl mb-3">😢</div>
          <h2 className="text-2xl font-black mb-2">Level Failed</h2>
          <p className="text-muted-foreground mb-6">Your streak was reset. Give it another shot!</p>
          <div className="flex gap-3 justify-center">
            <button className="btn-cosmic" onClick={() => { resetBoard(); }}>Try Again</button>
            <Link to="/levels" className="glass rounded-full px-5 py-3">Back to Map</Link>
          </div>
        </Modal>
      )}

      {won && reward && (
        <Modal>
          <div className="text-5xl mb-2">🎉</div>
          <h2 className="text-2xl font-black text-glow">Level {level} Complete!</h2>
          <p className="text-sm text-muted-foreground mt-1">Streak 🔥 {streak} · {moves} moves · {minSec(elapsed)}</p>

          <div className="mt-5 p-5 rounded-2xl border border-border/60"
            style={{ background: "linear-gradient(135deg, oklch(0.25 0.12 320 / 0.6), oklch(0.25 0.12 200 / 0.6))" }}>
            <div className="text-xs uppercase tracking-widest text-accent">{reward.advertiser}</div>
            <div className="text-lg font-bold mt-1">{reward.title}</div>
            {reward.code && <div className="mt-2 font-mono text-sm bg-background/40 rounded px-2 py-1 inline-block">{reward.code}</div>}
            <button onClick={claimReward} className="btn-cosmic mt-4 w-full">🎁 Claim Reward</button>
          </div>

          <div className="flex gap-3 mt-5 justify-center">
            <button className="btn-cosmic" onClick={() => { next(); }}>Next Level →</button>
            <Link to="/levels" className="glass rounded-full px-5 py-3">Back to Map</Link>
          </div>
        </Modal>
      )}
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="glass rounded-full px-3 py-1.5 text-xs sm:text-sm font-semibold">{children}</span>;
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm">
      <div className="glass rounded-3xl p-8 max-w-md w-full text-center pop-in">{children}</div>
    </div>
  );
}

function Card({ card, onClick }: { card: CardState; onClick: () => void }) {
  const showFront = card.flipped || card.matched;
  return (
    <button
      onClick={onClick}
      disabled={card.matched}
      className="relative aspect-square w-full rounded-2xl"
      style={{ perspective: "800px" }}
      aria-label={showFront ? card.emoji : "hidden card"}
    >
      <div
        className={`absolute inset-0 card-3d rounded-2xl ${showFront ? "flipped" : ""} ${card.matched ? "matched-glow" : ""} ${card.mismatch ? "mismatch-flash" : ""}`}
      >
        <div className="card-face absolute inset-0 rounded-2xl overflow-hidden flex items-center justify-center text-4xl sm:text-5xl"
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
