import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Vault } from "lucide-react";

const AUTH_METHODS = { google: true, email: false } as const;

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — The Diecast Vault" },
      {
        name: "description",
        content: "Sign in to your The Diecast Vault account with Google.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  validateSearch: (s: Record<string, unknown>) => ({
    next: typeof s.next === "string" ? s.next : "",
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();

  const safeNext =
    next && next.startsWith("/") && !next.startsWith("//") ? next : "";

  const [loading, setLoading] = useState(false);

  const goNext = () => {
    if (safeNext) {
      window.location.href = safeNext;
    } else {
      navigate({ to: "/" });
    }
  };

  useEffect(() => {
    const checkSession = async () => {
      const { data } = await supabase.auth.getSession();

      if (data.session) {
        goNext();
      }
    };

    checkSession();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleGoogle() {
    setLoading(true);

    const redirectTo = safeNext
      ? `${window.location.origin}/auth/callback?next=${encodeURIComponent(
          safeNext
        )}`
      : `${window.location.origin}/auth/callback`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: false,
      },
    });

    if (error) {
      toast.error(error.message || "Google sign-in failed");
      setLoading(false);
    }
  }

  return (
    <SiteShell>
      <section className="mx-auto flex max-w-md flex-col items-center px-4 py-20">
        <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-card shadow-inner">
          <Vault className="h-6 w-6 text-primary" />
        </div>

        <h1 className="text-center text-3xl font-black uppercase tracking-tight md:text-4xl">
          Enter the Vault
        </h1>

        <p className="mt-2 text-center text-sm text-muted-foreground">
          Sign in with Google to continue. Your cart, orders and collection stay
          in sync.
        </p>

        <div className="mt-8 w-full rounded-2xl border border-border/70 bg-card/60 p-6 shadow-sm">
          {AUTH_METHODS.google && (
            <Button
              type="button"
              onClick={handleGoogle}
              disabled={loading}
              variant="outline"
              className="h-12 w-full rounded-full text-sm font-semibold"
            >
              <GoogleIcon className="mr-2 h-4 w-4" />
              {loading ? "Redirecting..." : "Continue with Google"}
            </Button>
          )}

          <p className="mt-6 text-center text-[11px] leading-relaxed text-muted-foreground">
            By continuing you agree to our{" "}
            <a
              href="/legal/terms"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Terms
            </a>{" "}
            and{" "}
            <a
              href="/legal/privacy"
              className="underline underline-offset-2 hover:text-foreground"
            >
              Privacy Policy
            </a>
            .
          </p>
        </div>
      </section>
    </SiteShell>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.5-1.72 4.4-5.5 4.4-3.31 0-6-2.73-6-6.1s2.69-6.1 6-6.1c1.88 0 3.15.8 3.87 1.49l2.64-2.55C16.83 3.7 14.66 2.8 12 2.8 6.98 2.8 2.9 6.88 2.9 12s4.08 9.2 9.1 9.2c5.26 0 8.75-3.69 8.75-8.9 0-.6-.07-1.05-.15-1.5H12z"
      />
    </svg>
  );
}