import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Star, ImagePlus, X } from "lucide-react";
import { toast } from "sonner";

type Review = {
  id: string;
  user_id: string;
  rating: number;
  title: string | null;
  body: string | null;
  created_at: string;
  approved: boolean;
  image_url: string | null;
  reviewer_name?: string | null;
};

export function ReviewsSection({ productId }: { productId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [rating, setRating] = useState(5);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const { data: reviews } = useQuery({
    queryKey: ["reviews", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reviews")
        .select("id, user_id, rating, title, body, created_at, approved, image_url")
        .eq("product_id", productId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = (data ?? []) as Review[];
      const ids = Array.from(new Set(rows.map((r) => r.user_id)));
      if (ids.length === 0) return rows;
      const { data: profs } = await supabase.from("profiles").select("id, display_name").in("id", ids);
      const map = new Map((profs ?? []).map((p: any) => [p.id, p.display_name as string | null]));
      return rows.map((r) => ({ ...r, reviewer_name: map.get(r.user_id) ?? "Collector" }));
    },
  });

  async function handleUpload(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Not an image");
    if (file.size > 5 * 1024 * 1024) return toast.error("Max 5MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `reviews/${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { contentType: file.type });
      if (upErr) return toast.error(upErr.message);
      const { data: signed, error: sErr } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr || !signed) return toast.error("Upload failed");
      setImageUrl(signed.signedUrl);
    } finally { setUploading(false); }
  }

  const submit = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sign in to review");
      const { error } = await supabase.from("reviews").insert({
        product_id: productId, user_id: user.id, rating, title: title || null, body: body || null, image_url: imageUrl,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reviews", productId] });
      setTitle(""); setBody(""); setRating(5); setImageUrl(null);
      toast.success("Thanks! Your review will be published soon ✨");
    },
    onError: (e: Error) => {
      const msg = e.message.includes("row-level security")
        ? "You can review this car once you've ordered it."
        : e.message.includes("duplicate")
        ? "You've already reviewed this car."
        : e.message;
      toast.error(msg);
    },
  });

  const list = reviews ?? [];
  const publicList = list.filter((r) => r.approved);
  const avg = publicList.length ? publicList.reduce((s, r) => s + r.rating, 0) / publicList.length : 0;
  const myReview = user ? list.find((r) => r.user_id === user.id) : null;

  return (
    <section id="reviews" className="mx-auto max-w-7xl px-4 py-16 scroll-mt-24">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <div className="font-mono text-[10px] uppercase tracking-[0.24em] text-muted-foreground">§ Reviews</div>
          <h2 className="mt-2 text-3xl font-black uppercase tracking-tight md:text-4xl">
            What collectors <span className="font-display italic font-normal normal-case text-muted-foreground">say</span>
          </h2>
        </div>
        {publicList.length > 0 ? (
          <div className="text-right">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((n) => (
                <Star key={n} className={`h-4 w-4 ${n <= Math.round(avg) ? "fill-primary text-primary" : "text-muted-foreground"}`} />
              ))}
            </div>
            <div className="mt-1 font-mono text-[11px] uppercase tracking-[0.22em] text-muted-foreground">
              {avg.toFixed(1)} · {publicList.length} review{publicList.length === 1 ? "" : "s"}
            </div>
          </div>
        ) : null}
      </div>

      <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
        <div className="rounded-2xl border border-border/70 bg-card/40 p-6">
          <h3 className="font-mono text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Write a review</h3>
          {!user ? (
            <p className="mt-4 text-sm text-muted-foreground">Sign in to leave a review. Only verified buyers can rate.</p>
          ) : myReview ? (
            <p className="mt-4 text-sm text-muted-foreground">
              {myReview.approved
                ? "You already reviewed this car — thanks!"
                : "Thanks! Your review will be published soon ✨"}
            </p>
          ) : (
            <form onSubmit={(e) => { e.preventDefault(); submit.mutate(); }} className="mt-4 space-y-4">
              <div>
                <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Rating</div>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" onClick={() => setRating(n)} aria-label={`${n} stars`}>
                      <Star className={`h-6 w-6 ${n <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                    </button>
                  ))}
                </div>
              </div>
              <Input placeholder="Headline (optional)" value={title} onChange={(e) => setTitle(e.target.value)} />
              <Textarea placeholder="What did you think?" value={body} onChange={(e) => setBody(e.target.value)} rows={4} />
              <div>
                {imageUrl ? (
                  <div className="relative inline-block">
                    <img src={imageUrl} alt="" className="h-24 w-24 rounded-md object-cover" />
                    <button type="button" onClick={() => setImageUrl(null)} className="absolute -right-2 -top-2 grid h-6 w-6 place-items-center rounded-full bg-background border border-border">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-border/70 px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted">
                    <ImagePlus className="h-3.5 w-3.5" />
                    {uploading ? "Uploading…" : "Add a photo (optional)"}
                    <input type="file" accept="image/*" hidden disabled={uploading} onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0])} />
                  </label>
                )}
              </div>
              <Button type="submit" disabled={submit.isPending} className="rounded-full">
                {submit.isPending ? "Posting…" : "Post review"}
              </Button>
            </form>
          )}
        </div>

        <div className="space-y-4">
          {publicList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border/60 p-10 text-center text-sm text-muted-foreground">
              No reviews yet. Be the first.
            </div>
          ) : publicList.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border/70 bg-card/40 p-5">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{r.reviewer_name || "Collector"}</div>
                  <div className="mt-1 flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star key={n} className={`h-3.5 w-3.5 ${n <= r.rating ? "fill-primary text-primary" : "text-muted-foreground"}`} />
                    ))}
                  </div>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground whitespace-nowrap">
                  {new Date(r.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
              {r.title ? <div className="mt-3 text-sm font-semibold">{r.title}</div> : null}
              {r.body ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.body}</p> : null}
              {r.image_url ? (
                <a href={r.image_url} target="_blank" rel="noreferrer" className="mt-3 block">
                  <img src={r.image_url} alt="" className="max-h-64 rounded-md border border-border/60 object-cover" />
                </a>
              ) : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
