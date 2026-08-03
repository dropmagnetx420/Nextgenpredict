import Link from "next/link";
import { Bell } from "lucide-react";
import { Logo } from "@/components/fx/logo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { MobileNav } from "@/components/dashboard/mobile-nav";
import type { NavItem } from "@/components/dashboard/dashboard-nav";
import { cn, initials } from "@/lib/utils";
import type { AppUser } from "@/lib/types";

export function DashboardTopbar({
  user,
  unread,
  navItems,
}: {
  user: AppUser;
  unread: number;
  navItems: NavItem[];
}) {
  const isAdmin = user.role === "admin";
  const home = isAdmin ? "/admin" : "/dashboard";

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-white/10 bg-background/80 px-4 backdrop-blur-xl sm:px-6">
      <MobileNav items={navItems} />

      <Logo size="sm" showText={false} href={home} />
      <span className="hidden font-display text-sm font-semibold sm:inline">
        {isAdmin ? "Admin" : "Dashboard"}
      </span>

      <div className="ml-auto flex items-center gap-2">
        <Button
          asChild
          variant="ghost"
          size="iconSm"
          className="relative"
          aria-label={unread > 0 ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Link href={isAdmin ? "/admin/users" : "/dashboard/notifications"}>
            <Bell aria-hidden />
            {unread > 0 && (
              <span className="absolute right-0.5 top-0.5 inline-flex h-2 w-2 rounded-full bg-accent" />
            )}
          </Link>
        </Button>

        <div className="hidden items-center gap-2 sm:flex">
          <span
            className={cn(
              "inline-flex h-8 w-8 items-center justify-center rounded-full border border-white/15 text-xs font-bold",
              isAdmin ? "bg-primary/25 text-primary" : "bg-white/10 text-foreground"
            )}
          >
            {initials(user.full_name, user.email)}
          </span>
          <div className="leading-tight">
            <p className="text-xs font-semibold">{user.full_name || "Account"}</p>
            <Badge
              variant={isAdmin ? "accent" : "outline"}
              className="mt-0.5 px-1.5 py-0 text-[10px]"
            >
              {isAdmin ? "Admin" : user.kyc_status}
            </Badge>
          </div>
        </div>

        <div className="hidden sm:block">
          <SignOutButton size="sm" variant="outline" className="px-3" />
        </div>
      </div>
    </header>
  );
}
