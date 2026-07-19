import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";

export const Route = createFileRoute("/legal/shipping")({
  head: () => ({
    meta: [
      { title: "Shipping Policy — The Diecast Vault" },
      { name: "description", content: "Shipping options and timelines." },
    ],
  }),
  component: ShippingPage,
});

function ShippingPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-black">Shipping Policy</h1>
        <p className="mt-4 text-muted-foreground">
          USPS First Class & Priority. Orders before 2pm PT ship next business day.
        </p>
      </article>
    </SiteShell>
  );
}