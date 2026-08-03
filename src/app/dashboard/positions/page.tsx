import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/stat-card";
import { CancelTradeButton } from "@/components/dashboard/cancel-trade-button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PAGE_SIZE } from "@/lib/constants";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { calcFee, fmtCents, fmtDateTime, fmtMoney } from "@/lib/utils";
import type { TradeStatus, TradeWithMarket } from "@/lib/types";

export const metadata: Metadata = {
  title: "Positions",
  robots: { index: false, follow: false },
};

const FILTERS = [
  { value: "all", label: "All" },
  { value: "open", label: "Open" },
  { value: "won", label: "Won" },
  { value: "lost", label: "Lost" },
  { value: "cancelled", label: "Cancelled" },
  { value: "refunded", label: "Refunded" },
] as const;

export default async function PositionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const user = await requireUser("/dashboard/positions");
  const settings = await getSettings();

  const status = FILTERS.some((f) => f.value === params.status && f.value !== "all")
    ? (params.status as TradeStatus)
    : undefined;
  const page = Math.max(1, Number(params.page ?? 1) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("trades")
    .select("*, market:markets(*)", { count: "exact" })
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (status) query = query.eq("status", status);

  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);
  const trades = (data ?? []) as TradeWithMarket[];
  const total = count ?? 0;
  const hasNext = from + trades.length < total;

  const href = (next: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { status: params.status, page, ...next };
    if (merged.status && merged.status !== "all") sp.set("status", String(merged.status));
    if (merged.page && Number(merged.page) > 1) sp.set("page", String(merged.page));
    const qs = sp.toString();
    return qs ? `/dashboard/positions?${qs}` : "/dashboard/positions";
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Positions"
        description={`${total} prediction${total === 1 ? "" : "s"} on record.`}
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((filter) => {
          const active = (params.status ?? "all") === filter.value;
          return (
            <Button
              key={filter.value}
              asChild
              variant={active ? "default" : "outline"}
              size="sm"
            >
              <Link href={href({ status: filter.value, page: 1 })}>{filter.label}</Link>
            </Button>
          );
        })}
      </div>

      {trades.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="font-display text-base font-semibold">Nothing here yet</p>
            <p className="mt-2 text-sm text-muted">
              {status
                ? "No positions match this filter."
                : "Place your first prediction to see it here."}
            </p>
            <Button asChild size="sm" className="mt-6">
              <Link href="/markets">Browse markets</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {trades.map((trade) => {
            const stake = Number(trade.stake);
            const pnl = Number(trade.pnl);
            const marketOpen = trade.market?.status === "open";
            const cancelFee = calcFee(
              stake,
              settings.trade_fee_percent,
              settings.trade_fee_min,
              settings.trade_fee_max
            );

            return (
              <li key={trade.id}>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        {trade.market ? (
                          <Link
                            href={`/markets/${trade.market.slug}`}
                            className="font-medium transition-colors hover:text-secondary"
                          >
                            {trade.market.question}
                          </Link>
                        ) : (
                          <p className="font-medium">Market unavailable</p>
                        )}
                        <p className="mt-1 text-xs text-muted">
                          Placed {fmtDateTime(trade.created_at)}
                        </p>
                      </div>
                      <Badge variant={statusVariant(trade.status)}>{trade.status}</Badge>
                    </div>

                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <dt className="text-xs text-muted">Side</dt>
                        <dd
                          className={
                            trade.side === "yes"
                              ? "font-semibold text-emerald-300"
                              : "font-semibold text-rose-300"
                          }
                        >
                          {trade.side.toUpperCase()} @ {fmtCents(trade.price)}
                        </dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Stake</dt>
                        <dd className="font-medium">{fmtMoney(stake)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">Shares</dt>
                        <dd className="font-medium">{Number(trade.shares).toFixed(2)}</dd>
                      </div>
                      <div>
                        <dt className="text-xs text-muted">
                          {trade.status === "open" ? "Potential payout" : "Result"}
                        </dt>
                        <dd
                          className={
                            trade.status === "open"
                              ? "font-medium text-accent"
                              : pnl > 0
                                ? "font-medium text-emerald-300"
                                : pnl < 0
                                  ? "font-medium text-rose-300"
                                  : "font-medium"
                          }
                        >
                          {trade.status === "open"
                            ? fmtMoney(trade.potential_payout)
                            : `${pnl >= 0 ? "+" : ""}${fmtMoney(pnl)}`}
                        </dd>
                      </div>
                    </dl>

                    {trade.status === "open" && marketOpen && (
                      <div className="mt-4 flex justify-end">
                        <CancelTradeButton
                          tradeId={trade.id}
                          stake={stake}
                          cancelFee={cancelFee}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {(page > 1 || hasNext) && (
        <nav className="flex items-center justify-between" aria-label="Pagination">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={href({ page: page - 1 })}>Previous</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted">Page {page}</span>
          {hasNext ? (
            <Button asChild variant="outline" size="sm">
              <Link href={href({ page: page + 1 })}>Next</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
