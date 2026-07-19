import { Check, Clock, CreditCard, Package, Truck, Home, XCircle } from "lucide-react";
import type { ComponentType } from "react";

type Stage = "pending" | "paid" | "packed" | "shipped" | "delivered";

const STAGES: { key: Stage; label: string; sub: string; icon: ComponentType<{ className?: string }> }[] = [
  { key: "pending",   label: "Placed",    sub: "Order received",         icon: Clock },
  { key: "paid",      label: "Confirmed", sub: "Payment verified",       icon: CreditCard },
  { key: "packed",    label: "Packed",    sub: "Ready to ship",          icon: Package },
  { key: "shipped",   label: "Shipped",   sub: "On the way",             icon: Truck },
  { key: "delivered", label: "Delivered", sub: "Handed over",            icon: Home },
];

export function OrderTimeline({
  status,
  createdAt,
  orientation = "vertical",
  compact = false,
}: {
  status: string;
  createdAt?: string | null;
  orientation?: "vertical" | "horizontal";
  compact?: boolean;
}) {
  const cancelled = status === "cancelled";
  const idx = cancelled ? 1 : Math.max(0, STAGES.findIndex((s) => s.key === status));

  if (orientation === "horizontal") {
    return (
      <div className="w-full">
        <div className="flex items-start">
          {STAGES.map((s, i) => {
            const done = i < idx && !cancelled;
            const current = i === idx && !cancelled;
            const upcoming = !done && !current;
            const Icon = done ? Check : s.icon;
            return (
              <div key={s.key} className="flex min-w-0 flex-1 items-start">
                <div className="flex min-w-0 flex-1 flex-col items-center text-center">
                  <div className="relative">
                    <div
                      className={[
                        "grid h-10 w-10 place-items-center rounded-full border-2 transition-all",
                        done && "border-primary bg-primary text-primary-foreground",
                        current && "border-primary bg-background text-primary ring-4 ring-primary/15",
                        upcoming && "border-border/70 bg-muted/40 text-muted-foreground",
                      ].filter(Boolean).join(" ")}
                    >
                      <Icon className="h-4 w-4" />
                    </div>
                    {current ? (
                      <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-background bg-primary" />
                    ) : null}
                  </div>
                  <div className={`mt-2.5 text-[11px] font-semibold leading-tight tracking-tight ${done || current ? "text-foreground" : "text-muted-foreground"}`}>
                    {s.label}
                  </div>
                  {!compact ? (
                    <div className="mt-0.5 hidden text-[10px] leading-tight text-muted-foreground sm:block">{s.sub}</div>
                  ) : null}
                </div>
                {i < STAGES.length - 1 ? (
                  <div className="relative mt-5 h-0.5 flex-1 overflow-hidden rounded-full bg-border/70">
                    <div
                      className={`absolute inset-y-0 left-0 rounded-full bg-primary transition-all duration-500 ${
                        i < idx && !cancelled ? "w-full" : i === idx - 0 && current ? "w-1/2" : "w-0"
                      }`}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
        {cancelled ? (
          <div className="mt-4 flex items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-semibold text-destructive">
            <XCircle className="h-3.5 w-3.5" /> This order was cancelled
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <ol className="relative">
      {STAGES.map((s, i) => {
        const done = i < idx && !cancelled;
        const current = i === idx && !cancelled;
        const upcoming = !done && !current;
        const Icon = done ? Check : s.icon;
        const isLast = i === STAGES.length - 1;
        return (
          <li key={s.key} className="relative flex gap-4 pb-6 last:pb-0">
            {!isLast ? (
              <span
                aria-hidden
                className={`absolute left-[19px] top-10 bottom-0 w-px ${done ? "bg-primary" : "bg-border/70"}`}
              />
            ) : null}
            <div className="relative">
              <div
                className={[
                  "relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 transition-all",
                  done && "border-primary bg-primary text-primary-foreground",
                  current && "border-primary bg-background text-primary ring-4 ring-primary/15",
                  upcoming && "border-border/70 bg-background text-muted-foreground",
                ].filter(Boolean).join(" ")}
              >
                <Icon className="h-4 w-4" />
              </div>
              {current ? (
                <span className="absolute -right-0.5 -top-0.5 z-10 h-2.5 w-2.5 animate-pulse rounded-full border-2 border-background bg-primary" />
              ) : null}
            </div>
            <div className="min-w-0 flex-1 pt-1.5">
              <div className="flex flex-wrap items-baseline gap-2">
                <div className={`text-sm font-semibold leading-tight ${upcoming ? "text-muted-foreground" : "text-foreground"}`}>
                  {s.label}
                </div>
                {current ? (
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase tracking-[0.18em] text-primary">
                    Current
                  </span>
                ) : null}
              </div>
              {!compact ? (
                <div className="mt-0.5 text-xs text-muted-foreground">{s.sub}</div>
              ) : null}
              {i === 0 && createdAt ? (
                <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
                  {new Date(createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" })}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
      {cancelled ? (
        <li className="relative flex gap-4">
          <div className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-destructive bg-destructive text-destructive-foreground">
            <XCircle className="h-4 w-4" />
          </div>
          <div className="pt-1.5">
            <div className="text-sm font-semibold text-destructive">Cancelled</div>
            <div className="mt-0.5 text-xs text-muted-foreground">This order was cancelled</div>
          </div>
        </li>
      ) : null}
    </ol>
  );
}
