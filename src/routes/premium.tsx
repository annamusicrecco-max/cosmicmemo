import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Universe } from "@/components/Universe";
import { Confetti } from "@/components/Confetti";
import { loadState, saveState } from "@/lib/game-state";

export const Route = createFileRoute("/premium")({
  component: PremiumPage,
  head: () => ({
    meta: [
      { title: "Cosmic Premium — Unlock Everything" },
      { name: "description", content: "Go Premium for no ads, 50 rewards, extra time, exclusive card backs, gift card rewards, and 6 more benefits in Cosmic Memory." },
    ],
  }),
});

type Benefit = { icon: string; title: string; desc: string };

const BENEFITS: Benefit[] = [
  { icon: "🚫", title: "No Ads — Ever",                desc: "Skip every ad between levels and rewards. Pure cosmic focus." },
  { icon: "🎁", title: "50 Bonus Rewards",             desc: "Instantly unlock 50 reward chests across boosters and cosmetics." },
  { icon: "⏱️", title: "+10 Minutes Per Timed Level",  desc: "Extra time stacked onto every timed challenge — breathe easy." },
  { icon: "💳", title: "Monthly Gift Card Reward",     desc: "Premium members are entered into a monthly cosmic gift-card draw." },
  { icon: "♾️", title: "Unlimited Boosters",           desc: "Hint Spark, Reveal Peek, Freeze Timer, Shuffle Swap — never run out." },
  { icon: "🎴", title: "Exclusive Card Backs",         desc: "Three premium 4K designs: Cosmos, Supernova & Aurora." },
  { icon: "🪐", title: "Premium-Only Levels",          desc: "Access an evolving roster of nebula-themed challenge stages." },
  { icon: "📈", title: "Streak Multiplier ×2",         desc: "Double the streak score on every successful match chain." },
  { icon: "☁️", title: "Cloud Save Sync",              desc: "Carry progress across phone, tablet & desktop seamlessly." },
  { icon: "💜", title: "Support Indie Development",    desc: "Fund new levels, art and features — and feel great doing it." },
];

function PremiumPage() {
  const navigate = useNavigate();
  const [premium, setPremium] = useState(false);
  const [confetti, setConfetti] = useState(false);

  useEffect(() => { setPremium(loadState().premium); }, []);

  const buy = () => {
    const s = loadState();
    saveState({ ...s, premium: true });
    setPremium(true);
    setConfetti(true);
    toast("✨ Welcome to Cosmic Premium!");
    setTimeout(() => setConfetti(false), 2400);
  };

  const cancelPremium = () => {
    const s = loadState();
    saveState({ ...s, premium: false });
    setPremium(false);
    toast("Premium turned off");
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Universe parallax={0.2} />
      <Confetti active={confetti} />

      <header className="flex items-center justify-between px-4 sm:px-6 pt-3 mt-3">
        <Link to="/levels" className="glass rounded-full px-4 py-2 text-sm font-semibold">← Back</Link>
        <div className="w-16" />
      </header>

      <div className="max-w-3xl mx-auto px-4 pb-12 pt-2">
        {/* Hero */}
        <section className="text-center pt-4 pb-8 pop-in">
          <div
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[11px] uppercase tracking-[0.25em] font-black mb-4"
            style={{
              background: "linear-gradient(135deg, rgba(168,85,247,0.25), rgba(236,72,153,0.2))",
              border: "1px solid rgba(255,255,255,0.18)",
              color: "white",
            }}
          >
            ✨ Cosmic Premium
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-glow leading-[1.05] mb-3"
            style={{
              background: "linear-gradient(135deg,#fff 0%,#f0abfc 50%,#a78bfa 100%)",
              WebkitBackgroundClip: "text",
              color: "transparent",
            }}>
            Unlock The Cosmos
          </h1>
          <p className="text-sm sm:text-base text-white/80 max-w-xl mx-auto">
            One small purchase. <span className="text-accent font-bold">Ten powerful upgrades.</span> Forever.
          </p>

          {premium ? (
            <div className="mt-7 inline-flex flex-col items-center gap-3">
              <div className="px-5 py-3 rounded-full font-black text-base"
                style={{ background: "linear-gradient(135deg,#22d3ee,#a855f7)", color: "white", boxShadow: "0 10px 30px rgba(168,85,247,0.5)" }}>
                ✓ You're Premium
              </div>
              <button onClick={() => navigate({ to: "/levels" })} className="btn-cosmic !px-7 !py-3">Back to Levels</button>
              <button onClick={cancelPremium} className="text-[11px] text-muted-foreground underline">Turn off premium (testing)</button>
            </div>
          ) : (
            <button onClick={buy}
              className="mt-7 px-8 py-4 rounded-full font-black text-white text-lg"
              style={{
                background: "linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f43f5e 100%)",
                boxShadow: "0 16px 40px rgba(236,72,153,0.55), inset 0 1px 0 rgba(255,255,255,0.45), 0 0 30px rgba(168,85,247,0.6)",
              }}>
              Unlock Premium — $4.99
            </button>
          )}
        </section>

        {/* Benefits */}
        <section className="grid sm:grid-cols-2 gap-3 sm:gap-4">
          {BENEFITS.map((b, i) => (
            <article
              key={b.title}
              className="rounded-2xl p-4 pop-in"
              style={{
                background: "linear-gradient(160deg, rgba(168,85,247,0.18) 0%, rgba(236,72,153,0.10) 100%)",
                border: "1px solid rgba(255,255,255,0.14)",
                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08), 0 12px 28px -16px rgba(0,0,0,0.6)",
                animationDelay: `${i * 40}ms`,
              }}
            >
              <div className="flex items-start gap-3">
                <div className="text-3xl shrink-0 leading-none">{b.icon}</div>
                <div>
                  <h3 className="text-base font-black text-glow mb-0.5">{b.title}</h3>
                  <p className="text-xs text-white/75 leading-relaxed">{b.desc}</p>
                </div>
              </div>
            </article>
          ))}
        </section>

        {/* CTA */}
        {!premium && (
          <section className="text-center mt-10">
            <button onClick={buy}
              className="px-8 py-4 rounded-full font-black text-white text-base w-full sm:w-auto"
              style={{
                background: "linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f43f5e 100%)",
                boxShadow: "0 16px 40px rgba(236,72,153,0.55), inset 0 1px 0 rgba(255,255,255,0.45)",
              }}>
              ✨ Go Premium — $4.99 one-time
            </button>
            <p className="text-[11px] text-muted-foreground mt-3">No subscription. Pay once. Yours forever.</p>
          </section>
        )}
      </div>
    </main>
  );
}
