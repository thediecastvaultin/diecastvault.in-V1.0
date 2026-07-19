import { useRef, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Upload, Loader2, Trash2, RefreshCw, Link2, Check } from "lucide-react";

type Props = {
  label: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
  disabled?: boolean;
  aspect?: "video" | "square" | "wide" | "tall";
  previewClassName?: string;
  bucket?: string;
  accept?: string;
  maxMB?: number;
  extra?: ReactNode;
};

const ASPECTS: Record<NonNullable<Props["aspect"]>, string> = {
  video: "aspect-video",
  square: "aspect-square",
  wide: "aspect-[21/9]",
  tall: "aspect-[3/4]",
};

export function ImageDropField({
  label,
  hint,
  value,
  onChange,
  disabled,
  aspect = "video",
  previewClassName = "",
  bucket = "product-images",
  accept = "image/*",
  maxMB = 5,
  extra,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [urlMode, setUrlMode] = useState(false);
  const [urlDraft, setUrlDraft] = useState(value);

  async function upload(file: File) {
    if (!file.type.startsWith("image/")) return toast.error("Please choose an image file");
    if (file.size > maxMB * 1024 * 1024) return toast.error(`Image is over ${maxMB}MB`);
    setBusy(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: false,
        contentType: file.type,
      });
      if (error) return toast.error(error.message);
      const { data, error: sErr } = await supabase.storage
        .from(bucket)
        .createSignedUrl(path, 60 * 60 * 24 * 365 * 10);
      if (sErr || !data) return toast.error("Could not generate URL");
      onChange(data.signedUrl);
      toast.success("Image uploaded");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    upload(files[0]);
  }

  const hasImage = !!value;

  return (
    <div className="rounded-xl border border-border/60 bg-background/40 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-semibold">{label}</div>
          {hint ? <div className="mt-0.5 text-xs text-muted-foreground">{hint}</div> : null}
        </div>
        <button
          type="button"
          onClick={() => { setUrlDraft(value); setUrlMode((s) => !s); }}
          className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-background/60 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <Link2 className="h-3 w-3" /> {urlMode ? "Upload" : "URL"}
        </button>
      </div>

      {urlMode ? (
        <div className="flex gap-2">
          <Input
            value={urlDraft}
            placeholder="https://…"
            disabled={disabled}
            onChange={(e) => setUrlDraft(e.target.value)}
          />
          <Button
            size="sm"
            disabled={disabled || urlDraft === value}
            onClick={() => { onChange(urlDraft.trim()); setUrlMode(false); }}
          >
            <Check className="mr-1 h-3.5 w-3.5" /> Use URL
          </Button>
        </div>
      ) : hasImage ? (
        <div className="space-y-3">
          <div className={`relative overflow-hidden rounded-lg border border-border/60 bg-muted ${ASPECTS[aspect]} ${previewClassName}`}>
            <img src={value} alt={label} className="h-full w-full object-cover" />
            {busy ? (
              <div className="absolute inset-0 grid place-items-center bg-background/70">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={disabled || busy}
              onClick={() => inputRef.current?.click()}
            >
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Replace
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={disabled || busy}
              onClick={() => onChange("")}
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Remove
            </Button>
            {extra}
          </div>
        </div>
      ) : (
        <label
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => { e.preventDefault(); setDragging(false); onFiles(e.dataTransfer.files); }}
          onClick={() => inputRef.current?.click()}
          className={`flex ${ASPECTS[aspect]} cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
            dragging
              ? "border-primary bg-primary/5"
              : "border-border/70 bg-muted/20 hover:border-primary/50 hover:bg-muted/40"
          }`}
        >
          {busy ? (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          ) : (
            <>
              <div className="grid h-10 w-10 place-items-center rounded-full bg-background/70 text-muted-foreground">
                <Upload className="h-4 w-4" />
              </div>
              <div className="text-sm font-medium">Drop image or click to upload</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                PNG · JPG · WebP · up to {maxMB}MB
              </div>
            </>
          )}
        </label>
      )}

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={(e) => onFiles(e.target.files)}
      />
    </div>
  );
}
