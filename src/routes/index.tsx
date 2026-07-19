import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { SiteShell } from "@/components/site/SiteShell";
import { ProductCard, type ProductCardData } from "@/components/site/ProductCard";
import { Button } from "@/components/ui/button";
import { useSiteSettings } from "@/hooks/use-site-settings";
import { ArrowRight, Flame, Sparkles, Trophy, Zap, Gem } from "lucide-react";
import heroCar from "@/assets/featured-skyline.jpg";
import mainlineLogo from "@/assets/series-mainline.png";
import premiumLogo from "@/assets/series-premium.png";
import redlineLogo from "@/assets/series-redline.png";
import teamTransportLogo from "@/assets/series-teamtransport.png";
import treasureHuntLogo from "@/assets/series-treasurehunt.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "The Diecast Vault — Hot Wheels Die-Cast Cars, Premium & Treasure Hunts" },
      { name: "description", content: "Shop Mainline, Premium, Team Transport, Redlines and Treasure Hunt Hot Wheels die-cast cars at The Diecast Vault. New drops weekly." },
      { property: "og:title", content: "The Diecast Vault — Hot Wheels Die-Cast Cars" },
      { property: "og:description", content: "Independent Hot Wheels shop for collectors — Mainlines, Premiums, Team Transports, Treasure Hunts." },
      { property: "og:type", content: "website" },
    ],
  }),
  component: HomePage,
});

const CATEGORIES = [
  { name: "Mainline", tag: "Daily drivers", icon: Zap, image: mainlineLogo, no: "01", imgClass: "h-20 w-28" },
  { name: "Premium", tag: "Rubber tires · metal base", icon: Sparkles, image: premiumLogo, no: "02", imgClass: "h-20 w-28" },
  { name: "Team Transport", tag: "Hauler + car pair", icon: Trophy, image: teamTransportLogo, no: "03", imgClass: "h-24 w-36 -top-1" },
  { name: "Red Line Club", tag: "Vintage · 1968–1977", icon: Flame, image: redlineLogo, no: "04", imgClass: "h-14 w-16" },
  { name: "Treasure Hunts", tag: "Rare finds", icon: Gem, image: treasureHuntLogo, no: "05", imgClass: "h-12 w-12" },
];

const TICKER = [
  "New drop every Friday",
  "Mint carded",
  "Ships in 24 hours across India",
  "Authenticity guaranteed",
  "Treasure hunts in stock",
  "Cash on delivery available",
];

