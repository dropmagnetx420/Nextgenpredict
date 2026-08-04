import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { ArrowLeft } from "lucide-react";
import { TradePanel } from "@/components/markets/trade-panel";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/misc";
import { SPORT_LABEL } from "@/lib/constants";
import { getSessionUser, getWallet } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { fmtCents, fmtCompact, fmtDateTime, fmtMoney, fmtRelative } from "@/lib/utils";
import type { Market, MarketOption } from "@/lib/types";

export const revalidate = 15;

const SHARE_COLORS = [
  "bg-accent",
  "bg-secondary",
  "bg-primary",
  "bg-emerald-400",
  "bg-amber-400",
  "bg-rose-400",
];

async function loadMarket(slug: string): Promise<Market | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("markets")
    .select("*")
    .eq("slug", slug)
    .maybeSingle<Market>();
  return data;
}

async function loadOptions(marketId: string): Promise<MarketOption[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("market_options")
    .select("*")
    .eq("market_id", marketId)
    .order("sort_order");
  return (data ?? []) as MarketOption[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const market = await loadMarket(slug);
  if (!market) return { title: "Market not found" };

  return {
    title: market.title,
    description: market.question,
    openGraph: {
      title: market.title,
      description: market.question,
      images: market.banner_url ? [market.banner_url] : undefined,
    },
  };
}

export default async function MarketDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const market = await loadMarket(slug);
  if (!market || market.status === "draft") notFound();

  const [user, settings] = await Promise.all([getSessionUser(), getSettings()]);
  const [wallet, options] = await Promise.all([
    user ? getWallet(user.id) : null,
    loadOptions(market.id),
  ]);
  const balance = wallet ? Number(wallet.available) + Number(wallet.bonus) : null;

  const tradable = options.filter((option) => option.is_active);
  const tradingOpen =
    market.status === "open" &&
    new Date(market.end_time) > new Date() &&
    settings.trading_enabled &&
    tradable.length >= 2;

  // Sentiment is share of open interest, so it reflects live positions rather
  // than the lifetime volume headline.
  const openInterest = options.reduce((sum, option) => sum + Number(option.volume), 0);
  const shares = options.map((option) => ({
    option,
    share:
      openInterest > 0
        ? (Number(option.volume) / openInterest) * 100
        : 100 / Math.max(options.length, 1),
  }));

  const favourite = options.reduce<MarketOption | null>(
    (best, option) => (!best || Number(option.price) > Number(best.price) ? option : best),
    null
  );
  const winner = options.find((option) => option.id === market.winning_option_id);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-6">
      <Link
        href="/markets"
        className="inline-flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden /> All markets
      </Link>

      <div className="mt-6 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{SPORT_LABEL[market.sport]}</Badge>
            {market.league && <Badge variant="outline">{market.league}</Badge>}
            <Badge variant={statusVariant(market.status)}>{market.status}</Badge>
            {market.is_trending && <Badge variant="accent">Trending</Badge>}
          </div>

          <h1 className="mt-4 font-display text-2xl font-bold leading-tight sm:text-3xl">
            {market.question}
          </h1>

          {(market.team_a || market.team_b) && (
            <p className="mt-2 text-sm text-muted">
              {[market.team_a, market.team_b].filter(Boolean).join("  vs  ")}
            </p>
          )}

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-white/10 bg-surface/50 px-4 py-3">
              <dt className="text-xs uppercase tracking-wide text-muted">Volume</dt>
              <dd className="mt-1 font-display text-lg font-bold">
                {fmtCompact(market.total_volume)}
              </dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-surface/50 px-4 py-3">
              <dt className="text-xs uppercase tracking-wide text-muted">Predictions</dt>
              <dd className="mt-1 font-display text-lg font-bold">{market.trade_count}</dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-surface/50 px-4 py-3">
              <dt className="text-xs uppercase tracking-wide text-muted">Closes</dt>
              <dd className="mt-1 font-display text-lg font-bold">
                {fmtRelative(market.end_time)}
              </dd>
            </div>
            <div className="rounded-xl border border-white/10 bg-surface/50 px-4 py-3">
              <dt className="text-xs uppercase tracking-wide text-muted">Favourite</dt>
              <dd className="mt-1 truncate font-display text-lg font-bold">
                {favourite ? `${favourite.label} ${fmtCents(favourite.price)}` : "—"}
              </dd>
            </div>
          </dl>

          <Card className="mt-6">
            <CardContent className="p-5">
              <h2 className="font-display text-base font-semibold">Market sentiment</h2>
              <div
                className="mt-4 flex h-3 overflow-hidden rounded-full bg-white/10"
                role="img"
                aria-label="Share of open interest by outcome"
              >
                {shares.map(({ option, share }, index) => (
                  <div
                    key={option.id}
                    className={SHARE_COLORS[index % SHARE_COLORS.length]}
                    style={{ width: `${share}%` }}
                  />
                ))}
              </div>
              <ul className="mt-3 space-y-1.5 text-sm">
                {shares.map(({ option, share }, index) => (
                  <li key={option.id} className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                          SHARE_COLORS[index % SHARE_COLORS.length]
                        }`}
                        aria-hidden
                      />
                      <span className="truncate">{option.label}</span>
                    </span>
                    <span className="shrink-0 text-muted">
                      {fmtCents(option.price)} · {fmtMoney(option.volume)} ({share.toFixed(0)}%)
                    </span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {market.description && (
            <Card className="mt-6">
              <CardContent className="p-5">
                <h2 className="font-display text-base font-semibold">About this market</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted">
                  {market.description}
                </p>
              </CardContent>
            </Card>
          )}

          <Card className="mt-6">
            <CardContent className="p-5">
              <h2 className="font-display text-base font-semibold">Details</h2>
              <Separator className="my-4" />
              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Opens</dt>
                  <dd>{fmtDateTime(market.start_time)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Closes</dt>
                  <dd>{fmtDateTime(market.end_time)}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Min prediction</dt>
                  <dd>{fmtMoney(market.min_trade)} USDG</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Max prediction</dt>
                  <dd>{fmtMoney(market.max_trade)} USDG</dd>
                </div>
              </dl>

              {(market.status === "resolved" || market.status === "cancelled") && (
                <>
                  <Separator className="my-4" />
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="text-muted">Resolved</span>
                    <Badge variant={winner ? "success" : "outline"}>
                      {winner ? winner.label : "Voided — refunded"}
                    </Badge>
                    <span className="text-muted">on {fmtDateTime(market.resolved_at)}</span>
                  </div>
                  {market.resolution_note && (
                    <p className="mt-2 text-sm text-muted">{market.resolution_note}</p>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </div>

        <aside>
          <TradePanel
            marketId={market.id}
            options={tradable}
            minTrade={Number(market.min_trade)}
            maxTrade={Number(market.max_trade)}
            isOpen={tradingOpen}
            isSignedIn={Boolean(user)}
            balance={balance}
            fee={{
              percent: settings.trade_fee_percent,
              min: settings.trade_fee_min,
              max: settings.trade_fee_max,
            }}
          />
        </aside>
      </div>
    </div>
  );
}
