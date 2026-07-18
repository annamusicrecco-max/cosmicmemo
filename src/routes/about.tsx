import { createFileRoute, Link } from "@tanstack/react-router";
import { Universe } from "@/components/Universe";
import { SiteFooter } from "./index";

export const Route = createFileRoute("/about")({
  component: About,
  head: () => ({
    meta: [
      { title: "About — Cosmic Memory" },
      { name: "description", content: "About Cosmic Memory — an independent browser memory game built to help players restore focus and enjoy a calm cosmic aesthetic." },
      { property: "og:title", content: "About — Cosmic Memory" },
      { property: "og:description", content: "An independent browser memory game with a calming cosmic aesthetic." },
    ],
    links: [{ rel: "canonical", href: "https://cosmicmemo.lovable.app/about" }],
  }),
});

function About() {
  return (
    <main className="relative min-h-screen px-4 sm:px-6 py-10 overflow-hidden">
      <Universe />
      <div className="relative z-10 max-w-3xl mx-auto text-left">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
        <h1 className="text-4xl sm:text-5xl font-black mt-4 mb-6 text-glow">About Cosmic Memory</h1>

        <section className="space-y-6 text-muted-foreground text-base sm:text-lg leading-relaxed">
          <p>
            Cosmic Memory is an independently developed browser-based memory matching game. It
            was created as a small antidote to short-form attention loops — a place to sit down,
            breathe, and train focus one flipped card at a time.
          </p>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Our mission</h2>
            <p>
              Restore attention through play. Memory games are one of the oldest and most
              rewarding formats in existence, and we wanted to modernize them with careful
              pacing, a soothing soundtrack, honest progression, and no dark patterns.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Who builds it</h2>
            <p>
              Cosmic Memory is developed and published by the Cosmic Memory team. The game is
              free to play, works entirely in modern web browsers, and can be installed as a
              Progressive Web App on desktop and mobile.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Credits &amp; licensing</h2>
            <ul className="list-disc pl-6 space-y-1">
              <li>All card artwork, UI, and icon assets are original to Cosmic Memory.</li>
              <li>Background lo-fi music is licensed for use in the game.</li>
              <li>Fonts are served from Google Fonts (Fredoka) under their open licenses.</li>
              <li>Multiplayer, AI, and cloud storage are powered by third-party APIs.</li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Contact</h2>
            <p>
              Feedback, bug reports, and business inquiries are welcome — see the{" "}
              <Link to="/contact" className="underline hover:text-foreground">Contact page</Link>.
            </p>
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