function HomePage() {
  const { hero, homepageSections } = useSiteSettings();
  const carImg = hero.carImageUrl || heroCar;
  const { data: featured } = useQuery({
    queryKey: ["products", "featured"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, series, year, price_cents, stock_quantity, low_stock_threshold, rarity, image_urls")
        .eq("featured", true)
        .order("created_at", { ascending: false })
        .limit(8);
      if (error) throw error;
      return data as ProductCardData[];
    },
  });

  const { data: accessories } = useQuery({
    queryKey: ["home-accessories"],
    queryFn: async () => {
      const { data: cat } = await supabase
        .from("product_categories")
        .select("id")
        .eq("slug", "accessories")
        .maybeSingle();
      if (!cat) return [] as ProductCardData[];
      const { data } = await supabase
        .from("products")
        .select("id, slug, name, series, year, price_cents, stock_quantity, low_stock_threshold, rarity, image_urls")
        .eq("status", "published")
        .eq("category_id", cat.id)
        .order("created_at", { ascending: false })
        .limit(4);
      return (data ?? []) as ProductCardData[];
    },
  });

  return (
    <SiteShell>
      {/* Hero — editorial */}
      <section className="relative overflow-hidden border-b border-border/60 grain">
        {hero.bgImageUrl ? (
          <div className="absolute inset-0" style={{ backgroundImage: `url(${hero.bgImageUrl})`, backgroundSize: `${Math.round(hero.imageScale * 100)}%`, backgroundPosition: hero.imagePosition }} aria-hidden />
        ) : null}
        <div className="absolute inset-0" style={{ background: "var(--gradient-hero)", opacity: hero.bgImageUrl ? hero.overlayOpacity : 1 }} aria-hidden />
        <div
          className="absolute inset-0 opacity-60"
          style={{
            backgroundImage:
              "radial-gradient(60% 55% at 85% 15%, oklch(0.2 0 0 / 0.55), transparent 60%), radial-gradient(55% 60% at 10% 90%, oklch(0.14 0 0 / 0.6), transparent 60%)",
          }}
          aria-hidden
        />
        {/* faint grid */}
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              "linear-gradient(to right, oklch(1 0 0 / 0.6) 1px, transparent 1px), linear-gradient(to bottom, oklch(1 0 0 / 0.6) 1px, transparent 1px)",
            backgroundSize: "80px 80px",
          }}
          aria-hidden
        />

        <div className="relative mx-auto max-w-7xl px-4 pt-10 md:pt-16">
          {/* meta row */}
          <div className="flex items-center justify-between gap-6 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            <span>Est. 2024 — Collector Owned</span>
            <span className="hidden md:inline">Vol. 07 · The Diecast Vault Quarterly</span>
            <span>N° 001</span>
          </div>
          <div className="mt-4 h-px w-full bg-border/70" />

          <div className="grid items-start gap-10 py-10 md:grid-cols-12 md:gap-8 md:py-16">
            {/* left copy */}
            <div className="md:col-span-7">
              <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-border bg-background/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-foreground/80 backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground animate-pulse" />
                Friday drop · live now
              </div>
              {hero.heading ? (
                <h1 className="text-[3.25rem] font-black uppercase leading-[0.86] tracking-[-0.03em] md:text-[6.5rem]">{hero.heading}</h1>
              ) : (
                <h1 className="text-[3.25rem] font-black uppercase leading-[0.86] tracking-[-0.03em] md:text-[6.5rem]">
                  {hero.line1}
                  <span className="block">
                    {hero.line2Prefix ? <>{hero.line2Prefix} </> : null}
                    {hero.line2Italic ? (
                      <span className="font-display italic font-normal normal-case tracking-tight text-muted-foreground">
                        {hero.line2Italic}
                      </span>
                    ) : null}
                    {hero.line2Suffix ? <> {hero.line2Suffix}</> : null}
                  </span>
                </h1>
              )}
              <p className="mt-8 max-w-md text-base leading-relaxed text-muted-foreground md:text-lg">
                {hero.subtitle}
              </p>

              <div className="mt-9 flex flex-wrap items-center gap-4">
                <Button asChild size="lg" className="group h-12 rounded-full bg-primary px-6 text-primary-foreground hover:bg-primary/90 shadow-[var(--shadow-glow)]">
                  <a href={hero.ctaUrl || "/shop"}>
                    {hero.ctaText}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </a>
                </Button>
                <Link
                  to="/shop"
                  className="story-link font-mono text-xs uppercase tracking-[0.2em] text-foreground/80 hover:text-foreground"
                >
                  Browse treasure hunts →
                </Link>
              </div>

              <dl className="mt-14 grid max-w-lg grid-cols-3 gap-6 border-t border-border/70 pt-6">
                {[
                  ["500+", "in the vault"],
                  ["24h", "ships next day"],
                  ["100%", "authenticity"],
                ].map(([k, v]) => (
                  <div key={k}>
                    <dt className="font-display text-4xl leading-none text-foreground">{k}</dt>
                    <dd className="mt-2 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {/* right image collage */}
            <div className="relative flex justify-center md:col-span-5 md:mt-16 md:pl-4">
              {/* soft grey glow behind the card */}
              <div
                className="pointer-events-none absolute left-1/2 top-1/2 h-[120%] w-[120%] -translate-x-1/2 -translate-y-1/2 rounded-full opacity-70 blur-3xl"
                style={{
                  background:
                    "radial-gradient(closest-side, oklch(0.55 0 0 / 0.55), oklch(0.3 0 0 / 0.25) 55%, transparent 75%)",
                }}
                aria-hidden
              />
              <div className="relative w-full max-w-[520px] rotate-[1.5deg]">
                <div className="overflow-hidden rounded-2xl border border-border/70 bg-card shadow-[var(--shadow-card)]">
                <img
                  src={carImg}
                  alt="Featured die-cast car"
                  width={1280}
                  height={768}
                  draggable={false}
                  onContextMenu={(e) => e.preventDefault()}
                  className="pointer-events-none h-full w-full select-none object-cover [-webkit-user-drag:none]"
                />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* marquee ticker */}
        <div className="relative border-y border-border/70 bg-background/30 backdrop-blur">
          <div className="flex overflow-hidden py-3">
            <div className="flex min-w-max animate-marquee gap-10 pr-10 font-mono text-[11px] uppercase tracking-[0.22em] text-foreground/70">
              {[...TICKER, ...TICKER, ...TICKER].map((t, i) => (
                <span key={i} className="flex items-center gap-10">
                  <span>{t}</span>
                  <span className="text-foreground/30">◆</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Categories — editorial index */}
      <section className="mx-auto max-w-7xl px-4 py-16 md:py-20">
        <div className="mb-8 flex items-end justify-between gap-6 md:mb-10">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">§ Index — Browse by series</div>
            <h2 className="mt-3 text-4xl font-black uppercase tracking-tight md:text-6xl">
              Pick your <span className="font-display italic font-normal normal-case text-muted-foreground">lane</span>
            </h2>
          </div>
          <Link to="/shop" className="hidden font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground md:inline">
            View all →
          </Link>
        </div>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border/70 bg-border/70 sm:grid-cols-2 lg:grid-cols-5">
          {CATEGORIES.map((c) => {
            const Icon = c.icon;
            return (
              <Link
                key={c.name}
                to="/shop"
                search={{ series: c.name } as never}
                className="group relative flex min-h-[220px] flex-col justify-between overflow-hidden bg-card p-6 transition-colors hover:bg-secondary"
              >
                {c.image ? (
                  <img
                    src={c.image}
                    alt=""
                    aria-hidden
                    className={`pointer-events-none absolute right-3 top-3 object-contain object-right rotate-[-8deg] opacity-95 drop-shadow-[0_6px_20px_rgba(0,0,0,0.45)] transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110 ${c.imgClass}`}
                  />
                ) : null}
                <div className="flex items-start justify-between">
                  <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">N° {c.no}</span>
                  {c.image ? null : <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-foreground" />}
                </div>
                <div>
                  <div className="font-display text-3xl leading-none">{c.name}</div>
                  <div className="mt-2 text-xs text-muted-foreground">{c.tag}</div>
                  <div className="mt-5 inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.22em] text-foreground opacity-0 transition-opacity group-hover:opacity-100">
                    Explore <ArrowRight className="h-3 w-3" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Featured / New Arrivals */}
      {homepageSections.show_featured ? (
      <section className="mx-auto max-w-7xl px-4 pb-16 md:pb-20">
        <div className="mb-8 flex items-end justify-between gap-6 md:mb-10">
          <div>
            <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">§ On the track</div>
            <h2 className="mt-3 text-4xl font-black uppercase tracking-tight md:text-6xl">
              New <span className="font-display italic font-normal normal-case text-muted-foreground">arrivals</span>
            </h2>
          </div>
          <Link to="/shop" className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground">
            Shop all →
          </Link>
        </div>
        {featured && featured.length > 0 ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:gap-6">
            {featured.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/70 p-16 text-center">
            <div className="font-display text-3xl italic text-muted-foreground">The vault is being restocked.</div>
            <div className="mt-2 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Check back Friday</div>
          </div>
        )}
      </section>
      ) : null}

      {/* Accessories */}
      {homepageSections.show_accessories && accessories && accessories.length > 0 ? (
        <section className="mx-auto max-w-7xl px-4 pb-16 md:pb-20">
          <div className="mb-8 flex items-end justify-between gap-6">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">§ Care kit</div>
              <h2 className="mt-3 text-4xl font-black uppercase tracking-tight md:text-5xl">
                Keep them <span className="font-display italic font-normal normal-case text-muted-foreground">mint</span>
              </h2>
            </div>
            <Link to="/accessories" className="font-mono text-[11px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground">
              All accessories →
            </Link>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4 xl:gap-6">
            {accessories.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        </section>
      ) : null}

      {/* Manifesto strip */}
      <section className="border-t border-border/70">
        <div className="mx-auto max-w-7xl px-4 py-20">
          <div className="grid gap-10 md:grid-cols-12">
            <div className="md:col-span-4">
              <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">§ House rules</div>
              <div className="mt-4 font-display text-4xl italic leading-tight">
                Curated,<br />not stocked.
              </div>
            </div>
            <div className="md:col-span-8 grid gap-8 sm:grid-cols-3 border-t border-border/70 pt-8 md:border-l md:border-t-0 md:pl-10 md:pt-0">
              {[
                ["01", "Hand-picked", "Every casting inspected on the card. No dings, no bends, no crushed blisters."],
                ["02", "Fair pricing", "Retail plus a modest markup — never eBay hype pricing."],
                ["03", "Ships fast", "Orders before 2pm ship next business day in protective mailers."],
              ].map(([n, t, d]) => (
                <div key={n}>
                  <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">N° {n}</div>
                  <div className="mt-3 font-display text-2xl">{t}</div>
                  <p className="mt-2 text-sm text-muted-foreground">{d}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </SiteShell>
  );
}