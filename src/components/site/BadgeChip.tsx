import { badgeIcon } from "@/lib/collector";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type BadgeInfo = {
  code: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  earned_at?: string;
};

export function BadgeChip({ badge, showDate }: { badge: BadgeInfo; showDate?: boolean }) {
  const Icon = badgeIcon(badge.icon);
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="group flex items-center gap-2 rounded-lg border border-border/60 bg-card/60 px-3 py-2 transition-colors hover:border-primary/50">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-primary">
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <div className="truncate text-xs font-bold">{badge.name}</div>
              {showDate && badge.earned_at ? (
                <div className="font-mono text-[9px] uppercase tracking-widest text-muted-foreground">
                  {new Date(badge.earned_at).toLocaleDateString("en-IN")}
                </div>
              ) : (
                <div className="truncate text-[10px] text-muted-foreground">{badge.category}</div>
              )}
            </div>
          </div>
        </TooltipTrigger>
        <TooltipContent><p className="max-w-[220px] text-xs">{badge.description}</p></TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
