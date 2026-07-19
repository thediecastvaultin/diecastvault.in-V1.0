import { Link, useNavigate } from "@tanstack/react-router";
import {
  Vault,
  Heart,
  Search,
  ShoppingCart,
  User as UserIcon,
  LayoutDashboard,
  Menu,
  ChevronDown,
  Package,
  Trophy,
  Award,
  Settings,
  LogOut,
  Info,
  Mail,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { useEffect, useState } from "react";
import { SearchCommand } from "./SearchCommand";
import { CartDrawer } from "./CartDrawer";
import { NotificationsBell } from "./NotificationsBell";
import { useWishlist } from "@/hooks/use-wishlist";
import { useCart } from "@/hooks/use-cart";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { toast } from "sonner";

export function Header() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchOpen, setSearchOpen] = useState(false);
  const [cartOpen, setCartOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const wl = useWishlist();
  const cart = useCart();

  const { data: profile } = useQuery({
    queryKey: ["header-profile", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("display_name, avatar_url")
        .eq("id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  const { data: isAdmin } = useQuery({
    queryKey: ["header-is-staff-or-admin", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const [a, s] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" }),
        supabase.rpc("has_role", { _user_id: user!.id, _role: "staff" }),
      ]);
      return !!a.data || !!s.data;
    },
  });

  const initials = (profile?.display_name || user?.email || "?")
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    toast.success("Signed out");
    navigate({ to: "/" });
  }

  const mainLinks = [
    { to: "/", label: "Home" },
    { to: "/shop", label: "Shop" },
    { to: "/auction", label: "Auction" },
    { to: "/wishlist", label: "Collection" },
  ] as const;

  const moreLinks = [
    { to: "/accessories", label: "Accessories", icon: Wrench },
    { to: "/about", label: "About", icon: Info },
    { to: "/contact", label: "Contact", icon: Mail },
  ] as const;

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="relative flex h-16 w-full items-center gap-4 px-4 sm:px-6">
        {/* Mobile menu trigger */}
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-0">
            <SheetHeader className="border-b border-border/60 p-4">
              <SheetTitle className="flex items-center gap-2 text-left">
                <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <Vault className="h-4 w-4" />
                </span>
                <span className="text-sm font-black uppercase tracking-tight">The Diecast Vault</span>
              </SheetTitle>
            </SheetHeader>
            <nav className="flex flex-col p-2 text-sm">
              {mainLinks.map((l) => (
                <Link
                  key={l.to}
                  to={l.to}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-3 py-2.5 font-medium text-foreground hover:bg-muted [&.active]:bg-muted [&.active]:text-primary"
                >
                  {l.label}
                </Link>
              ))}
              <div className="mt-2 border-t border-border/60 pt-2">
                <div className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">More</div>
                {moreLinks.map((l) => (
                  <Link
                    key={l.to}
                    to={l.to}
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-2.5 text-muted-foreground hover:bg-muted hover:text-foreground [&.active]:text-foreground"
                  >
                    <l.icon className="h-4 w-4" />
                    {l.label}
                  </Link>
                ))}
              </div>
              {user ? (
                <div className="mt-2 border-t border-border/60 pt-2">
                  <div className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">Account</div>
                  <Link to="/account" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2.5 hover:bg-muted"><UserIcon className="h-4 w-4" />Profile</Link>
                  <Link to="/orders" onClick={() => setMobileOpen(false)} className="flex items-center gap-2 rounded-md px-3 py-2.5 hover:bg-muted"><Package className="h-4 w-4" /><span className="whitespace-nowrap">My Orders</span></Link>
                  <button onClick={() => { setMobileOpen(false); signOut(); }} className="flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left hover:bg-muted"><LogOut className="h-4 w-4" />Logout</button>
                </div>
              ) : null}
              {isAdmin ? (
                <Link to="/admin" onClick={() => setMobileOpen(false)} className="mt-2 flex items-center gap-2 rounded-md border border-primary/40 bg-primary/10 px-3 py-2.5 text-primary">
                  <LayoutDashboard className="h-4 w-4" /> Dashboard
                </Link>
              ) : null}
            </nav>
          </SheetContent>
        </Sheet>

        <Link to="/" className="mr-auto flex items-center gap-2 font-black tracking-tight">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-[var(--shadow-glow)]">
            <Vault className="h-5 w-5" />
          </span>
          <span className="hidden text-lg uppercase sm:inline">
            The Diecast <span className="text-muted-foreground">Vault</span>
          </span>
        </Link>

        <nav className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-6 whitespace-nowrap text-sm font-medium text-muted-foreground md:flex">
          {mainLinks.map((l) => (
            <Link key={l.to} to={l.to} className="hover:text-foreground [&.active]:text-foreground">
              {l.label}
            </Link>
          ))}

          <DropdownMenu>
            <DropdownMenuTrigger className="inline-flex items-center gap-1 outline-none hover:text-foreground data-[state=open]:text-foreground">
              More <ChevronDown className="h-3.5 w-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="center" className="w-48">
              {moreLinks.map((l) => (
                <DropdownMenuItem key={l.to} asChild>
                  <Link to={l.to} className="flex items-center gap-2">
                    <l.icon className="h-4 w-4 text-muted-foreground" />
                    {l.label}
                  </Link>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {isAdmin ? (
            <Link
              to="/admin"
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 font-mono text-[10px] uppercase tracking-[0.18em] text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.15)] transition-colors hover:bg-primary/20 [&.active]:bg-primary/25"
            >
              <LayoutDashboard className="h-3.5 w-3.5" /> Dashboard
              <span className="ml-1 h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            </Link>
          ) : null}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
          {user ? <NotificationsBell isStaff={!!isAdmin} /> : null}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSearchOpen(true)}
            className="hidden gap-2 rounded-full border border-border/70 bg-background/50 px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground hover:text-foreground lg:inline-flex"
          >
            <Search className="h-3.5 w-3.5" /> Search
            <kbd className="ml-1 rounded border border-border bg-muted px-1.5 py-0.5 text-[9px]">⌘K</kbd>
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setSearchOpen(true)} className="lg:hidden" aria-label="Search">
            <Search className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" asChild className="relative">
            <Link to="/wishlist" aria-label="Collection">
              <Heart className="h-4 w-4" />
              {wl.count > 0 ? (
                <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-bold text-primary-foreground">
                  {wl.count}
                </span>
              ) : null}
            </Link>
          </Button>
          <Button variant="ghost" size="icon" className="relative" onClick={() => setCartOpen(true)} aria-label="Cart">
            <ShoppingCart className="h-4 w-4" />
            {cart.count > 0 ? (
              <span className="absolute -right-0.5 -top-0.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 font-mono text-[9px] font-bold text-primary-foreground">
                {cart.count}
              </span>
            ) : null}
          </Button>
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 rounded-full pl-1 pr-2 sm:pr-3">
                  <Avatar className="h-6 w-6 border border-border/70">
                    <AvatarImage src={profile?.avatar_url ?? undefined} alt="" />
                    <AvatarFallback className="bg-muted text-[10px] font-bold">{initials || "U"}</AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline">Account</span>
                  <ChevronDown className="hidden h-3.5 w-3.5 opacity-60 sm:inline" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="truncate">
                  {profile?.display_name || user.email}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/account" className="flex items-center gap-2"><UserIcon className="h-4 w-4" />Profile</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/orders" className="flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    <span className="whitespace-nowrap">My Orders</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account" search={{ tab: "wins" } as never} className="flex items-center gap-2"><Trophy className="h-4 w-4" />Auction Wins</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account" search={{ tab: "badges" } as never} className="flex items-center gap-2"><Award className="h-4 w-4" />Badges</Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/account" search={{ tab: "settings" } as never} className="flex items-center gap-2"><Settings className="h-4 w-4" />Settings</Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={signOut} className="flex items-center gap-2 text-destructive focus:text-destructive">
                  <LogOut className="h-4 w-4" />Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button size="sm" asChild className="bg-primary hover:bg-primary/90">
              <Link to="/auth"><UserIcon className="mr-2 h-3.5 w-3.5" />Sign in</Link>
            </Button>
          )}
        </div>
      </div>
      <SearchCommand open={searchOpen} onOpenChange={setSearchOpen} />
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </header>
  );
}
