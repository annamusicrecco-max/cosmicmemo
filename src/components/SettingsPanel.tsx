import { useEffect, useState } from "react";
import { loadState, saveState, resetState, type CardBack } from "@/lib/game-state";
import { setMuted, setVolume } from "@/lib/audio";
import { DonateModal } from "@/components/DonateModal";

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [muted, setMutedState] = useState(false);
  const [volume, setVolumeState] = useState(0.2);
  const [premium, setPremium] = useState(false);
  const [cardBack, setCardBack] = useState<CardBack>("default");
  const [showPremium, setShowPremium] = useState(false);
  const [showDonate, setShowDonate] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const s = loadState();
      setMutedState(s.muted); setVolumeState(s.volume ?? 0.2); setPremium(s.premium); setCardBack(s.cardBack);
      requestAnimationFrame(() => setAnimateIn(true));
    } else if (mounted) {
      setAnimateIn(false);
      const t = setTimeout(() => setMounted(false), 320);
      return () => clearTimeout(t);
    }
  }, [open, mounted]);

  if (!mounted) return null;

  const update = (patch: Partial<ReturnType<typeof loadState>>) => {
    const s = loadState(); saveState({ ...s, ...patch });
  };

  const onToggleMute = () => { const v = !muted; setMutedState(v); setMuted(v); update({ muted: v }); };
  const onConfirmPremium = () => { setPremium(true); update({ premium: true }); setShowPremium(false); };
  const onRestore = () => { const s = loadState(); setPremium(s.premium); alert(s.premium ? "Premium restored!" : "No previous purchase found."); };
  const onReset = () => { if (confirm("Reset all progress? This cannot be undone.")) { resetState(); window.location.href = "/"; } };
  const onContact = () => { window.location.href = "mailto:hello@cosmicmemory.app?subject=Cosmic%20Memory%20feedback"; };
  const onPickCardBack = (cb: CardBack) => { setCardBack(cb); update({ cardBack: cb }); };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${animateIn ? "opacity-100" : "opacity-0"}`}
      onClick={onClose}
    >
      <div
        className="glass w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: "75vh",
          transform: animateIn ? "translateY(0)" : "translateY(100%)",
          transition: "transform 320ms cubic-bezier(.2,.9,.3,1)",
        }}
      >
        {/* Drag handle */}
        <div className="mx-auto h-1.5 w-12 rounded-full bg-muted-foreground/40 mb-4 sm:hidden" />

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-black text-glow">Settings</h2>
          <button onClick={onClose} className="glass rounded-full px-3 py-1 text-sm">Close</button>
        </div>

        <Section title="Audio">
          <Row label={muted ? "Background music muted" : "Background music on"}>
            <button onClick={onToggleMute} className="btn-cosmic !py-2 !px-4 text-sm">{muted ? "Unmute" : "Mute"}</button>
          </Row>
        </Section>

        <Section title="Premium">
          {premium ? (
            <p className="text-sm text-accent">✨ Premium active — all ads removed.</p>
          ) : (
            <>
              <button
                onClick={() => setShowPremium(true)}
                className="w-full py-3 px-5 rounded-full font-black text-white text-base relative overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f43f5e 100%)",
                  boxShadow: "0 10px 30px rgba(236,72,153,0.45), inset 0 1px 0 rgba(255,255,255,0.4), 0 0 22px rgba(168,85,247,0.6)",
                }}
              >
                ✨ Go Premium — $4.99
              </button>
              <button onClick={onRestore} className="text-xs text-muted-foreground underline mt-2 w-full text-center">Restore Purchases</button>
            </>
          )}
        </Section>

        <Section title="Card Backs">
          <div className="grid grid-cols-4 gap-2">
            {(["default","galaxy","nebula","starlight"] as CardBack[]).map((cb) => (
              <button key={cb} onClick={() => onPickCardBack(cb)}
                className={`rounded-xl aspect-square text-xs font-semibold capitalize border-2 transition ${cardBack === cb ? "border-accent" : "border-transparent opacity-70"}`}
                style={{ background: cb === "default" ? "linear-gradient(135deg,var(--primary),var(--accent))" : `url(/images/rewards/card-back-${cb}.jpg) center/cover` }}>
                <span className="bg-black/40 px-1 rounded">{cb}</span>
              </button>
            ))}
          </div>
        </Section>

        <Section title="Support the Developer">
          <button onClick={() => setShowDonate(true)} className="btn-cosmic w-full !py-2.5 text-sm">💜 Donate</button>
        </Section>

        <Section title="Other">
          <button onClick={onContact} className="glass rounded-full w-full py-2 text-sm mb-2">Contact Developer</button>
          <button onClick={onReset} className="rounded-full w-full py-2 text-sm bg-destructive text-destructive-foreground font-semibold">Reset Levels</button>
        </Section>
      </div>

      {showPremium && (
        <PremiumModal onClose={() => setShowPremium(false)} onConfirm={onConfirmPremium} />
      )}
      <DonateModal open={showDonate} onClose={() => setShowDonate(false)} />
    </div>
  );
}

function PremiumModal({ onClose, onConfirm }: { onClose: () => void; onConfirm: () => void }) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={onClose}>
      <div
        className="rounded-3xl p-7 max-w-md w-full text-center pop-in relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(160deg, oklch(0.25 0.12 290) 0%, oklch(0.18 0.1 320) 100%)",
          border: "1px solid oklch(1 0 0 / 0.15)",
          boxShadow: "0 30px 60px -10px rgba(0,0,0,0.6), 0 0 40px rgba(168,85,247,0.35)",
        }}
      >
        <div className="text-5xl mb-3">✨</div>
        <h3 className="text-2xl font-black mb-1" style={{ background: "linear-gradient(135deg,#fff,#f0abfc)", WebkitBackgroundClip: "text", color: "transparent" }}>Cosmic Premium</h3>
        <p className="text-sm text-muted-foreground mb-5">Unlock the full cosmic experience.</p>

        <ul className="text-left space-y-2 mb-6 text-sm">
          {[
            "🚫 No ads — ever",
            "♾️ Unlimited boosters",
            "🎴 Exclusive card backs",
            "💜 Support indie development",
          ].map((b) => (
            <li key={b} className="glass rounded-xl px-3 py-2">{b}</li>
          ))}
        </ul>

        <button
          onClick={onConfirm}
          className="w-full py-3 rounded-full font-black text-white text-base mb-2"
          style={{
            background: "linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f43f5e 100%)",
            boxShadow: "0 10px 30px rgba(236,72,153,0.5), inset 0 1px 0 rgba(255,255,255,0.4)",
          }}
        >
          Pay $4.99
        </button>
        <button onClick={onClose} className="text-xs text-muted-foreground underline w-full">Close</button>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <h3 className="text-xs uppercase tracking-[0.2em] text-accent mb-2">{title}</h3>
      {children}
    </div>
  );
}
function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex items-center justify-between gap-3"><span className="text-sm">{label}</span>{children}</div>;
}
