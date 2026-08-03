import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { getUnreadCount, requireUser } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireUser("/dashboard");
  const unread = await getUnreadCount(user.id);

  const navItems = [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/positions", label: "Positions" },
    { href: "/dashboard/wallet", label: "Wallet" },
    { href: "/dashboard/deposit", label: "Deposit" },
    { href: "/dashboard/withdraw", label: "Withdraw" },
    { href: "/dashboard/kyc", label: "Verification" },
    { href: "/dashboard/referrals", label: "Referrals" },
    { href: "/dashboard/notifications", label: "Notifications", badge: unread },
    { href: "/dashboard/settings", label: "Settings" },
  ];

  return (
    <DashboardShell
      user={user}
      unread={unread}
      navItems={navItems}
      footerHref="/markets"
      footerLabel="Browse markets"
    >
      {children}
    </DashboardShell>
  );
}
