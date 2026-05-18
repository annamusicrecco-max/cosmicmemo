import { useState } from "react";

export function DonateModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [amount, setAmount] = useState<number>(5);
  const [custom, setCustom] = useState("");

  if (!open) return null;

  const onDonate = () => {
    const final = custom ? Number(custom) : amount;
    if (!final || final <= 0) { alert("Please choose an amount."); return; }
    alert(`💜 Thank you! Mock $${final.toFixed(2)} donation received.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-md p-4" onClick={onClose}>
      <div
        className="rounded-3xl p-7 max-w-md w-full text-center pop-in relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "linear-gradient(160deg, oklch(0.22 0.1 320) 0%, oklch(0.18 0.12 280) 100%)",
          border: "1px solid oklch(1 0 0 / 0.15)",
          boxShadow: "0 30px 60px -10px rgba(0,0,0,0.6), 0 0 40px rgba(236,72,153,0.3)",
        }}
      >
        <div className="text-5xl mb-3">💜</div>
        <h3 className="text-2xl font-black mb-2" style={{ background: "linear-gradient(135deg,#fff,#fbcfe8)", WebkitBackgroundClip: "text", color: "transparent" }}>
          Support Cosmic Memory
        </h3>
        <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
          Your donations help us add more prizes, develop new features, and keep Cosmic Memory free for everyone.
        </p>

        <div className="grid grid-cols-3 gap-2 mb-3">
          {[2, 5, 10].map((a) => (
            <button
              key={a}
              onClick={() => { setAmount(a); setCustom(""); }}
              className={`py-3 rounded-2xl font-bold transition ${amount === a && !custom ? "bg-primary text-primary-foreground scale-105" : "glass"}`}
            >
              ${a}
            </button>
          ))}
        </div>

        <input
          type="number"
          inputMode="decimal"
          min={1}
          placeholder="Custom amount"
          value={custom}
          onChange={(e) => setCustom(e.target.value)}
          className="w-full glass rounded-2xl px-4 py-3 text-center text-sm mb-5 outline-none focus:ring-2 focus:ring-accent"
        />

        <button
          onClick={onDonate}
          className="w-full py-3 rounded-full font-black text-white text-base mb-2"
          style={{
            background: "linear-gradient(135deg, #ec4899 0%, #a855f7 100%)",
            boxShadow: "0 10px 30px rgba(236,72,153,0.5), inset 0 1px 0 rgba(255,255,255,0.4)",
          }}
        >
          Donate {custom ? `$${custom}` : `$${amount}`}
        </button>
        <button onClick={onClose} className="text-xs text-muted-foreground underline w-full">Close</button>
      </div>
    </div>
  );
}
