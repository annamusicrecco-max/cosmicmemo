import { useEffect, useState } from "react";
import { loadState, saveState, resetState, type CardBack } from "@/lib/game-state";
import { setMuted } from "@/lib/audio";

export function SettingsPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [muted, setMutedState] = useState(false);
  const [premium, setPremium] = useState(false);
  const [cardBack, setCardBack] = useState<CardBack>("default");
  const [showAdRemoved, setShowAdRemoved] = useState(false);

  useEffect(() => {
    if (!open) return;
    const s = loadState();
    setMutedState(s.muted);
    setPremium(s.premium);
    setCardBack(s.cardBack);
  }, [open]);

  if (!open) return null;

  const update = (patch: Parameters<typeof saveState>[0] extends infer T ? Partial<T> : never) => {
    const s = loadState();
    saveState({ ...s, ...patch });
  };

  const onToggleMute = () => {
    const v = !muted; setMutedState(v); setMuted(v); update({ muted: v });
  };
  const onBuyPremium = () => {
    setPremium(true); update({ premium: true }); setShowAdRemoved(true);
    setTimeout(() => setShowAdRemoved(false), 2200);
  };
  const onRestore = () => {
    const s = loadState();
    setPremium(s.premium);
    alert(s.premium ? "Premium restored!" : "No previous purchase found.");
  };
  const onReset = () => {
    if (confirm("Reset all progress? This cannot be undone.")) {
      resetState(); window.location.href = "/";
    }
  };
  const onContact = () => { window.location.href = "mailto:hello@cosmicmemory.app?subject=Cosmic%20Memory%20feedback"; };
  const onDonate = (amount: number) => { alert(`Thanks for your generosity! Mock $${amount} donation received.`); };
  const onPickCardBack = (cb: CardBack) => { setCardBack(cb); update({ cardBack: cb }); };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-0 sm:p-4" onClick={onClose}>
      <div className="glass w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl p-6 pop-in max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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
              <button onClick={onBuyPremium} className="btn-cosmic w-full !py-3">Remove Ads — $4.99</button>
              {showAdRemoved && <p className="text-xs text-accent mt-2 text-center">Mock purchase complete!</p>}
              <button onClick={onRestore} className="text-xs text-muted-foreground underline mt-2 w-full text-center">Restore Purchases</button>
            </>
          )}
          <button onClick={() => onBuyPremium()} className="glass rounded-full w-full mt-2 py-2 text-sm">Buy Time Pack — $1.99 (mock)</button>
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
          <div className="flex gap-2">
            {[2, 5, 10].map((a) => (
              <button key={a} onClick={() => onDonate(a)} className="glass rounded-full flex-1 py-2 text-sm">${a}</button>
            ))}
          </div>
        </Section>

        <Section title="Other">
          <button onClick={onContact} className="glass rounded-full w-full py-2 text-sm mb-2">Contact Developer</button>
          <button onClick={onReset} className="rounded-full w-full py-2 text-sm bg-destructive text-destructive-foreground font-semibold">Reset Levels</button>
        </Section>
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
