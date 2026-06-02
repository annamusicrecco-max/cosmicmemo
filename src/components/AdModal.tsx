import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";

const AD_SECONDS = 10;

export function AdModal({
  open,
  onDone,
  label = "Your reward will unlock shortly",
}: {
  open: boolean;
  onDone: () => void;
  label?: string;
}) {
  const [remaining, setRemaining] = useState(AD_SECONDS);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) { setRemaining(AD_SECONDS); return; }
    const start = Date.now();
    const id = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000;
      const left = Math.max(0, AD_SECONDS - elapsed);
      setRemaining(left);
      if (left <= 0) { clearInterval(id); onDone(); }
    }, 100);
    return () => clearInterval(id);
  }, [open, onDone]);

  if (!open) return null;

  const progress = ((AD_SECONDS - remaining) / AD_SECONDS) * 100;

  const goPremium = () => {
    onDone();
    navigate({ to: "/premium" });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 backdrop-blur-sm p-4">
      <div className="relative rounded-3xl overflow-hidden max-w-sm w-full pop-in shadow-2xl"
        style={{ border: "1px solid rgba(255,255,255,0.18)" }}>
        <div className="absolute top-2 left-2 z-10 text-[10px] uppercase tracking-[0.3em] px-2 py-1 rounded-full bg-black/60 text-white/80">
          Ad · {Math.ceil(remaining)}s
        </div>

        <button
          onClick={goPremium}
          className="block w-full text-left focus:outline-none"
          aria-label="Go Premium"
        >
          <div className="relative aspect-[3/4] w-full">
            <img
              src="/premium-ad.jpg"
              alt="Go Premium — Unlimited Boosts, No Ads"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-x-0 bottom-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent">
              <div className="text-white text-xl font-black leading-tight">Tap to Go Premium</div>
              <div className="text-white/80 text-xs mt-1">Unlimited boosts · No ads · Forever</div>
            </div>
          </div>
        </button>

        <div className="bg-black/80 px-4 py-3">
          <div className="text-[11px] text-white/60 mb-1.5">{label}</div>
          <div className="h-1.5 bg-white/15 rounded-full overflow-hidden">
            <div
              className="h-full transition-[width] duration-100 ease-linear"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg,var(--primary),var(--accent))" }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
