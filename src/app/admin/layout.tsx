import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUnreadCount, requireAdmin } from "@/lib/auth";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdmin();
  const unread = await getUnreadCount(user.id);

  const navItems = [
    { href: "/admin", label: "Overview" },
    { href: "/admin/markets", label: "Markets" },
    { href: "/admin/deposits", label: "Deposits" },
    { href: "/admin/withdrawals", label: "Withdrawals" },
    { href: "/admin/kyc", label: "KYC review" },
    { href: "/admin/users", label: "Users" },
    { href: "/admin/content", label: "Content" },
    { href: "/admin/announcements", label: "Announcements" },
    { href: "/admin/settings", label: "Settings" },
  ];

  return (
    <DashboardShell
      user={user}
      unread={unread}
      navItems={navItems}
      footerHref="/dashboard"
      footerLabel="Back to app"
    >
      {children}
    </DashboardShell>
  );
}
