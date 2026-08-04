import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/stat-card";
import { MarketStatusButton } from "@/components/admin/market-status-button";
import { ResolveMarketDialog } from "@/components/admin/resolve-market-dialog";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE, SPORT_LABEL } from "@/lib/constants";
import { fmtCents, fmtDateTime, fmtMoney } from "@/lib/utils";
import type { Market, MarketStatus, MarketOption } from "@/lib/types";

export const metadata: Metadata = {
  title: "Markets · Admin",
  robots: { index: false, follow: false },
};

const FILTERS: (MarketStatus | "all")[] = [
  "all",
  "draft",
  "open",
  "closed",
  "resolved",
  "cancelled",
];

export default async function AdminMarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = (FILTERS as string[]).includes(params.status ?? "")
    ? (params.status as MarketStatus | "all")
    : "all";
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("markets")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status !== "all") query = query.eq("status", status);

  const { data, count } = await query;
  const markets = (data ?? []) as Market[];
  const total = count ?? 0;
  const hasNext = from + markets.length < total;

  type OptionCell = Pick<MarketOption, "id" | "market_id" | "label" | "price">;
  const optionsByMarket = new Map<string, OptionCell[]>();

  if (markets.length > 0) {
    const { data: options } = await supabase
      .from("market_options")
      .select("id, market_id, label, price")
      .in("market_id", markets.map((market) => market.id))
      .order("sort_order");

    for (const option of (options ?? []) as OptionCell[]) {
      const list = optionsByMarket.get(option.market_id) ?? [];
      list.push(option);
      optionsByMarket.set(option.market_id, list);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Markets"
        description={`${total} market${total === 1 ? "" : "s"} in this view.`}
        action={
          <Button asChild>
            <Link href="/admin/markets/new">New market</Link>
          </Button>
        }
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <Link
            key={value}
            href={`/admin/markets?status=${value}`}
            className={
              value === status
                ? "rounded-full bg-primary/20 px-3.5 py-1.5 text-xs font-medium capitalize text-foreground"
                : "rounded-full border border-white/12 px-3.5 py-1.5 text-xs font-medium capitalize text-muted hover:text-foreground"
            }
          >
            {value}
          </Link>
        ))}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Market</TableHead>
              <TableHead>Odds</TableHead>
              <TableHead>Volume</TableHead>
              <TableHead>Closes</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {markets.length === 0 ? (
              <TableEmpty colSpan={6}>No markets match this filter.</TableEmpty>
            ) : (
              markets.map((market) => {
                const options = optionsByMarket.get(market.id) ?? [];
                const winner = options.find(
                  (option) => option.id === market.winning_option_id
                );

                return (
                <TableRow key={market.id}>
                  <TableCell>
                    <Link
                      href={`/admin/markets/${market.id}`}
                      className="font-medium hover:text-secondary"
                    >
                      {market.title}
                    </Link>
                    <p className="text-xs text-muted">
                      {SPORT_LABEL[market.sport]}
                      {market.league ? ` · ${market.league}` : ""}
                      {market.is_featured ? " · Featured" : ""}
                    </p>
                  </TableCell>
                  <TableCell>
                    {options.length === 0 ? (
                      <span className="text-xs text-muted">No outcomes</span>
                    ) : (
                      <div className="space-y-0.5 text-xs">
                        {options.slice(0, 3).map((option) => (
                          <div key={option.id} className="flex gap-2">
                            <span className="truncate text-muted">{option.label}</span>
                            <span className="text-accent">{fmtCents(option.price)}</span>
                          </div>
                        ))}
                        {options.length > 3 && (
                          <p className="text-muted">+{options.length - 3} more</p>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {fmtMoney(market.total_volume)}
                    <p className="text-xs text-muted">{market.trade_count} trades</p>
                  </TableCell>
                  <TableCell className="text-muted">{fmtDateTime(market.end_time)}</TableCell>
                  <TableCell>
                    <Badge variant={statusVariant(market.status)}>{market.status}</Badge>
                    {winner && <p className="mt-1 text-xs text-muted">{winner.label}</p>}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap justify-end gap-2">
                      {market.status === "draft" && (
                        <MarketStatusButton marketId={market.id} status="open" />
                      )}
                      {market.status === "open" && (
                        <MarketStatusButton marketId={market.id} status="closed" />
                      )}
                      {(market.status === "closed" || market.status === "open") && (
                        <ResolveMarketDialog
                          marketId={market.id}
                          question={market.question}
                          options={options}
                        />
                      )}
                      <Button asChild variant="ghost" size="sm">
                        <Link href={`/admin/markets/${market.id}`}>Edit</Link>
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {(page > 1 || hasNext) && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">Page {page}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/markets?status=${status}&page=${page - 1}`}
                className="rounded-xl border border-white/12 px-4 py-2 text-sm hover:bg-white/5"
              >
                Previous
              </Link>
            )}
            {hasNext && (
              <Link
                href={`/admin/markets?status=${status}&page=${page + 1}`}
                className="rounded-xl border border-white/12 px-4 py-2 text-sm hover:bg-white/5"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
