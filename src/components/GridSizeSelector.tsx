import { GRID_SIZES, DEFAULT_GRID } from "@/lib/grid-sizes";

const STORAGE_KEY = "cosmic_preferred_grid";

type Props = {
  value: string;
  onChange: (label: string) => void;
  className?: string;
  label?: string;
};

export function GridSizeSelector({ value, onChange, className, label = "Grid Size" }: Props) {
  return (
    <div className={className}>
      <label className="text-xs uppercase tracking-widest text-accent">{label}</label>
      <div className="mt-1 relative">
        <select
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            try { localStorage.setItem(STORAGE_KEY, e.target.value); } catch { /* ignore */ }
          }}
          className="w-full px-4 py-3 rounded-xl bg-background/40 border border-white/15 focus:outline-none focus:border-accent text-sm appearance-none cursor-pointer pr-10"
          style={{
            background:
              "linear-gradient(135deg, rgba(168,85,247,0.15), rgba(236,72,153,0.10))",
          }}
        >
          {GRID_SIZES.map((g) => (
            <option key={g.label} value={g.label} className="bg-background text-foreground">
              {g.label}  ({g.total} cards){g.label === DEFAULT_GRID ? " — default" : ""}
            </option>
          ))}
        </select>
        <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-accent">▾</span>
      </div>
    </div>
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
