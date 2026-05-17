import { useEffect, useRef } from "react";

type Star = { x: number; y: number; r: number; a: number; s: number };

export function Universe({ parallax = 1 }: { parallax?: number }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const mouse = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let raf = 0;
    let stars: Star[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const area = canvas.width * canvas.height;
      const isCoarse = window.matchMedia?.("(pointer: coarse)").matches;
      const base = isCoarse ? 60 : 180;
      const count = Math.min(base, Math.round(area / 12000));
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.6 + 0.3,
        a: Math.random(),
        s: Math.random() * 0.02 + 0.005,
      }));
    };
    resize();
    window.addEventListener("resize", resize);

    const onMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth - 0.5) * 20 * parallax;
      mouse.current.y = (e.clientY / window.innerHeight - 0.5) * 20 * parallax;
    };
    window.addEventListener("mousemove", onMove);

    const loop = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const st of stars) {
        st.a += st.s;
        const op = 0.4 + Math.abs(Math.sin(st.a)) * 0.6;
        ctx.beginPath();
        ctx.arc(st.x + mouse.current.x, st.y + mouse.current.y, st.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 240, 220, ${op})`;
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", onMove);
    };
  }, [parallax]);

  return (
    <canvas
      ref={ref}
      className="fixed inset-0 -z-10 pointer-events-none"
      aria-hidden
    />
  );
}
