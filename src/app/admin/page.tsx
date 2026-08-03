import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader, StatCard } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { fmtMoney, fmtRelative } from "@/lib/utils";
import type { AdminLog, RevenueSummary } from "@/lib/types";

export const metadata: Metadata = {
  title: "Admin",
  robots: { index: false, follow: false },
};

const RANGES = [7, 30, 90] as const;

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string }>;
}) {
  const { days } = await searchParams;
  const range = RANGES.includes(Number(days) as (typeof RANGES)[number])
    ? Number(days)
    : 30;

  const supabase = await createClient();

  const [summaryRes, depositsRes, withdrawalsRes, kycRes, logsRes] = await Promise.all([
    supabase.rpc("revenue_summary", { p_days: range }),
    supabase
      .from("deposit_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("withdraw_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("kyc_requests")
      .select("id", { count: "exact", head: true })
      .eq("status", "pending"),
    supabase
      .from("admin_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(12),
  ]);

  const raw = summaryRes.data as RevenueSummary[] | RevenueSummary | null;
  const summary = (Array.isArray(raw) ? raw[0] : raw) ?? null;
  const logs = (logsRes.data ?? []) as AdminLog[];

  const queues = [
    { label: "Deposits", href: "/admin/deposits", count: depositsRes.count ?? 0 },
    { label: "Withdrawals", href: "/admin/withdrawals", count: withdrawalsRes.count ?? 0 },
    { label: "KYC reviews", href: "/admin/kyc", count: kycRes.count ?? 0 },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        title="Admin overview"
        description={`Platform activity over the last ${range} days.`}
        action={
          <div className="flex gap-1.5">
            {RANGES.map((value) => (
              <Link
                key={value}
                href={`/admin?days=${value}`}
                className={
                  value === range
                    ? "rounded-lg bg-primary/20 px-3 py-1.5 text-xs font-medium text-foreground"
                    : "rounded-lg px-3 py-1.5 text-xs font-medium text-muted hover:text-foreground"
                }
              >
                {value}d
              </Link>
            ))}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net revenue"
          value={`${fmtMoney(summary?.net_revenue ?? 0)} USDG`}
          tone={(summary?.net_revenue ?? 0) >= 0 ? "accent" : "negative"}
          hint="Fees minus bonuses and commissions"
        />
        <StatCard label="Trading fees" value={`${fmtMoney(summary?.total_fees ?? 0)} USDG`} />
        <StatCard label="Deposits" value={`${fmtMoney(summary?.total_deposits ?? 0)} USDG`} />
        <StatCard
          label="Withdrawals"
          value={`${fmtMoney(summary?.total_withdrawals ?? 0)} USDG`}
        />
        <StatCard label="Bonuses paid" value={`${fmtMoney(summary?.total_bonus ?? 0)} USDG`} />
        <StatCard label="Payouts" value={`${fmtMoney(summary?.total_payouts ?? 0)} USDG`} />
        <StatCard label="Active members" value={String(summary?.active_users ?? 0)} />
        <StatCard label="Open markets" value={String(summary?.open_markets ?? 0)} />
      </div>

      <section>
        <h2 className="font-display text-lg font-semibold">Needs attention</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {queues.map((queue) => (
            <Link key={queue.href} href={queue.href} className="group">
              <Card className="transition-colors group-hover:border-primary/40">
                <CardContent className="flex items-center justify-between p-5">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-muted">{queue.label}</p>
                    <p className="mt-1.5 font-display text-2xl font-bold">{queue.count}</p>
                  </div>
                  {queue.count > 0 && <Badge variant="warning">Pending</Badge>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">Recent admin activity</h2>
        <Card className="mt-4">
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <p className="p-6 text-sm text-muted">No admin actions logged yet.</p>
            ) : (
              <ul className="divide-y divide-white/8">
                {logs.map((log) => (
                  <li
                    key={log.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">{log.action.replace(/_/g, " ")}</p>
                      {log.entity_type && (
                        <p className="text-xs text-muted">
                          {log.entity_type}
                          {log.entity_id ? ` · ${log.entity_id.slice(0, 8)}` : ""}
                        </p>
                      )}
                    </div>
                    <span className="text-xs text-muted">{fmtRelative(log.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
