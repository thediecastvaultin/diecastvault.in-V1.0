import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";
import { Header } from "./Header";
import { Footer } from "./Footer";
import { FlashBannerStrip } from "./FlashBannerStrip";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { Wrench } from "lucide-react";

type FlashRow = {
  id: string;
  title: string | null;
  body: string | null;
  link: string | null;
  kind: string;
  display_order: number;
  starts_at: string | null;
  expires_at: string | null;
};

export function SiteShell({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { general } = useSiteSettings();

  const { data: bypass } = useQuery({
    queryKey: ["maintenance-bypass", user?.id],
    enabled: !!user?.id && !!general?.maintenance_mode,
    queryFn: async () => {
      const [{ data: a }, { data: s }] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: user!.id, _role: "staff" }),
      ]);
      return !!a || !!s;
    },
    staleTime: 60_000,
  });


  const { data: announcements } = useQuery({
    queryKey: ["announcements-active"],
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const { data, error } = await supabase
        .from("announcements")
        .select("id,title,body,link,kind,display_order,starts_at,expires_at,channel,active")
        .eq("active", true)
        .eq("channel", "flash")
        .order("display_order", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) return [] as FlashRow[];
      return ((data ?? []) as (FlashRow & { starts_at: string | null; expires_at: string | null })[])
        .filter((a) => (!a.starts_at || a.starts_at <= nowIso) && (!a.expires_at || a.expires_at > nowIso));
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const items = (announcements ?? []) as FlashRow[];

  const isMaintenance = !!general?.maintenance_mode && !bypass;
  if (isMaintenance) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-foreground">
        <div className="max-w-lg space-y-5">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full border border-border/60 bg-muted/40">
            <Wrench className="h-6 w-6" />
          </div>
          <h1 className="font-mono text-xs uppercase tracking-[0.32em] text-muted-foreground">Maintenance</h1>
          <p className="text-2xl font-semibold leading-snug">{general.maintenance_message || "We'll be right back."}</p>
          <p className="text-sm text-muted-foreground">Thanks for your patience. Please check back shortly.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <FlashBannerStrip items={items} />
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
