import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";
import { Mail, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact — The Diecast Vault" },
      { name: "description", content: "Questions about a casting, an order, or a trade? Get in touch." },
      { property: "og:title", content: "Contact The Diecast Vault" },
      { property: "og:description", content: "Reach out about orders, castings, or trades." },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  return (
    <SiteShell>
      <section className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-black">Get in touch</h1>
        <p className="mt-3 text-muted-foreground">We reply within one business day.</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a href="mailto:hello@thediecastvault.com" className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-5 hover:border-primary/60">
            <Mail className="h-5 w-5 text-primary" />
            <div>
              <div className="font-bold">Email</div>
              <div className="text-xs text-muted-foreground">hello@thediecastvault.com</div>
            </div>
          </a>
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card p-5">
            <MessageSquare className="h-5 w-5 text-primary" />
            <div>
              <div className="font-bold">Instagram DM</div>
              <div className="text-xs text-muted-foreground">@thediecastvault</div>
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}