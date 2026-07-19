import { createFileRoute } from "@tanstack/react-router";
import { SiteShell } from "@/components/site/SiteShell";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — The Diecast Vault" },
      { name: "description", content: "Privacy Policy for The Diecast Vault." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <SiteShell>
      <article className="mx-auto max-w-3xl px-4 py-16">
        <h1 className="text-4xl font-black">Privacy Policy</h1>
        <p className="mt-4 text-muted-foreground">
          Placeholder privacy policy. Replace with your final policy before launch.
        </p>
      </article>
    </SiteShell>
  );
}