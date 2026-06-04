import { useEffect, useRef, useState } from "react";
import { GRID_SIZES, DEFAULT_GRID } from "@/lib/grid-sizes";

const STORAGE_KEY = "cosmic_preferred_grid";

type Props = {
  value: string;
  onChange: (label: string) => void;
  className?: string;
  label?: string;
};

export function GridSizeSelector({ value, onChange, className, label = "Grid Size" }: Props) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const current = GRID_SIZES.find((g) => g.label === value) ?? GRID_SIZES[3];

  const pick = (lbl: string) => {
    onChange(lbl);
    try { localStorage.setItem(STORAGE_KEY, lbl); } catch { /* ignore */ }
    setOpen(false);
  };

  return (
    <div className={className} ref={ref}>
      <label className="text-xs uppercase tracking-widest text-accent">{label}</label>
      <div className="mt-1 relative">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="w-full px-4 py-3 rounded-xl border border-white/15 focus:outline-none focus:border-accent text-sm flex items-center justify-between gap-2 hover:border-white/30 transition"
          style={{
            background: "linear-gradient(135deg, rgba(168,85,247,0.18), rgba(236,72,153,0.12))",
            boxShadow: "inset 0 1px 0 rgba(255,255,255,0.08)",
            color: "white",
          }}
        >
          <span className="flex items-center gap-2">
            <MiniGrid rows={current.rows} cols={current.cols} />
            <span className="font-semibold">{current.label}</span>
            <span className="text-[11px] text-white/60">({current.total} cards)</span>
          </span>
          <span className={`text-accent transition-transform ${open ? "rotate-180" : ""}`}>▾</span>
        </button>

        {open && (
          <div
            className="absolute z-50 left-0 right-0 mt-2 rounded-xl overflow-hidden pop-in"
            style={{
              background: "linear-gradient(160deg, oklch(0.22 0.12 290) 0%, oklch(0.16 0.1 320) 100%)",
              border: "1px solid rgba(255,255,255,0.18)",
              boxShadow: "0 20px 40px -10px rgba(0,0,0,0.7), 0 0 30px rgba(168,85,247,0.35)",
            }}
          >
            <ul className="max-h-72 overflow-y-auto py-1">
              {GRID_SIZES.map((g) => {
                const active = g.label === value;
                return (
                  <li key={g.label}>
                    <button
                      type="button"
                      onClick={() => pick(g.label)}
                      className={`w-full text-left px-3 py-2 flex items-center gap-3 text-sm transition ${active ? "" : "hover:bg-white/5"}`}
                      style={active ? {
                        background: "linear-gradient(135deg, rgba(168,85,247,0.35), rgba(236,72,153,0.25))",
                      } : undefined}
                    >
                      <MiniGrid rows={g.rows} cols={g.cols} />
                      <span className="flex-1">
                        <span className="font-bold">{g.label}</span>
                        <span className="text-[11px] text-white/60 ml-2">{g.total} cards</span>
                        {g.label === DEFAULT_GRID && (
                          <span className="text-[10px] uppercase tracking-widest text-accent ml-2">default</span>
                        )}
                      </span>
                      {active && <span className="text-accent">✓</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function MiniGrid({ rows, cols }: { rows: number; cols: number }) {
  const cells = Array.from({ length: rows * cols });
  return (
    <span
      className="inline-grid gap-[2px] p-[3px] rounded-md"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        background: "rgba(0,0,0,0.35)",
        border: "1px solid rgba(255,255,255,0.15)",
        width: 28,
        height: 28,
      }}
      aria-hidden
    >
      {cells.map((_, i) => (
        <span
          key={i}
          className="rounded-[1px]"
          style={{ background: "linear-gradient(135deg,#a855f7,#ec4899)" }}
        />
      ))}
    </span>
  );
}

export function getStoredGrid(): string {
  if (typeof window === "undefined") return DEFAULT_GRID;
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v && GRID_SIZES.some((g) => g.label === v)) return v;
  } catch { /* ignore */ }
  return DEFAULT_GRID;
}
