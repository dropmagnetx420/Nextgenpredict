import Link from "next/link";
import { DashboardNav, type NavItem } from "@/components/dashboard/dashboard-nav";
import { DashboardTopbar } from "@/components/dashboard/dashboard-topbar";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import type { AppUser } from "@/lib/types";

/** Shared chrome for both the user dashboard and the admin panel. */
export function DashboardShell({
  user,
  unread,
  navItems,
  footerHref,
  footerLabel,
  area,
  children,
}: {
  user: AppUser;
  unread: number;
  navItems: NavItem[];
  footerHref: string;
  footerLabel: string;
  area: "dashboard" | "admin";
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh">
      <DashboardTopbar user={user} unread={unread} navItems={navItems} area={area} />

      <div className="mx-auto flex w-full max-w-7xl gap-8 px-4 py-8 sm:px-6">
        <aside className="hidden w-60 shrink-0 lg:block">
          <div className="sticky top-24">
            <DashboardNav items={navItems} />
            <div className="mt-6 border-t border-white/10 pt-4">
              <Link
                href={footerHref}
                className="block rounded-xl px-3.5 py-2.5 text-sm font-medium text-muted transition-colors hover:bg-white/5 hover:text-foreground"
              >
                {footerLabel}
              </Link>
              <SignOutButton />
            </div>
          </div>
        </aside>

        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
