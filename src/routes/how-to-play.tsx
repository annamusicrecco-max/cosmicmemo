import { createFileRoute, Link } from "@tanstack/react-router";
import { Universe } from "@/components/Universe";
import { SiteFooter } from "./index";

export const Route = createFileRoute("/how-to-play")({
  component: HowToPlay,
  head: () => ({
    meta: [
      { title: "How to Play — Cosmic Memory" },
      { name: "description", content: "Learn how to play Cosmic Memory: rules, controls, timers, boosts, multiplayer modes, and tips to clear all 100 levels." },
      { property: "og:title", content: "How to Play — Cosmic Memory" },
      { property: "og:description", content: "Rules, controls, timers, boosts, and tips for Cosmic Memory." },
    ],
    links: [{ rel: "canonical", href: "https://cosmicmemo.lovable.app/how-to-play" }],
  }),
});

function HowToPlay() {
  return (
    <main className="relative min-h-screen px-4 sm:px-6 py-10 overflow-hidden">
      <Universe />
      <div className="relative z-10 max-w-3xl mx-auto text-left">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
        <h1 className="text-4xl sm:text-5xl font-black mt-4 mb-6 text-glow">How to Play</h1>

        <section className="space-y-6 text-muted-foreground text-base sm:text-lg leading-relaxed">
          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">The basics</h2>
            <p>
              Cosmic Memory is a card matching game. Every level lays out a grid of face-down
              cards containing pairs of matching cosmic symbols. Your goal is to find every pair
              before the timer runs out.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Controls</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>Tap or click a card to flip it face-up.</li>
              <li>Flip a second card to compare.</li>
              <li>Matching pairs stay revealed; mismatched pairs flip back after a moment.</li>
              <li>The level ends when every pair is matched or the timer hits zero.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">The timer</h2>
            <p>
              A shrinking bar at the top of the screen shows the time remaining. On smaller
              grids a second larger timer also appears below the board so it stays visible.
              Complete the level before the bar empties — if it does, you can watch a short
              ad to reclaim time and continue.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Boosts &amp; rewards</h2>
            <p>
              During a level you can open the Boost menu to spend earned rewards:
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li><strong>Reveal Peek</strong> — briefly flips every card face-up.</li>
              <li><strong>Extra Time</strong> — adds seconds to the countdown.</li>
              <li><strong>Level Skipper</strong> — instantly completes the current level.</li>
              <li><strong>Memory Booster</strong> — highlights one matching pair.</li>
            </ul>
            <p className="mt-2">
              Boosts are earned by completing levels and collected in your Rewards inventory.
              Premium members enjoy unlimited use of every boost.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Progression</h2>
            <p>
              There are 100 levels. Grids start small (2×2) and gradually expand up to 6×6,
              with tighter timers and more pairs to remember. Completed levels display your best
              finish time so you can chase personal bests.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Multiplayer modes</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li><strong>Local Pass &amp; Play</strong> — take turns on a single device.</li>
              <li><strong>Online Match</strong> — anonymous matchmaking with a shareable invite link (up to 3 players).</li>
              <li><strong>vs Bot</strong> — a rule-based opponent with a short-term memory of 2 cards.</li>
              <li><strong>vs AI</strong> — a large language model that plays and explains its reasoning.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Tips</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>On your first pass, flip cards you haven't seen before to build a mental map.</li>
              <li>When you flip a card you've seen once, its match location is often already known.</li>
              <li>Save boosts for later levels where timers are tightest.</li>
            </ul>
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
