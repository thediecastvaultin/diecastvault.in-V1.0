import { Share2, Link2, Facebook, Instagram, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

export function ShareMenu({ url, title }: { url?: string; title: string }) {
  const shareUrl = url ?? (typeof window !== "undefined" ? window.location.href : "");
  const text = encodeURIComponent(`${title} — ${shareUrl}`);
  const enc = encodeURIComponent(shareUrl);

  async function copy() {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast.success("Link copied");
    } catch {
      toast.error("Couldn't copy link");
    }
  }

  function open(u: string) {
    window.open(u, "_blank", "noopener,noreferrer");
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-12 w-12 rounded-full" aria-label="Share">
          <Share2 className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onClick={copy} className="gap-2">
          <Link2 className="h-4 w-4" /> Copy link
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(`https://wa.me/?text=${text}`)} className="gap-2">
          <MessageCircle className="h-4 w-4" /> WhatsApp
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => open(`https://www.facebook.com/sharer/sharer.php?u=${enc}`)} className="gap-2">
          <Facebook className="h-4 w-4" /> Facebook
        </DropdownMenuItem>
        <DropdownMenuItem onClick={async () => { await copy(); open("https://www.instagram.com/"); }} className="gap-2">
          <Instagram className="h-4 w-4" /> Instagram
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
