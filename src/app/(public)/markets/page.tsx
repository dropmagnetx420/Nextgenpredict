import Link from "next/link";
import type { Metadata } from "next";
import { MarketCard } from "@/components/site/market-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SPORTS, PAGE_SIZE } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { getOptionsByMarket } from "@/lib/markets";
import type { Market, Sport } from "@/lib/types";

export const revalidate = 30;

export const metadata: Metadata = {
  title: "Markets",
  description:
    "Browse every open sports prediction market — football, cricket, basketball, tennis and esports.",
};

const SORTS = [
  { value: "volume", label: "Volume" },
  { value: "closing", label: "Closing soon" },
  { value: "new", label: "Newest" },
] as const;

const VALID_SPORTS = SPORTS.map((s) => s.value);

export default async function MarketsPage({
  searchParams,
}: {
  searchParams: Promise<{ sport?: string; sort?: string; page?: string }>;
}) {
  const params = await searchParams;

  const sport = VALID_SPORTS.includes(params.sport as Sport)
    ? (params.sport as Sport)
    : undefined;
  const sort = SORTS.some((s) => s.value === params.sort) ? params.sort! : "volume";
  const page = Math.max(1, Number(params.page ?? 1) || 1);

  const supabase = await createClient();
  let query = supabase
    .from("markets")
    .select("*", { count: "exact" })
    .in("status", ["open", "closed"]);

  if (sport) query = query.eq("sport", sport);

  if (sort === "closing") query = query.order("end_time", { ascending: true });
  else if (sort === "new") query = query.order("created_at", { ascending: false });
  else query = query.order("total_volume", { ascending: false });

  const from = (page - 1) * PAGE_SIZE;
  const { data, count } = await query.range(from, from + PAGE_SIZE - 1);

  const markets = (data ?? []) as Market[];
  const total = count ?? 0;
  const hasNext = from + markets.length < total;
  const optionsByMarket = await getOptionsByMarket(markets.map((market) => market.id));

  const buildHref = (next: Record<string, string | number | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { sport, sort, page, ...next };
    if (merged.sport) sp.set("sport", String(merged.sport));
    if (merged.sort && merged.sort !== "volume") sp.set("sort", String(merged.sort));
    if (merged.page && Number(merged.page) > 1) sp.set("page", String(merged.page));
    const qs = sp.toString();
    return qs ? `/markets?${qs}` : "/markets";
  };

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">Markets</h1>
      <p className="mt-2 text-sm text-muted">
        {total} market{total === 1 ? "" : "s"} available.
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        <Button asChild variant={sport ? "outline" : "default"} size="sm">
          <Link href={buildHref({ sport: undefined, page: 1 })}>All sports</Link>
        </Button>
        {SPORTS.map((item) => (
          <Button
            key={item.value}
            asChild
            variant={sport === item.value ? "default" : "outline"}
            size="sm"
          >
            <Link href={buildHref({ sport: item.value, page: 1 })}>
              <span aria-hidden>{item.emoji}</span> {item.label}
            </Link>
          </Button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-muted">Sort</span>
        {SORTS.map((item) => (
          <Button
            key={item.value}
            asChild
            variant={sort === item.value ? "default" : "ghost"}
            size="sm"
          >
            <Link href={buildHref({ sort: item.value, page: 1 })}>{item.label}</Link>
          </Button>
        ))}
      </div>

      {markets.length === 0 ? (
        <Card className="mt-10">
          <CardContent className="py-20 text-center">
            <p className="font-display text-lg font-semibold">No markets here yet</p>
            <p className="mt-2 text-sm text-muted">
              Try another sport or check back once new events are listed.
            </p>
            <Button asChild variant="outline" size="sm" className="mt-6">
              <Link href="/markets">Clear filters</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {markets.map((market) => (
            <MarketCard
              key={market.id}
              market={market}
              options={optionsByMarket.get(market.id) ?? []}
            />
          ))}
        </div>
      )}

      {(page > 1 || hasNext) && (
        <nav className="mt-10 flex items-center justify-between" aria-label="Pagination">
          {page > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={buildHref({ page: page - 1 })}>Previous</Link>
            </Button>
          ) : (
            <span />
          )}
          <span className="text-xs text-muted">Page {page}</span>
          {hasNext ? (
            <Button asChild variant="outline" size="sm">
              <Link href={buildHref({ page: page + 1 })}>Next</Link>
            </Button>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
