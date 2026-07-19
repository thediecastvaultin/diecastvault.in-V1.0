import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";

export const Route = createFileRoute("/legal/returns")({
  head: () => ({
    meta: [
      { title: "Returns & Refunds — The Diecast Vault" },
      { name: "description", content: "Return and refund policy." },
    ],
  }),
  component: ReturnsPage,
});

function ReturnsPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-black">Returns & Refunds</h1>
        <p className="mt-4 text-muted-foreground">14-day returns for unopened items. Details coming soon.</p>
      </article>
    </SiteShell>
  );
}