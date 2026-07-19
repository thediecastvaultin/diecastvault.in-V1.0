export type FlashBannerItem = {
  id: string;
  title?: string | null;
  body?: string | null;
  link?: string | null;
};

export function flashBannerLabel(item: FlashBannerItem) {
  return (item.body?.trim() || item.title?.trim() || "");
}

export function FlashBannerStrip({
  items,
  animate = true,
  className = "",
}: {
  items: FlashBannerItem[];
  animate?: boolean;
  className?: string;
}) {
  const visible = items.filter((item) => flashBannerLabel(item));
  if (visible.length === 0) return null;

  const minCopies = animate ? Math.max(4, Math.ceil(6 / visible.length)) : 1;
  const looped: FlashBannerItem[] = [];
  for (let i = 0; i < minCopies; i++) looped.push(...visible);
  const lanes = animate ? [0, 1] : [0];

  return (
    <div
      className={`group relative w-full overflow-hidden border-b ${className}`}
      style={{ background: "#F3F3F3", borderColor: "rgba(0,0,0,0.08)" }}
    >
      <div
        className={`flex w-max whitespace-nowrap py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.22em] ${animate ? "animate-marquee group-hover:[animation-play-state:paused]" : ""}`}
        style={{ color: "#111111" }}
      >
        {lanes.map((lane) => (
          <span key={lane} className="flex items-center pr-12" aria-hidden={lane === 1}>
            {looped.map((item, index) => {
              const label = flashBannerLabel(item);
              const showSeparator = animate || index < looped.length - 1;
              return (
                <span key={`${lane}-${item.id}-${index}`} className="flex items-center">
                  {item.link ? (
                    <a href={item.link} className="hover:underline" style={{ color: "#111111" }}>{label}</a>
                  ) : (
                    <span>{label}</span>
                  )}
                  {showSeparator ? (
                    <span
                      className="mx-8 text-[13px] leading-none"
                      style={{ color: "#111111" }}
                      aria-hidden
                    >
                      ◆
                    </span>
                  ) : null}
                </span>
              );
            })}
          </span>
        ))}
      </div>
    </div>
  );
}