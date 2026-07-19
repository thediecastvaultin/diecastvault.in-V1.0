import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { Vault } from "lucide-react";

type OAuthResult = {
  data: {
    client?: { name?: string; redirect_uri?: string } | null;
    scope?: string;
    redirect_url?: string;
    redirect_to?: string;
  } | null;
  error: { message: string } | null;
};

type OAuthNamespace = {
  getAuthorizationDetails: (id: string) => Promise<OAuthResult>;
  approveAuthorization: (id: string) => Promise<OAuthResult>;
  denyAuthorization: (id: string) => Promise<OAuthResult>;
};

function oauthNs(): OAuthNamespace {
  const anyAuth = supabase.auth as unknown as { oauth?: OAuthNamespace };
  if (!anyAuth.oauth) throw new Error("Supabase OAuth namespace unavailable");
  return anyAuth.oauth;
}

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({
    authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "",
  }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("Missing authorization_id");
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      const next = location.pathname + location.searchStr;
      throw redirect({ to: "/auth", search: { next } });
    }
  },
  loader: async ({ location }) => {
    const authorizationId = new URLSearchParams(location.search).get("authorization_id")!;
    const { data, error } = await oauthNs().getAuthorizationDetails(authorizationId);
    if (error) throw new Error(error.message);
    const immediate = data?.redirect_url ?? data?.redirect_to;
    if (immediate && !data?.client) throw redirect({ href: immediate });
    return data;
  },
  component: Consent,
  errorComponent: ({ error }) => (
    <SiteShell>
      <main className="mx-auto max-w-md px-4 py-16 text-center">
        <h1 className="text-2xl font-black">Could not load this authorization request</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {String((error as Error)?.message ?? error)}
        </p>
      </main>
    </SiteShell>
  ),
});

function Consent() {
  const details = Route.useLoaderData();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(approve: boolean) {
    setBusy(true);
    setError(null);
    const { data, error } = approve
      ? await oauthNs().approveAuthorization(authorization_id)
      : await oauthNs().denyAuthorization(authorization_id);
    if (error) { setBusy(false); setError(error.message); return; }
    const target = data?.redirect_url ?? data?.redirect_to;
    if (!target) { setBusy(false); setError("No redirect returned by the authorization server."); return; }
    window.location.href = target;
  }

  const clientName = details?.client?.name ?? "an app";

  return (
    <SiteShell>
      <section className="mx-auto flex max-w-md flex-col px-4 py-16">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
            <Vault className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-black">Connect {clientName} to your account</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {clientName} will be able to call The Diecast Vault's enabled tools while you are signed in.
            This does not bypass this app's permissions or backend policies.
          </p>
        </div>

        {error && (
          <p role="alert" className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="space-y-3 rounded-xl border border-border/60 bg-card p-6">
          <Button onClick={() => decide(true)} disabled={busy} className="w-full bg-primary hover:bg-primary/90">
            Approve
          </Button>
          <Button onClick={() => decide(false)} disabled={busy} variant="outline" className="w-full">
            Cancel connection
          </Button>
        </div>
      </section>
    </SiteShell>
  );
}