import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — The Diecast Vault" },
      { name: "description", content: "An independent Hot Wheels shop run by collectors, for collectors." },
      { property: "og:title", content: "About The Diecast Vault" },
      { property: "og:description", content: "Independent Hot Wheels shop for die-cast collectors." },
    ],
  }),
  component: AboutPage,
});

function AboutPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-black">About The Diecast Vault</h1>
        <p className="mt-6 text-lg text-muted-foreground">
          We're a small, collector-run Hot Wheels shop. Every car ships from our garage in a padded mailer,
          carded cars protected with a snug fit case.
        </p>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {[
            ["Curated", "We hand-pick every casting — no bulk cases dumped on the site."],
            ["Fair", "Prices reflect what we paid at retail plus a modest markup, not eBay fever."],
            ["Fast", "Orders placed before 2pm ship next business day."],
          ].map(([t, d]) => (
            <div key={t} className="rounded-xl border border-border/60 bg-card p-5">
              <div className="text-xs font-bold uppercase tracking-widest text-primary">{t}</div>
              <p className="mt-2 text-sm text-muted-foreground">{d}</p>
            </div>
          ))}
        </div>
      </section>
    </SiteShell>
  );
}