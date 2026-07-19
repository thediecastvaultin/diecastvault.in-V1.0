import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Bell, Trash2, X, Package, Gavel, AlertTriangle, Megaphone, CheckCheck, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useConfirm } from "@/components/ui/use-confirm";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";

type Notif = {
  id: string;
  kind: string | null;
  title: string;
  body: string | null;
  link: string | null;
  created_at: string;
  starts_at: string | null;
  expires_at: string | null;
};

type NotifWithRead = Notif & { read: boolean };

function kindMeta(kind: string | null | undefined) {
  const k = (kind ?? "").toLowerCase();
  if (k.includes("order"))     return { Icon: Package,        tone: "text-blue-400",    bg: "bg-blue-500/10",    label: "Order" };
  if (k.includes("auction"))   return { Icon: Gavel,          tone: "text-primary",     bg: "bg-primary/10",     label: "Auction" };
  if (k.includes("low_stock") || k.includes("out_of_stock") || k.includes("alert") || k.includes("warn"))
                               return { Icon: AlertTriangle,  tone: "text-amber-400",   bg: "bg-amber-500/10",   label: "Alert" };
  if (k.includes("announcement") || k.includes("promo"))
                               return { Icon: Megaphone,      tone: "text-fuchsia-400", bg: "bg-fuchsia-500/10", label: "News" };
  return { Icon: Sparkles, tone: "text-muted-foreground", bg: "bg-muted/60", label: "Info" };
}

