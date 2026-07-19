import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Vault, Instagram, Facebook, Twitter, Youtube, MessageCircle, Mail, Phone, MapPin } from "lucide-react";
import { useSiteSettings } from "@/hooks/use-site-settings";

export function Footer() {
  const { general, social, footer } = useSiteSettings();
  const { data: annList } = useQuery({
    queryKey: ["announcements-public"],
    queryFn: async () => {
      const { data } = await supabase.from("announcements").select("id,title").eq("active", true).eq("channel", "flash").limit(3);
      return data ?? [];
    },
    staleTime: 60_000,
  });

  return (
    <footer className="mt-24 border-t border-border/60 bg-card/40">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 md:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-black uppercase">
            {general.logo_url ? (
              <img src={general.logo_url} alt="" className="h-8 w-8 rounded-md object-cover" />
            ) : (
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                <Vault className="h-4 w-4" />
              </span>
            )}
            {general.site_name}
          </div>
          <p className="mt-3 text-sm text-muted-foreground">{general.footer_description}</p>
          {(general.support_email || general.support_phone || general.business_address) ? (
            <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
              {general.support_email ? <li className="flex items-center gap-2"><Mail className="h-3 w-3" /><a href={`mailto:${general.support_email}`} className="hover:text-foreground">{general.support_email}</a></li> : null}
              {general.support_phone ? <li className="flex items-center gap-2"><Phone className="h-3 w-3" /><a href={`tel:${general.support_phone}`} className="hover:text-foreground">{general.support_phone}</a></li> : null}
              {general.business_address ? <li className="flex items-start gap-2"><MapPin className="h-3 w-3 mt-0.5 shrink-0" /><span>{general.business_address}</span></li> : null}
            </ul>
          ) : null}
          {hasAnySocial(social) ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {social.instagram ? <SocialIcon href={social.instagram} label="Instagram"><Instagram className="h-4 w-4" /></SocialIcon> : null}
              {social.facebook ? <SocialIcon href={social.facebook} label="Facebook"><Facebook className="h-4 w-4" /></SocialIcon> : null}
              {social.twitter ? <SocialIcon href={social.twitter} label="X"><Twitter className="h-4 w-4" /></SocialIcon> : null}
              {social.youtube ? <SocialIcon href={social.youtube} label="YouTube"><Youtube className="h-4 w-4" /></SocialIcon> : null}
              {social.discord ? <SocialIcon href={social.discord} label="Discord"><MessageCircle className="h-4 w-4" /></SocialIcon> : null}
              {social.whatsapp ? <SocialIcon href={`https://wa.me/${social.whatsapp.replace(/[^0-9]/g, "")}`} label="WhatsApp"><MessageCircle className="h-4 w-4" /></SocialIcon> : null}
              {social.email && social.email.toLowerCase() !== (general.support_email ?? "").toLowerCase() ? <SocialIcon href={`mailto:${social.email}`} label="Email"><Mail className="h-4 w-4" /></SocialIcon> : null}
            </div>
          ) : null}
        </div>
        {footer.shop_links.length > 0 ? <FooterCol title="Shop" links={footer.shop_links} /> : null}
        {footer.company_links.length > 0 ? <FooterCol title="Company" links={footer.company_links} /> : null}
        {footer.quick_links.length > 0 ? <FooterCol title="Quick Links" links={footer.quick_links} /> : null}
        {footer.legal_links.length > 0 ? <FooterCol title="Legal" links={footer.legal_links} /> : null}
      </div>
      {annList && annList.length > 0 ? (
        <div className="border-t border-border/50 bg-primary/5 py-2 text-center text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
          {annList.map((a) => a.title).join(" · ")}
        </div>
      ) : null}
      <div className="border-t border-border/50 py-5 text-center text-xs text-muted-foreground">
        {general.footer_copyright}
      </div>
    </footer>
  );
}

function hasAnySocial(s: Record<string, string>) {
  return Object.values(s).some((v) => !!v);
}

function SocialIcon({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <a href={href} aria-label={label} target="_blank" rel="noopener noreferrer" className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:bg-primary hover:text-primary-foreground">
      {children}
    </a>
  );
}

function FooterCol({ title, links }: { title: string; links: { label: string; href: string }[] }) {
  return (
    <div>
      <div className="mb-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</div>
      <ul className="space-y-2 text-sm">
        {links.map((l) => (
          <li key={`${l.label}-${l.href}`}>
            <a href={l.href} className="text-foreground/80 hover:text-primary">{l.label}</a>
          </li>
        ))}
      </ul>
    </div>
  );
}
