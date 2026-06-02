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
      { title: "Go Premium — Cosmic Memory" },
      { name: "description", content: "Unlock unlimited boosts and remove ads with Cosmic Premium." },
    ],
  }),
});

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
    toast("✨ Welcome to Premium!");
    setTimeout(() => setConfetti(false), 2400);
  };

  return (
    <main className="relative min-h-screen overflow-hidden">
      <Universe parallax={0.2} />
      <Confetti active={confetti} />

      <header className="flex items-center justify-between px-4 sm:px-6 pt-3 mt-3">
        <Link to="/levels" className="glass rounded-full px-4 py-2 text-sm font-semibold">← Back</Link>
        <div className="w-16" />
      </header>

      <div className="flex items-center justify-center p-4">
        <div className="rounded-3xl overflow-hidden max-w-md w-full pop-in"
          style={{ background: "linear-gradient(160deg, oklch(0.25 0.12 290) 0%, oklch(0.18 0.1 320) 100%)", border: "1px solid rgba(255,255,255,0.15)", boxShadow: "0 30px 60px -10px rgba(0,0,0,0.6), 0 0 40px rgba(168,85,247,0.35)" }}>
          <img src="/premium-ad.jpg" alt="Cosmic Premium" className="w-full aspect-[3/4] object-cover" />
          <div className="p-6 text-center">
            <h1 className="text-3xl font-black text-glow mb-2">Cosmic Premium</h1>
            <ul className="text-sm text-white/90 space-y-1.5 mb-5">
              <li>♾️ Unlimited boosts on every level</li>
              <li>🚫 No more ads, ever</li>
              <li>⭐ Bonus spin wheel any time</li>
              <li>💫 Support the cosmos</li>
            </ul>

            {premium ? (
              <div className="space-y-3">
                <div className="text-accent font-black text-lg">✓ You're Premium</div>
                <button onClick={() => navigate({ to: "/levels" })} className="btn-cosmic w-full !py-3">Back to Levels</button>
              </div>
            ) : (
              <>
                <button onClick={buy} className="btn-cosmic w-full !py-3 text-base">
                  Unlock Premium — $4.99
                </button>
                <button onClick={() => navigate({ to: "/levels" })} className="glass rounded-full w-full mt-3 py-2 text-sm font-semibold">
                  Maybe later
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