export function NotificationsBell({ isStaff = false }: { isStaff?: boolean }) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const { confirm, confirmDialog } = useConfirm();
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const { data: notifs } = useQuery({
    queryKey: ["user-notifs", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const nowIso = new Date().toISOString();
      const [{ data: rows, error }, { data: reads }] = await Promise.all([
        supabase
          .from("admin_notifications")
          .select("id,kind,title,body,link,created_at,starts_at,expires_at")
          .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
          .or(`expires_at.is.null,expires_at.gt.${nowIso}`)
          .order("created_at", { ascending: false })
          .limit(50),
        supabase
          .from("notification_reads")
          .select("notification_id")
          .eq("user_id", user!.id),
      ]);
      if (error) throw error;
      const readSet = new Set((reads ?? []).map((r) => r.notification_id as string));
      return ((rows ?? []) as Notif[]).map((n) => ({ ...n, read: readSet.has(n.id) })) as NotifWithRead[];
    },
    refetchInterval: 60_000,
  });

  const markRead = useMutation({
    mutationFn: async (id: string) => {
      if (!user) return;
      await supabase.from("notification_reads").upsert(
        { notification_id: id, user_id: user.id },
        { onConflict: "notification_id,user_id" },
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-notifs", user?.id] }),
  });

  const markAll = useMutation({
    mutationFn: async () => {
      if (!user || !notifs) return;
      const unread = notifs.filter((n) => !n.read).map((n) => ({ notification_id: n.id, user_id: user.id }));
      if (unread.length === 0) return;
      await supabase.from("notification_reads").upsert(unread, { onConflict: "notification_id,user_id" });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-notifs", user?.id] }),
  });

  const deleteOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("admin_notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user-notifs", user?.id] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("admin_notifications").delete().not("id", "is", null);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["user-notifs", user?.id] });
      toast.success("Notifications cleared");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function handleDeleteAll() {
    const ok = await confirm({
      title: "Clear all notifications?",
      description: "Every notification in your panel will be permanently removed for all users.",
      confirmText: "Clear all",
      destructive: true,
    });
    if (ok) deleteAll.mutate();
  }

  const list = notifs ?? [];
  const unread = list.filter((n) => !n.read).length;
  const total = list.length;
  const shown = filter === "unread" ? list.filter((n) => !n.read) : list;

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="icon" className="relative h-10 w-10" aria-label="Notifications">
            <Bell className="h-4 w-4" />
            {unread > 0 ? (
              <span className="absolute right-1 top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-bold text-primary-foreground">
                {unread > 99 ? "99+" : unread}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>

        <PopoverContent
          align="end"
          sideOffset={10}
          className="w-[min(94vw,24rem)] overflow-hidden p-0 shadow-2xl sm:w-[26rem]"
        >
          {/* Header */}
          <div className="border-b border-border/60 bg-gradient-to-b from-muted/40 to-transparent px-4 pb-3 pt-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <div className="grid h-7 w-7 place-items-center rounded-lg bg-primary/15 text-primary">
                    <Bell className="h-3.5 w-3.5" />
                  </div>
                  <div className="text-sm font-black uppercase tracking-tight">Notifications</div>
                </div>
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
                  {total} total{unread > 0 ? ` · ${unread} unread` : " · all read"}
                </div>
              </div>
              {isStaff && total > 0 ? (
                <button
                  onClick={handleDeleteAll}
                  className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-destructive transition-colors hover:border-destructive/40 hover:bg-destructive/10"
                  title="Clear all (staff)"
                >
                  <Trash2 className="h-3 w-3" /> Clear
                </button>
              ) : null}
            </div>

            {/* Segmented filter + mark-all */}
            <div className="mt-3 flex items-center justify-between gap-2">
              <div className="inline-flex rounded-full border border-border/60 bg-background/40 p-0.5">
                {(["all", "unread"] as const).map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors ${
                      filter === f ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f === "all" ? `All (${total})` : `Unread (${unread})`}
                  </button>
                ))}
              </div>
              {unread > 0 ? (
                <button
                  onClick={() => markAll.mutate()}
                  className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-mono text-[10px] uppercase tracking-[0.22em] text-primary transition-colors hover:bg-primary/10"
                >
                  <CheckCheck className="h-3 w-3" /> Mark all read
                </button>
              ) : null}
            </div>
          </div>

          {/* List */}
          <div className="max-h-[70vh] overflow-y-auto sm:max-h-[28rem]">
            {shown.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
                <div className="grid h-12 w-12 place-items-center rounded-full bg-muted/50">
                  <Bell className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="mt-1 text-sm font-semibold">
                  {filter === "unread" ? "No unread notifications" : "You're all caught up"}
                </div>
                <div className="text-xs text-muted-foreground">
                  {filter === "unread" ? "New alerts will appear here." : "New notifications will show up here."}
                </div>
              </div>
            ) : (
              <ul className="divide-y divide-border/40">
                {shown.map((n) => {
                  const { Icon, tone, bg, label } = kindMeta(n.kind);
                  const timeAgo = formatDistanceToNow(new Date(n.created_at), { addSuffix: true });
                  return (
                    <li
                      key={n.id}
                      className={`group relative flex items-start gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 ${
                        n.read ? "" : "bg-primary/[0.04]"
                      }`}
                    >
                      {!n.read ? (
                        <span
                          aria-hidden
                          className="absolute left-0 top-0 h-full w-0.5 bg-primary"
                        />
                      ) : null}
                      <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${bg} ${tone}`}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <button
                        onClick={() => {
                          if (!n.read) markRead.mutate(n.id);
                          if (n.link) window.location.assign(n.link);
                        }}
                        className="min-w-0 flex-1 pr-6 text-left"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`font-mono text-[9px] uppercase tracking-[0.22em] ${tone}`}>{label}</span>
                          {!n.read ? (
                            <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary" aria-label="Unread" />
                          ) : null}
                        </div>
                        <div className={`mt-0.5 truncate text-sm ${n.read ? "font-medium text-foreground/85" : "font-semibold"}`}>
                          {n.title}
                        </div>
                        {n.body ? (
                          <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{n.body}</div>
                        ) : null}
                        <div className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                          {timeAgo}
                        </div>
                      </button>
                      {isStaff ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteOne.mutate(n.id); }}
                          className="absolute right-2 top-3 grid h-7 w-7 place-items-center rounded-full text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive sm:opacity-0 sm:group-hover:opacity-100"
                          aria-label="Delete notification"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </PopoverContent>
      </Popover>
      {confirmDialog}
    </>
  );
}
