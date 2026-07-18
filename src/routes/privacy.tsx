import { createFileRoute, Link } from "@tanstack/react-router";
import { Universe } from "@/components/Universe";
import { SiteFooter } from "./index";

export const Route = createFileRoute("/privacy")({
  component: Privacy,
  head: () => ({
    meta: [
      { title: "Privacy Policy — Cosmic Memory" },
      { name: "description", content: "Privacy policy for Cosmic Memory covering local storage, cookies, analytics, third-party advertising (Google AdSense), and multiplayer data." },
      { property: "og:title", content: "Privacy Policy — Cosmic Memory" },
      { property: "og:description", content: "How Cosmic Memory handles data, cookies, and third-party advertising." },
    ],
    links: [{ rel: "canonical", href: "https://cosmicmemo.lovable.app/privacy" }],
  }),
});

function Privacy() {
  return (
    <main className="relative min-h-screen px-4 sm:px-6 py-10 overflow-hidden">
      <Universe />
      <div className="relative z-10 max-w-3xl mx-auto text-left">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
        <h1 className="text-4xl sm:text-5xl font-black mt-4 mb-6 text-glow">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground mb-6">Last updated: July 2026</p>

        <section className="space-y-6 text-muted-foreground text-base sm:text-lg leading-relaxed">
          <p>
            This Privacy Policy explains what information Cosmic Memory ("we", "us") collects
            when you use the game at cosmicmemory.online (the "Service"), how it is used, and
            the choices you have.
          </p>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Information stored locally</h2>
            <p>
              Cosmic Memory saves your game progress — completed levels, best times, boost
              inventory, selected card backs, and audio preferences — in your browser's local
              storage. This data never leaves your device unless you explicitly use a feature
              that requires it (for example, online multiplayer).
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Online multiplayer</h2>
            <p>
              When you enter online matchmaking, we generate an anonymous device ID and send it,
              along with a display name you choose and your preferred grid size, to our backend
              so we can pair you with an opponent and relay moves in real time. Match rooms are
              deleted when the game ends. We do not require an account and do not collect names,
              emails, or profile information.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Cookies &amp; similar technologies</h2>
            <p>
              The Service uses browser local storage for game state and may use cookies for
              essential functionality. Third parties (see below) may also set cookies.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Third-party advertising (Google AdSense)</h2>
            <p>
              Cosmic Memory displays advertising provided by Google AdSense. Google and its
              partners, as third-party vendors, use cookies, device identifiers, IP addresses,
              and similar technologies to serve ads based on your prior visits to this and other
              websites, and to measure ad performance.
            </p>
            <ul className="list-disc pl-6 space-y-1 mt-2">
              <li>Google's use of advertising cookies enables it and its partners to serve ads to you based on your visit to our site and/or other sites on the Internet.</li>
              <li>You may opt out of personalized advertising by visiting{" "}
                <a href="https://www.google.com/settings/ads" className="underline" target="_blank" rel="noopener noreferrer">Google Ads Settings</a>.
              </li>
              <li>You may also opt out of some third-party vendors' use of cookies for personalized advertising by visiting{" "}
                <a href="https://www.aboutads.info/" className="underline" target="_blank" rel="noopener noreferrer">www.aboutads.info</a>.
              </li>
            </ul>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">AI features</h2>
            <p>
              The "vs AI" mode and AI chat send the current board state, game history, and any
              chat messages you type to a large-language-model provider so the AI can choose a
              move and reply. Do not share personal or sensitive information in AI chat.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Children</h2>
            <p>
              The Service is not directed to children under 13. We do not knowingly collect
              personal information from children.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Data retention &amp; your rights</h2>
            <p>
              Local game data lives only in your browser and can be cleared at any time from
              the Settings panel ("Reset progress") or via your browser's site-data controls.
              Multiplayer room data is transient and deleted after games end.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Changes</h2>
            <p>
              We may update this policy from time to time. Material changes will be reflected by
              a new "Last updated" date at the top of this page.
            </p>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-foreground mb-2">Contact</h2>
            <p>
              Questions about this policy? See the{" "}
              <Link to="/contact" className="underline hover:text-foreground">Contact page</Link>.
            </p>
          </div>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
