import { useEffect, useState } from "react";
import { loadState, saveState, resetState, type CardBack, PREMIUM_CARD_BACKS } from "@/lib/game-state";
import { setMuted } from "@/lib/audio";
import { DonateModal } from "@/components/DonateModal";
import { MpDiagnostics } from "@/components/MpDiagnostics";
import { useNavigate } from "@tanstack/react-router";

const ALL_CARD_BACKS: CardBack[] = ["default", "galaxy", "nebula", "starlight", "cosmos", "supernova", "aurora"];

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const navigate = useNavigate();
  const [muted, setMutedState] = useState(false);
  const [premium, setPremium] = useState(false);
  const [cardBack, setCardBack] = useState<CardBack>("default");
  const [showDonate, setShowDonate] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [animateIn, setAnimateIn] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const s = loadState();
      setMutedState(s.muted); setPremium(s.premium); setCardBack(s.cardBack);
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
  const onTogglePremium = () => {
    const v = !premium;
    setPremium(v);
    update({ premium: v });
    // If turning off premium while using a premium-only back, revert to default
    if (!v && PREMIUM_CARD_BACKS.includes(cardBack)) {
      setCardBack("default"); update({ cardBack: "default" });
    }
  };
  const onReset = () => { if (confirm("Reset all progress? This cannot be undone.")) { resetState(); window.location.href = "/"; } };
  const onContact = () => { window.location.href = "mailto:hello@cosmicmemory.app?subject=Cosmic%20Memory%20feedback"; };
  const onPickCardBack = (cb: CardBack) => {
    if (PREMIUM_CARD_BACKS.includes(cb) && !premium) {
      onClose(); navigate({ to: "/premium" }); return;
    }
    setCardBack(cb); update({ cardBack: cb });
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm transition-opacity duration-300 ${animateIn ? "opacity-100" : "opacity-0"}`}
      onClick={onClose}
    >
      <div
        className="glass w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxHeight: "80vh",
          transform: animateIn ? "translateY(0)" : "translateY(100%)",
          transition: "transform 320ms cubic-bezier(.2,.9,.3,1)",
        }}
      >
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
          <Row label={premium ? "✨ Premium ON — testing premium UX" : "Premium OFF — testing free UX"}>
            <PremiumToggle on={premium} onChange={onTogglePremium} />
          </Row>
          <p className="text-[11px] text-muted-foreground mt-2">
            Use this toggle to preview premium vs non-premium experience.
          </p>
          {!premium && (
            <button
              onClick={() => { onClose(); navigate({ to: "/premium" }); }}
              className="w-full mt-3 py-3 px-5 rounded-full font-black text-white text-base"
              style={{
                background: "linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f43f5e 100%)",
                boxShadow: "0 10px 30px rgba(236,72,153,0.45), inset 0 1px 0 rgba(255,255,255,0.4)",
              }}
            >
              ✨ See Premium Benefits
            </button>
          )}
        </Section>

        <Section title="Card Backs">
          <div className="grid grid-cols-4 gap-2">
            {ALL_CARD_BACKS.map((cb) => {
              const isPremium = PREMIUM_CARD_BACKS.includes(cb);
              const locked = isPremium && !premium;
              const active = cardBack === cb;
              return (
                <button
                  key={cb}
                  onClick={() => onPickCardBack(cb)}
                  className={`relative rounded-xl aspect-square text-[10px] font-semibold capitalize border-2 transition overflow-hidden ${active ? "border-accent" : "border-transparent opacity-80 hover:opacity-100"}`}
                  style={{
                    background: cb === "default"
                      ? "linear-gradient(135deg,var(--primary),var(--accent))"
                      : `url(/images/rewards/card-back-${cb}.jpg) center/cover`,
                  }}
                  title={locked ? `${cb} — premium` : cb}
                >
                  <span className="absolute inset-x-0 bottom-0 bg-black/55 px-1 py-0.5 text-white">{cb}</span>
                  {isPremium && (
                    <span className="absolute top-1 right-1 text-[9px] px-1.5 py-0.5 rounded-full font-black"
                      style={{
                        background: locked ? "rgba(0,0,0,0.7)" : "linear-gradient(135deg,#a855f7,#ec4899)",
                        color: "white",
                        boxShadow: locked ? "none" : "0 0 10px rgba(236,72,153,0.6)",
                      }}>
                      {locked ? "🔒" : "✨"}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <p className="text-[11px] text-muted-foreground mt-2">✨ marks premium-only designs.</p>
        </Section>

        <Section title="Multiplayer">
          <MpDiagnostics />
        </Section>

        <Section title="Support the Developer">
          <button onClick={() => setShowDonate(true)} className="btn-cosmic w-full !py-2.5 text-sm">💜 Donate</button>
        </Section>

        <Section title="Other">
          <button onClick={onContact} className="glass rounded-full w-full py-2 text-sm mb-2">Contact Developer</button>
          <button onClick={onReset} className="rounded-full w-full py-2 text-sm bg-destructive text-destructive-foreground font-semibold">Reset Levels</button>
        </Section>
      </div>

      <DonateModal open={showDonate} onClose={() => setShowDonate(false)} />
    </div>
  );
}

function PremiumToggle({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={on}
      className="relative w-14 h-8 rounded-full transition focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      style={{
        background: on
          ? "linear-gradient(135deg,#a855f7,#ec4899)"
          : "rgba(255,255,255,0.15)",
        boxShadow: on ? "0 0 16px rgba(236,72,153,0.55), inset 0 1px 0 rgba(255,255,255,0.3)" : "inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <span
        className="absolute top-1 left-1 w-6 h-6 rounded-full bg-white shadow-md transition-transform"
        style={{ transform: on ? "translateX(24px)" : "translateX(0)" }}
      />
    </button>
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
