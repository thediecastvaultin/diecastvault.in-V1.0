import { useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Upload, X, GripVertical, Loader2 } from "lucide-react";

export function ImageUploader({ urls, onChange }: { urls: string[]; onChange: (next: string[]) => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setBusy(true);
    try {
      const uploaded: string[] = [];
      for (const file of Array.from(files)) {
        if (!file.type.startsWith("image/")) { toast.error(`${file.name} isn't an image`); continue; }
        if (file.size > 5 * 1024 * 1024) { toast.error(`${file.name} > 5MB`); continue; }
        const ext = file.name.split(".").pop() ?? "jpg";
        const path = `${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage.from("product-images").upload(path, file, { upsert: false, contentType: file.type });
        if (upErr) { toast.error(upErr.message); continue; }
        const { data: signed, error: sErr } = await supabase.storage.from("product-images").createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
        if (sErr || !signed) { toast.error("Could not create URL"); continue; }
        uploaded.push(signed.signedUrl);
      }
      if (uploaded.length) onChange([...urls, ...uploaded]);
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function remove(i: number) { onChange(urls.filter((_, idx) => idx !== i)); }
  function reorder(from: number, to: number) {
    if (from === to) return;
    const next = [...urls];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => { e.preventDefault(); }}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
        className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-border/70 bg-muted/20 p-6 text-center"
      >
        <Upload className="h-5 w-5 text-muted-foreground" />
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Drop images or</div>
        <Button type="button" size="sm" variant="outline" onClick={() => inputRef.current?.click()} disabled={busy}>
          {busy ? <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Uploading…</> : "Choose files"}
        </Button>
        <input ref={inputRef} type="file" accept="image/*" multiple hidden onChange={(e) => handleFiles(e.target.files)} />
        <div className="text-[10px] text-muted-foreground/70">Up to 5MB each. First image is the cover.</div>
      </div>
      {urls.length > 0 ? (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {urls.map((u, i) => (
            <li
              key={u + i}
              draggable
              onDragStart={() => setDragIdx(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={() => { if (dragIdx !== null) reorder(dragIdx, i); setDragIdx(null); }}
              className="group relative aspect-square overflow-hidden rounded-md border border-border/60 bg-muted"
            >
              <img src={u} alt="" className="h-full w-full object-cover" />
              {i === 0 ? (
                <span className="absolute left-1 top-1 rounded bg-primary/90 px-1 py-0.5 font-mono text-[8px] uppercase tracking-widest text-primary-foreground">Cover</span>
              ) : null}
              <button
                type="button"
                onClick={() => remove(i)}
                className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-background/80 text-foreground opacity-0 transition-opacity group-hover:opacity-100"
                aria-label="Remove image"
              >
                <X className="h-3 w-3" />
              </button>
              <span className="absolute bottom-1 left-1 grid h-5 w-5 place-items-center rounded bg-background/70 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" aria-hidden>
                <GripVertical className="h-3 w-3" />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}