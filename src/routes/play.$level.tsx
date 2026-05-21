import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { Universe } from "@/components/Universe";
import { Confetti } from "@/components/Confetti";
import { AdModal } from "@/components/AdModal";
import {
  beep,
  buildDeck,
  getLevelConfig,
  loadState,
  saveState,
  vibrate,
  type InventoryItem,
  type CardBack,
} from "@/lib/game-state";
import { REWARDS, pickRandomReward, type RewardKind } from "@/lib/rewards";
import { setMuted as setAudioMuted } from "@/lib/audio";

export const Route = createFileRoute("/play/$level")({
  component: Play,
  head: ({ params }) => ({
    meta: [
      { title: `Level ${params.level} — Cosmic Memory` },
      { name: "description", content: `Play level ${params.level} of Cosmic Memory.` },
    ],
  }),
});

type CardState = { emoji: string; flipped: boolean; matched: boolean; mismatch: boolean; hint?: boolean };

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
  const [confettiVisible, setConfettiVisible] = useState(false);
  const [reward, setReward] = useState<RewardKind | null>(null);
  const [streak, setStreak] = useState(0);
  const [cardBack, setCardBackUI] = useState<CardBack>("default");
  const [premium, setPremium] = useState(false);
  const [showGoPremium, setShowGoPremium] = useState(false);

  // Boost menu
  const [showBoostMenu, setShowBoostMenu] = useState(false);
  const [boostUsedThisLevel, setBoostUsedThisLevel] = useState(false);
  const [doubleStreak, setDoubleStreak] = useState(false);
  const [boostFeedback, setBoostFeedback] = useState<string | null>(null);

  // Per-level once flags
  const [extraTimeUsed, setExtraTimeUsed] = useState(false);
  const [freezeUsed, setFreezeUsed] = useState(false);
  const [peekUsed, setPeekUsed] = useState(false);
  const [shuffleUsed, setShuffleUsed] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [adBonus30Used, setAdBonus30Used] = useState(false);
  const [adRevealUsed, setAdRevealUsed] = useState(false);
  const [frozenUntil, setFrozenUntil] = useState(0);
  const [peeking, setPeeking] = useState(false);

  // Mute toggle (in-game)
  const [muted, setMutedState] = useState(false);

  // Ad modal state
  const [ad, setAd] = useState<null | "spin" | "plus30" | "reveal" | "reclaim">(null);

  // Failed snapshot for "reclaim time"
  const failedSnapshot = useRef<{ deck: CardState[]; timeLeft: number; moves: number; elapsed: number } | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetBoard = () => {
    setDeck(buildDeck(cfg).map((emoji) => ({ emoji, flipped: false, matched: false, mismatch: false })));
    setSelected([]); setMoves(0); setElapsed(0); setTimeLeft(cfg.timeLimit ?? 0);
    setStarted(false); setWon(false); setFailed(false); setReward(null);
    setExtraTimeUsed(false); setFreezeUsed(false); setPeekUsed(false);
    setShuffleUsed(false); setHintUsed(false); setAdBonus30Used(false); setAdRevealUsed(false);
    setConfettiVisible(false);
    setBoostUsedThisLevel(false); setDoubleStreak(false);
  };

  useEffect(() => {
    const s = loadState();
    setStreak(s.streak);
    setCardBackUI(s.cardBack);
    setPremium(s.premium);
    setMutedState(s.muted);

    // Apply pending boost from Rewards page immediately
    const pendingId = typeof sessionStorage !== "undefined" ? sessionStorage.getItem("pendingBoost") : null;
    const pending = pendingId ? s.inventory.find((i) => i.id === pendingId && !i.usedAt) : null;
    if (pending) {
      sessionStorage.removeItem("pendingBoost");
      // Consume immediately and apply effect after board reset
      setTimeout(() => applyBoost(pending), 50);
    }
    resetBoard();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [level]);

  // Timer
  useEffect(() => {
    if (!started || won || failed) return;
    intervalRef.current = setInterval(() => {
      if (Date.now() < frozenUntil) return;
      setElapsed((t) => t + 1);
      if (cfg.timeLimit) {
        setTimeLeft((t) => {
          if (t <= 1) { fail(); return 0; }
          return t - 1;
        });
      }
    }, 1000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, won, failed, frozenUntil]);

  const fail = () => {
    failedSnapshot.current = { deck, timeLeft, moves, elapsed };
    setFailed(true);
    const s = loadState(); s.streak = 0; saveState(s); setStreak(0);
    beep("miss");
  };

  const onFlip = (idx: number) => {
    if (won || failed || peeking) return;
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
      const newMoves = moves + 1; setMoves(newMoves);
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
          setSelected([]);
          setTimeout(() => checkWin(), 50);
        }, 250);
      } else {
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
          setDeck((d) => { if (!d.every((c) => c.matched)) fail(); return d; });
        }, 900);
      }
    }
  };

  const checkWin = () => {
    setDeck((d) => { if (d.every((c) => c.matched)) winLevel(); return d; });
  };

  const winLevel = () => {
    setWon(true);
    if (intervalRef.current) clearInterval(intervalRef.current);
    beep("win");
    setConfettiVisible(true);
    setTimeout(() => setConfettiVisible(false), 2200);

    const s = loadState();
    if (!s.completed.includes(level)) s.completed.push(level);
    s.streak += doubleStreak ? 2 : 1;
    s.highestUnlocked = Math.max(s.highestUnlocked, Math.min(100, level + 1));

    // Save completion time (use best/fastest if replayed)
    const prev = s.times[level];
    s.times[level] = prev ? Math.min(prev, elapsed) : elapsed;

    // 50% chance to earn a reward
    if (Math.random() < 0.5) {
      const kind = pickRandomReward(level);
      const item: InventoryItem = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, kind, level, earnedAt: Date.now() };
      s.inventory.unshift(item);
      saveState(s);
      setStreak(s.streak);
      setReward(kind);
    } else {
      saveState(s);
      setStreak(s.streak);
      setReward(null);
    }
  };

  const goNext = () => {
    if (level >= 100) { alert("🌌 You completed all 100 levels! You are a Cosmic Master."); navigate({ to: "/levels" }); return; }
    navigate({ to: "/play/$level", params: { level: String(level + 1) } });
  };

  // ---- Boost / power triggers ----
  const useExtraTime = () => { if (extraTimeUsed || !cfg.timeLimit) return; setExtraTimeUsed(true); setTimeLeft((t) => t + 15); };
  const useFreeze = () => { if (freezeUsed) return; setFreezeUsed(true); setFrozenUntil(Date.now() + 5000); setTimeout(() => setFrozenUntil(0), 5050); };
  const usePeek = () => {
    if (peekUsed) return;
    setPeekUsed(true); setPeeking(true);
    setDeck((d) => d.map((c) => ({ ...c, flipped: true })));
    setTimeout(() => { setDeck((d) => d.map((c) => c.matched ? c : ({ ...c, flipped: false }))); setPeeking(false); }, 1500);
  };
  const useShuffle = () => {
    if (shuffleUsed) return;
    setShuffleUsed(true);
    setDeck((d) => {
      const unmatchedIdx = d.map((c, i) => c.matched ? -1 : i).filter((i) => i >= 0);
      const emojis = unmatchedIdx.map((i) => d[i].emoji);
      for (let i = emojis.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [emojis[i], emojis[j]] = [emojis[j], emojis[i]]; }
      const nd = d.slice();
      unmatchedIdx.forEach((idx, k) => { nd[idx] = { ...nd[idx], emoji: emojis[k], flipped: false, mismatch: false }; });
      setSelected([]);
      return nd;
    });
  };
  const useHint = () => {
    if (hintUsed) return;
    setHintUsed(true);
    const remaining: Record<string, number[]> = {};
    deck.forEach((c, i) => { if (!c.matched) (remaining[c.emoji] ||= []).push(i); });
    const pair = Object.values(remaining).find((v) => v.length >= 2);
    if (!pair) return;
    setDeck((d) => { const nd = d.slice(); nd[pair[0]] = { ...nd[pair[0]], hint: true }; nd[pair[1]] = { ...nd[pair[1]], hint: true }; return nd; });
    setTimeout(() => setDeck((d) => d.map((c) => ({ ...c, hint: false }))), 1000);
  };

  // Apply a boost. Free users consume an inventory item (one per level).
  // Premium users have unlimited usage and no per-level lock.
  const applyBoost = (item: InventoryItem) => {
    if (!premium && boostUsedThisLevel) { setBoostFeedback("Only one boost per level"); setTimeout(() => setBoostFeedback(null), 1800); return; }
    const def = REWARDS[item.kind];
    const fx = def.boost;
    if (!fx) return;
    if (fx === "extra-time") useExtraTime();
    else if (fx === "freeze-timer") useFreeze();
    else if (fx === "reveal-peek") usePeek();
    else if (fx === "shuffle-swap") useShuffle();
    else if (fx === "hint-spark") useHint();
    else if (fx === "memory-booster") setDoubleStreak(true);
    // Free users: consume the inventory item. Premium: keep inventory intact (unlimited).
    if (!premium) {
      const s = loadState();
      const found = s.inventory.find((x) => x.id === item.id);
      if (found && !found.usedAt) { found.usedAt = Date.now(); saveState(s); }
      setBoostUsedThisLevel(true);
    }
    setShowBoostMenu(false);
    setBoostFeedback(`✨ ${def.name} activated`);
    setTimeout(() => setBoostFeedback(null), 1800);
  };

  // Premium per-boost reusability flags reset each apply by zeroing the per-level once flags
  const applyPremiumBoost = (kind: RewardKind) => {
    // Reset the per-level once flags so premium can re-use freely
    setExtraTimeUsed(false); setFreezeUsed(false); setPeekUsed(false);
    setShuffleUsed(false); setHintUsed(false);
    applyBoost({ id: `premium-${Date.now()}`, kind, level, earnedAt: Date.now() });
  };

  const toggleMute = () => {
    const next = !muted;
    setMutedState(next);
    setAudioMuted(next);
    const s = loadState(); s.muted = next; saveState(s);
  };

  // ---- Ad-gated actions ----
  const handleAdAction = (kind: "spin" | "plus30" | "reveal" | "reclaim") => {
    if (premium) { runAdReward(kind); return; }
    setAd(kind);
  };
  const runAdReward = (kind: "spin" | "plus30" | "reveal" | "reclaim") => {
    if (kind === "plus30") {
      if (adBonus30Used) return;
      setAdBonus30Used(true); setTimeLeft((t) => t + 30);
    } else if (kind === "reveal") {
      if (adRevealUsed) return;
      setAdRevealUsed(true); setPeeking(true);
      setDeck((d) => d.map((c) => ({ ...c, flipped: true })));
      setTimeout(() => { setDeck((d) => d.map((c) => c.matched ? c : ({ ...c, flipped: false }))); setPeeking(false); }, 2000);
    } else if (kind === "reclaim") {
      const snap = failedSnapshot.current;
      if (snap) {
        setDeck(snap.deck.map((c) => ({ ...c, mismatch: false })));
        setTimeLeft(snap.timeLeft); setMoves(snap.moves); setElapsed(snap.elapsed);
        setFailed(false); setStarted(true);
      }
    } else if (kind === "spin") {
      const bonusKind = pickRandomReward(level);
      const s = loadState();
      s.inventory.unshift({ id: `${Date.now()}-spin`, kind: bonusKind, level, earnedAt: Date.now() });
      saveState(s);
      alert(`🎡 Bonus wheel landed on: ${REWARDS[bonusKind].name}!`);
    }
  };

  const minSec = (n: number) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
  const timePct = cfg.timeLimit ? (timeLeft / cfg.timeLimit) * 100 : 0;

  // Card back styling
  const cardBackStyle = cardBack === "default"
    ? { background: "linear-gradient(135deg, oklch(0.97 0.04 90), oklch(0.92 0.08 320))", color: "oklch(0.15 0 0)" }
    : { backgroundImage: `url(/images/rewards/card-back-${cardBack}.jpg)`, backgroundSize: "cover", backgroundPosition: "center", color: "#fff", textShadow: "0 2px 8px rgba(0,0,0,0.7)" };

  // Available in-game boosts (functional only, exclude level-skipper)
  const availableBoosts = (typeof window !== "undefined" ? loadState().inventory : []).filter((i) => !i.usedAt && REWARDS[i.kind].boost);
  const premiumBoostKinds: RewardKind[] = ["extra-time", "freeze-timer", "reveal-peek", "shuffle-swap", "hint-spark", "memory-booster"];

  const onBoostButtonClick = () => {
    if (premium) { setShowBoostMenu(true); return; }
    if (availableBoosts.length === 0) { setShowGoPremium(true); return; }
    setShowBoostMenu(true);
  };
  const onConfirmGoPremium = () => {
    const s = loadState(); s.premium = true; saveState(s); setPremium(true); setShowGoPremium(false);
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Universe parallax={0.2} />
      <Confetti active={confettiVisible} />

      <header className="flex items-center justify-between gap-3 px-4 py-3 flex-wrap mt-2">
        <Link to="/levels" className="glass rounded-full px-4 py-2 text-sm font-semibold hover:scale-105 transition">← Map</Link>
        <div className="flex gap-2 items-center text-sm flex-wrap justify-end">
          <Badge>L{level}</Badge>
          <Badge>⏱ {cfg.timeLimit ? minSec(timeLeft) : minSec(elapsed)}</Badge>
          <Badge>{cfg.moveLimit ? `${cfg.moveLimit - moves} left` : `${moves} moves`}</Badge>
          <Badge>🔥 {streak}{doubleStreak ? " ×2" : ""}</Badge>
          <button onClick={toggleMute} aria-label={muted ? "Unmute music" : "Mute music"}
            className="glass rounded-full w-9 h-9 flex items-center justify-center text-base hover:scale-110 transition">
            {muted ? "🔇" : "🔊"}
          </button>
        </div>
      </header>

      {cfg.timeLimit && (
        <div className="h-3 bg-muted/40 mx-4 rounded-full overflow-hidden shadow-inner">
          <div className="h-full transition-[width] duration-1000 ease-linear"
            style={{
              width: `${timePct}%`,
              background: timePct > 30
                ? "linear-gradient(90deg, oklch(0.78 0.2 60), oklch(0.7 0.25 30))"
                : "linear-gradient(90deg, oklch(0.7 0.25 30), oklch(0.6 0.28 15))",
              boxShadow: timePct <= 30 ? "0 0 12px oklch(0.65 0.25 25 / 0.8)" : "none",
            }} />
        </div>
      )}

      {/* In-game action bar */}
      <div className="flex flex-wrap gap-2 justify-center px-4 mt-3">
        <button
          onClick={onBoostButtonClick}
          disabled={!premium && boostUsedThisLevel}
          className="btn-cosmic !py-2 !px-4 text-xs disabled:opacity-50 inline-flex items-center gap-1"
        >
          ⚡ Boost {premium ? "(∞)" : (availableBoosts.length > 0 && !boostUsedThisLevel ? `(${availableBoosts.length})` : "")}
        </button>
        {cfg.timeLimit && (
          <button onClick={() => handleAdAction("plus30")} disabled={adBonus30Used} className="glass rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40">+30 sec{premium ? "" : " (Watch Ad)"}</button>
        )}
        <button onClick={() => handleAdAction("reveal")} disabled={adRevealUsed} className="glass rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-40">Reveal{premium ? "" : " (Watch Ad)"}</button>
      </div>

      {/* Centered boost modal */}
      {showBoostMenu && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setShowBoostMenu(false)}
        >
          <div
            className="glass rounded-3xl p-5 w-[90%] max-w-[400px] max-h-[80vh] overflow-y-auto pop-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-black text-glow">Your Boosts</h3>
              <button onClick={() => setShowBoostMenu(false)} className="glass rounded-full px-3 py-1 text-xs">Close</button>
            </div>
            {availableBoosts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-6 text-center">No boosts available.<br/>Complete levels to earn rewards.</p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {availableBoosts.map((b) => {
                  const def = REWARDS[b.kind];
                  return (
                    <button key={b.id} onClick={() => applyBoost(b)}
                      className="glass rounded-xl p-2 text-left hover:scale-105 transition">
                      <img src={def.image} alt={def.name} className="rounded-lg w-full mb-1" style={{ aspectRatio: "1/1", objectFit: "cover" }} />
                      <div className="text-[11px] font-bold leading-tight">{def.name}</div>
                    </button>
                  );
                })}
              </div>
            )}
            <p className="text-[11px] text-muted-foreground mt-3 text-center">One boost per level</p>
          </div>
        </div>
      )}

      {boostFeedback && (
        <div className="text-center text-xs text-accent mt-2 pop-in">{boostFeedback}</div>
      )}

      <div className="flex items-center justify-center p-4">
        <div
          className="grid gap-2 sm:gap-3 w-full max-w-[min(90vw,90vh)]"
          style={{ gridTemplateColumns: `repeat(${cfg.cols}, minmax(0, 1fr))` }}
        >
          {deck.map((c, i) => (
            <Card key={i} card={c} onClick={() => onFlip(i)} backStyle={cardBackStyle} />
          ))}
        </div>
      </div>

      {/* Bottom big timer — only when 12 cards or fewer */}
      {cfg.timeLimit && (cfg.rows * cfg.cols) <= 12 && !won && !failed && (
        <div className="text-center pb-6 pop-in">
          <div
            className="font-black tabular-nums"
            style={{
              fontSize: "clamp(24px, 7vw, 32px)",
              color: timePct <= 30 ? "oklch(0.7 0.25 25)" : "oklch(0.95 0.05 90)",
              textShadow: timePct <= 30 ? "0 0 18px oklch(0.65 0.25 25 / 0.8)" : "0 0 12px oklch(1 0 0 / 0.3)",
              letterSpacing: "0.05em",
            }}
          >
            {minSec(timeLeft)}
          </div>
        </div>
      )}


      {/* Level Failed */}
      {failed && (
        <Modal>
          <div className="text-5xl mb-3">😢</div>
          <h2 className="text-2xl font-black mb-2">Level Failed</h2>
          <p className="text-muted-foreground mb-5 text-sm">Your streak was reset.</p>
          <button onClick={() => handleAdAction("reclaim")} className="btn-cosmic w-full mb-3 !py-2.5">
            {premium ? "Reclaim Time" : "Watch Ad to Reclaim Time"}
          </button>
          <div className="flex gap-2 justify-center">
            <button className="glass rounded-full px-4 py-2 text-sm font-semibold" onClick={() => resetBoard()}>Try Again</button>
            <Link to="/levels" className="glass rounded-full px-4 py-2 text-sm font-semibold">Back</Link>
          </div>
        </Modal>
      )}

      {/* Level Complete */}
      {won && !confettiVisible && (
        <Modal>
          <h2 className="text-2xl font-black text-glow mb-1">Level {level} Complete</h2>
          <p className="text-xs text-muted-foreground mb-4">Streak 🔥 {streak} · {moves} moves · {minSec(elapsed)}</p>

          {reward ? (
            <div className="mb-4">
              <img src={REWARDS[reward].image} alt={REWARDS[reward].name}
                className="mx-auto rounded-2xl"
                style={{ width: "80%", aspectRatio: "1/1", objectFit: "cover" }} />
              <div className="text-xs uppercase tracking-widest text-accent mt-3">Reward earned</div>
              <div className="text-lg font-bold">{REWARDS[reward].name}</div>
              <div className="text-xs text-muted-foreground">{REWARDS[reward].description}</div>
            </div>
          ) : (
            <div className="mb-4 py-4">
              <div className="text-5xl mb-2">🌠</div>
              <div className="text-base font-bold">No reward this time</div>
              <div className="text-xs text-muted-foreground mt-1">Keep playing — the cosmos rewards persistence.</div>
            </div>
          )}

          <button onClick={() => handleAdAction("spin")} className="glass rounded-full w-full py-2 text-sm font-semibold mb-3">
            🎡 {premium ? "Spin Bonus Wheel" : "Watch Ad to Spin"}
          </button>

          <div className="flex gap-2 justify-center">
            <button className="btn-cosmic !px-5 !py-2.5 text-sm" onClick={goNext}>Next Level</button>
            <Link to="/levels" className="glass rounded-full px-5 py-2.5 text-sm font-semibold">Back</Link>
          </div>
        </Modal>
      )}

      <AdModal open={ad !== null} label={ad === "reclaim" ? "Restoring your level…" : "Your reward will unlock shortly"}
        onDone={() => { const k = ad; setAd(null); if (k) runAdReward(k); }} />
    </main>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return <span className="glass rounded-full px-3 py-1.5 text-xs sm:text-sm font-semibold">{children}</span>;
}

function Modal({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-background/70 backdrop-blur-sm">
      <div className="glass rounded-3xl p-6 max-w-md w-full text-center pop-in">{children}</div>
    </div>
  );
}

function Card({ card, onClick, backStyle }: { card: CardState; onClick: () => void; backStyle: React.CSSProperties }) {
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
        className={`absolute inset-0 card-3d rounded-2xl ${showFront ? "flipped" : ""} ${card.matched ? "matched-glow" : ""} ${card.mismatch ? "mismatch-flash" : ""} ${card.hint ? "hint-glow" : ""}`}
      >
        <div className="card-face absolute inset-0 rounded-2xl overflow-hidden flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, oklch(0.55 0.18 290), oklch(0.45 0.18 240))", border: "1px solid oklch(1 0 0 / 0.18)" }}>
          <span className="text-glow text-2xl">✦</span>
        </div>
        <div className="card-face card-back absolute inset-0 rounded-2xl overflow-hidden flex items-center justify-center text-4xl sm:text-5xl"
          style={{ ...backStyle, border: "1px solid oklch(1 0 0 / 0.3)" }}>
          <span>{card.emoji}</span>
        </div>
      </div>
    </button>
  );
}
