import { Suspense } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Logo } from "@/components/fx/logo";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { hasSession } from "@/lib/auth";

const NAV = [
  { href: "/markets", label: "Markets" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/faq", label: "FAQ" },
];

/**
 * Reading the session costs a Supabase round trip. Kept in its own component
 * so Suspense can stream the rest of the page immediately instead of holding
 * the entire document back for the length of that call.
 */
async function AuthActions() {
  if (await hasSession()) {
    return (
      <Button asChild size="sm">
        <Link href="/dashboard">Dashboard</Link>
      </Button>
    );
  }

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="hidden sm:inline-flex">
        <Link href="/login">Sign in</Link>
      </Button>
      <Button asChild size="sm">
        <Link href="/signup">Get started</Link>
      </Button>
    </>
  );
}

/** Placeholder sized to match the real buttons so the header doesn't shift. */
function AuthActionsFallback() {
  return <div className="h-8 w-[104px] animate-pulse rounded-lg bg-white/5" aria-hidden />;
}

async function MobileAuthLink() {
  if (await hasSession()) return null;

  return (
    <Link
      href="/login"
      className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground"
    >
      Sign in
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-background/70 backdrop-blur-xl">
      <div className="mx-auto flex h-16 w-full max-w-7xl items-center gap-6 px-4 sm:px-6">
        <Logo size="sm" />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Suspense fallback={<AuthActionsFallback />}>
            <AuthActions />
          </Suspense>

          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="iconSm" className="md:hidden" aria-label="Open menu">
                <Menu />
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xs">
              <DialogTitle>Menu</DialogTitle>
              <nav className="mt-2 flex flex-col gap-1" aria-label="Mobile">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-lg px-3 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground"
                  >
                    {item.label}
                  </Link>
                ))}
                <Suspense fallback={null}>
                  <MobileAuthLink />
                </Suspense>
              </nav>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  );
}
