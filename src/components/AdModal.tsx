import { useEffect, useState } from "react";

export function AdModal({ open, onDone, label = "Your reward will unlock shortly" }: { open: boolean; onDone: () => void; label?: string }) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (!open) { setProgress(0); return; }
    const start = Date.now();
    const id = setInterval(() => {
      const p = Math.min(100, ((Date.now() - start) / 2000) * 100);
      setProgress(p);
      if (p >= 100) { clearInterval(id); onDone(); }
    }, 50);
    return () => clearInterval(id);
  }, [open, onDone]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="glass rounded-3xl p-6 max-w-sm w-full text-center pop-in">
        <div className="text-xs uppercase tracking-[0.3em] text-accent mb-2">Advertisement</div>
        <p className="text-sm text-muted-foreground mb-4">{label}</p>
        <div className="h-2 bg-muted/40 rounded-full overflow-hidden">
          <div className="h-full transition-[width] duration-100 ease-linear"
            style={{ width: `${progress}%`, background: "linear-gradient(90deg,var(--primary),var(--accent))" }} />
        </div>
        <div className="text-xs text-muted-foreground mt-2">{Math.max(0, Math.ceil((100 - progress) / 50))}s</div>
      </div>
    </div>
  );
}
