import { createFileRoute, Link } from "@tanstack/react-router";
import { Universe } from "@/components/Universe";
import { SiteFooter } from "./index";

export const Route = createFileRoute("/contact")({
  component: Contact,
  head: () => ({
    meta: [
      { title: "Contact — Cosmic Memory" },
      { name: "description", content: "Get in touch with the Cosmic Memory team for feedback, bug reports, business inquiries, and privacy questions." },
      { property: "og:title", content: "Contact — Cosmic Memory" },
      { property: "og:description", content: "Feedback, bug reports, and business inquiries for Cosmic Memory." },
    ],
    links: [{ rel: "canonical", href: "https://cosmicmemo.lovable.app/contact" }],
  }),
});

function Contact() {
  return (
    <main className="relative min-h-screen px-4 sm:px-6 py-10 overflow-hidden">
      <Universe />
      <div className="relative z-10 max-w-3xl mx-auto text-left">
        <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Home</Link>
        <h1 className="text-4xl sm:text-5xl font-black mt-4 mb-6 text-glow">Contact</h1>

        <section className="space-y-6 text-muted-foreground text-base sm:text-lg leading-relaxed">
          <p>
            We'd love to hear from you. Reach out for feedback, bug reports, partnership
            inquiries, or privacy questions.
          </p>

          <div className="glass rounded-2xl p-6 space-y-4">
            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">General &amp; support</h2>
              <p>
                Email:{" "}
                <a href="mailto:hello@cosmicmemory.online" className="underline hover:text-foreground">
                  hello@cosmicmemory.online
                </a>
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Privacy inquiries</h2>
              <p>
                Email:{" "}
                <a href="mailto:privacy@cosmicmemory.online" className="underline hover:text-foreground">
                  privacy@cosmicmemory.online
                </a>
              </p>
            </div>

            <div>
              <h2 className="text-xl font-bold text-foreground mb-1">Bug reports</h2>
              <p>
                Please include: your device and browser, the level or mode you were in, and any
                steps to reproduce. Screenshots or short screen recordings help a lot.
              </p>
            </div>
          </div>

          <p className="text-sm">
            We aim to respond within a few business days. Thanks for playing Cosmic Memory ✨
          </p>
        </section>

        <SiteFooter />
      </div>
    </main>
  );
}
