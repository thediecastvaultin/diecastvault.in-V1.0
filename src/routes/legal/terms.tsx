import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — The Diecast Vault" },
      { name: "description", content: "Terms of Service for The Diecast Vault." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-black">Terms of Service</h1>
        <p className="mt-4 text-muted-foreground">
          Placeholder terms. This page is maintained by the store owner and will be replaced with your final legal text.
        </p>
      </article>
    </SiteShell>
  );
}