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

type BIPEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

function Welcome() {
  const [state, setState] = useState<GameState | null>(null);
  
  const [installEvt, setInstallEvt] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    const s = loadState();
    setState(s);
    startBackgroundMusic(s.muted);

    // detect already-installed PWA
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches
      || (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    setInstalled(!!standalone);

    const onBIP = (e: Event) => { e.preventDefault(); setInstallEvt(e as BIPEvent); };
    const onInstalled = () => { setInstalled(true); setInstallEvt(null); };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const onInstall = async () => {
    if (installed) { alert("✨ Already installed!"); return; }
    if (!installEvt) {
      alert("Your browser doesn't support installation, or the app is already installed. Try Chrome/Edge on desktop, or 'Add to Home Screen' on iOS Safari.");
      return;
    }
    try {
      await installEvt.prompt();
      const choice = await installEvt.userChoice;
      if (choice.outcome === "accepted") setInstalled(true);
      setInstallEvt(null);
    } catch { /* ignore */ }
  };

  return (
    <main className="relative min-h-screen flex flex-col items-center justify-center px-4 sm:px-6 py-10 text-center overflow-hidden">
      <Universe />
      <div className="absolute inset-0 nebula-drift opacity-60 -z-10 pointer-events-none"
        style={{ background: "radial-gradient(circle at 30% 40%, oklch(0.5 0.25 320 / 0.4), transparent 50%), radial-gradient(circle at 70% 60%, oklch(0.5 0.25 200 / 0.35), transparent 55%)" }} />

      {/* Top-left install button */}
      <button
        onClick={onInstall}
        className="absolute top-4 left-4 sm:top-6 sm:left-6 font-semibold text-white hover:scale-105 transition"
        style={{
          background: "linear-gradient(135deg, #a855f7 0%, #ec4899 100%)",
          padding: "8px 16px",
          borderRadius: "20px",
          boxShadow: "0 6px 18px rgba(168,85,247,0.45)",
          fontSize: "14px",
        }}
        aria-label="Install app"
      >
        {installed ? "Installed" : "Install"}
      </button>

      {/* Top-right rewards */}
      <div className="absolute top-4 right-4 sm:top-6 sm:right-6 flex gap-2">
        <Link to="/rewards" className="btn-cosmic !py-2 !px-5 text-sm focus:outline-none focus-visible:ring-4 focus-visible:ring-accent">
          Rewards
        </Link>
      </div>

      <img
        src={logo}
        alt="Cosmic Memory logo"
        width={128}
        height={128}
        className="w-28 h-28 sm:w-32 sm:h-32 mb-4 mt-12 sm:mt-0 drop-shadow-[0_0_30px_oklch(0.72_0.22_320_/_0.6)] pop-in"
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

      {/* Written content for search engines & AdSense reviewers */}
      <section className="relative z-10 mt-16 max-w-3xl text-left space-y-8 text-muted-foreground">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">What is Cosmic Memory?</h2>
          <p className="text-base sm:text-lg leading-relaxed">
            Cosmic Memory is a free browser-based memory card matching game set among the stars.
            Flip pairs of glowing cosmic cards, remember their positions, and clear the board in
            as few moves as possible. It's a modern take on the classic concentration game —
            polished for touch, keyboard, and desktop play.
          </p>
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">How matching works</h2>
          <p className="text-base sm:text-lg leading-relaxed">
            Every level fills a grid with face-down cards arranged in matching pairs. Tap or click
            a card to flip it, then flip a second card. If the two symbols match, they stay face-up
            and count toward your score. If they don't, both cards flip back and you try again —
            using what you've learned about their positions to plan smarter moves.
          </p>
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">100 levels of progression</h2>
          <p className="text-base sm:text-lg leading-relaxed">
            Cosmic Memory features 100 hand-tuned levels that gradually grow the grid, add more
            pairs, and tighten the timer. Early levels ease you in with small boards; later
            levels push short-term memory to its limits with large grids, faster countdowns, and
            themed card backs. Each completed level is saved with your best completion time.
          </p>
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Moves, timers and rewards</h2>
          <p className="text-base sm:text-lg leading-relaxed">
            Every level has a countdown timer shown as a shrinking bar at the top of the screen.
            Match every pair before it empties to clear the level. Completing levels can grant
            in-game rewards such as extra time, reveal peeks, level skippers, and cosmetic card
            backs — all collected in your Rewards inventory.
          </p>
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">Play with friends or against AI</h2>
          <p className="text-base sm:text-lg leading-relaxed">
            Beyond solo play, Cosmic Memory includes local pass-and-play multiplayer, online
            matchmaking with a shareable invite link, a bot opponent with short-term memory, and
            a full AI opponent powered by a large language model that explains its moves.
          </p>
        </div>

        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground mb-3">What makes it original</h2>
          <p className="text-base sm:text-lg leading-relaxed">
            Cosmic Memory blends a calming space aesthetic with a lo-fi soundtrack, real
            progression, a working PWA install, and thoughtful multiplayer — all in a game that
            runs entirely in your browser with no download required.
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-16 mb-6 text-sm text-muted-foreground border-t border-white/10 pt-6 w-full max-w-3xl">
      <nav className="flex flex-wrap justify-center gap-x-6 gap-y-2">
        <Link to="/levels" className="hover:text-foreground">Play</Link>
        <Link to="/how-to-play" className="hover:text-foreground">How to Play</Link>
        <Link to="/about" className="hover:text-foreground">About</Link>
        <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
        <Link to="/contact" className="hover:text-foreground">Contact</Link>
      </nav>
      <p className="text-center mt-4 opacity-70">© {new Date().getFullYear()} Cosmic Memory. All rights reserved.</p>
    </footer>
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
