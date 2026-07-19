import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
});

function AuthCallbackPage() {
  useEffect(() => {
    const finishLogin = async () => {
      try {
        // Give Supabase a moment to finish processing the OAuth redirect
        await new Promise((resolve) => setTimeout(resolve, 300));

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          window.location.replace("/auth");
          return;
        }

        const params = new URLSearchParams(window.location.search);
        const next = params.get("next");

        if (next && next.startsWith("/")) {
          window.location.replace(next);
        } else {
          window.location.replace("/");
        }
      } catch (err) {
        console.error(err);
        window.location.replace("/auth");
      }
    };

    finishLogin();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center">
      <p className="text-lg font-medium">Signing you in...</p>
    </div>
  );
}