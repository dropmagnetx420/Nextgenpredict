import Link from "next/link";
import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { PageHeader, StatCard } from "@/components/dashboard/stat-card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser, getWallet } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtCents, fmtMoney, fmtRelative } from "@/lib/utils";
import type { TradeWithMarket } from "@/lib/types";

export const metadata: Metadata = {
  title: "Overview",
  robots: { index: false, follow: false },
};

export default async function DashboardPage() {
  const user = await requireUser("/dashboard");
  const supabase = await createClient();

  const [wallet, tradesRes, turnoverRes] = await Promise.all([
    getWallet(user.id),
    supabase
      .from("trades")
      .select("*, market:markets(*)")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5),
    supabase.rpc("pending_turnover", { p_user_id: user.id }),
  ]);

  const trades = (tradesRes.data ?? []) as TradeWithMarket[];
  const pendingTurnover = Number(turnoverRes.data ?? 0);

  const available = Number(wallet?.available ?? 0);
  const bonus = Number(wallet?.bonus ?? 0);
  const locked = Number(wallet?.locked ?? 0);

  const settled = user.trades_won + user.trades_lost;
  const winRate = settled > 0 ? (user.trades_won / settled) * 100 : 0;
  const pnl = Number(user.total_pnl);

  return (
    <div className="space-y-8">
      <PageHeader
        title={`Welcome back${user.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}`}
        description="Your balance, open positions and recent activity."
        action={
          <Button asChild>
            <Link href="/markets">
              Find a market <ArrowRight />
            </Link>
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Available"
          value={`${fmtMoney(available)} USDG`}
          hint={locked > 0 ? `${fmtMoney(locked)} locked in positions` : undefined}
        />
        <StatCard
          label="Bonus balance"
          value={`${fmtMoney(bonus)} USDG`}
          tone="accent"
          hint={
            pendingTurnover > 0
              ? `${fmtMoney(pendingTurnover)} turnover to unlock`
              : bonus > 0
                ? "Fully unlocked"
                : undefined
          }
        />
        <StatCard
          label="Total P&L"
          value={`${pnl >= 0 ? "+" : ""}${fmtMoney(pnl)}`}
          tone={pnl > 0 ? "positive" : pnl < 0 ? "negative" : "default"}
          hint={`${user.total_trades} prediction${user.total_trades === 1 ? "" : "s"} placed`}
        />
        <StatCard
          label="Win rate"
          value={settled > 0 ? `${winRate.toFixed(0)}%` : "—"}
          hint={settled > 0 ? `${user.trades_won}W · ${user.trades_lost}L` : "No settled trades yet"}
        />
      </div>

      {user.kyc_status !== "approved" && (
        <Card className="border-amber-400/25 bg-amber-400/[0.06]">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div>
              <p className="font-display text-sm font-semibold">Verify your identity</p>
              <p className="mt-1 text-sm text-muted">
                {user.kyc_status === "pending"
                  ? "Your documents are under review. We'll notify you once it's done."
                  : "Verification is required before your first withdrawal."}
              </p>
            </div>
            {user.kyc_status !== "pending" && (
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/kyc">Start verification</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      <section>
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-display text-lg font-semibold">Recent positions</h2>
          <Button asChild variant="ghost" size="sm">
            <Link href="/dashboard/positions">
              View all <ArrowRight />
            </Link>
          </Button>
        </div>

        {trades.length === 0 ? (
          <Card className="mt-4">
            <CardContent className="py-14 text-center">
              <p className="font-display text-base font-semibold">No predictions yet</p>
              <p className="mt-2 text-sm text-muted">
                Pick a market and take a side to get started.
              </p>
              <Button asChild size="sm" className="mt-6">
                <Link href="/markets">Browse markets</Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <ul className="mt-4 space-y-3">
            {trades.map((trade) => (
              <li key={trade.id}>
                <Card>
                  <CardContent className="flex flex-wrap items-center gap-4 p-4">
                    <div className="min-w-0 flex-1">
                      {trade.market ? (
                        <Link
                          href={`/markets/${trade.market.slug}`}
                          className="line-clamp-1 font-medium transition-colors hover:text-secondary"
                        >
                          {trade.market.question}
                        </Link>
                      ) : (
                        <p className="line-clamp-1 font-medium">Market unavailable</p>
                      )}
                      <p className="mt-1 text-xs text-muted">
                        {fmtMoney(trade.stake)} USDG on{" "}
                        <span
                          className={
                            trade.side === "yes" ? "text-emerald-300" : "text-rose-300"
                          }
                        >
                          {trade.side.toUpperCase()}
                        </span>{" "}
                        at {fmtCents(trade.price)} · {fmtRelative(trade.created_at)}
                      </p>
                    </div>

                    <div className="text-right">
                      <Badge variant={statusVariant(trade.status)}>{trade.status}</Badge>
                      <p className="mt-1 text-xs text-muted">
                        {trade.status === "open"
                          ? `${fmtMoney(trade.potential_payout)} potential`
                          : `${Number(trade.pnl) >= 0 ? "+" : ""}${fmtMoney(trade.pnl)}`}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
