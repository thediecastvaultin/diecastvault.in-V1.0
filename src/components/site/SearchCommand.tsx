import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { formatPrice } from "@/lib/format";

type Hit = {
  id: string;
  slug: string;
  name: string;
  series: string;
  year: number | null;
  price_cents: number;
  image_urls: string[];
};

export function SearchCommand({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const [q, setQ] = useState("");
  const navigate = useNavigate();

  // debounce
  const [debounced, setDebounced] = useState("");
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 200);
    return () => clearTimeout(id);
  }, [q]);

  const { data: hits, isFetching } = useQuery({
    enabled: debounced.length > 0,
    queryKey: ["search", debounced],
    queryFn: async (): Promise<Hit[]> => {
      const terms = debounced
        .split(/\s+/)
        .filter(Boolean)
        .map((t) => t.replace(/[^\w]/g, "") + ":*")
        .join(" & ");
      if (!terms) return [];
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, series, year, price_cents, image_urls")
        .textSearch("search_vector", terms, { config: "simple" })
        .limit(8);
      if (error) throw error;
      return (data ?? []) as Hit[];
    },
  });

  // recent / featured when empty
  const { data: featured } = useQuery({
    enabled: open && debounced.length === 0,
    queryKey: ["search-featured"],
    queryFn: async (): Promise<Hit[]> => {
      const { data, error } = await supabase
        .from("products")
        .select("id, slug, name, series, year, price_cents, image_urls")
        .eq("featured", true)
        .limit(6);
      if (error) throw error;
      return (data ?? []) as Hit[];
    },
  });

  function go(slug: string) {
    onOpenChange(false);
    setQ("");
    navigate({ to: "/shop/$slug", params: { slug } });
  }

  const list = debounced ? hits ?? [] : featured ?? [];

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search castings, series, years…"
        value={q}
        onValueChange={setQ}
      />
      <CommandList>
        {debounced && !isFetching && list.length === 0 ? (
          <CommandEmpty>No matches for "{debounced}"</CommandEmpty>
        ) : null}
        {list.length > 0 && (
          <CommandGroup heading={debounced ? "Results" : "Featured drops"}>
            {list.map((h) => (
              <CommandItem
                key={h.id}
                value={`${h.name} ${h.series} ${h.year ?? ""}`}
                onSelect={() => go(h.slug)}
                className="gap-3"
              >
                <div className="h-10 w-10 shrink-0 overflow-hidden rounded bg-muted">
                  {h.image_urls[0] ? (
                    <img src={h.image_urls[0]} alt="" className="h-full w-full object-cover" />
                  ) : null}
                </div>
                <div className="flex flex-1 items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-semibold">{h.name}</div>
                    <div className="truncate text-xs text-muted-foreground">
                      {h.series} · {h.year ?? "—"}
                    </div>
                  </div>
                  <div className="font-mono text-xs">{formatPrice(h.price_cents)}</div>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
