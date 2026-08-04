import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SPORT_LABEL } from "@/lib/constants";
import { fmtCents, fmtCompact, fmtRelative } from "@/lib/utils";
import type { Market, MarketOption } from "@/lib/types";

/** Shared market tile used on the home page and the browse grid. */
export function MarketCard({
  market,
  options = [],
}: {
  market: Market;
  options?: Pick<MarketOption, "id" | "label" | "price">[];
}) {
  return (
    <Card className="group relative overflow-hidden hover:border-secondary/40">
      <Link href={`/markets/${market.slug}`} className="block p-5 focus-visible:outline-none">
        <div className="flex items-center gap-2">
          <Badge variant="outline">{SPORT_LABEL[market.sport]}</Badge>
          {market.is_trending && <Badge variant="accent">Trending</Badge>}
          {market.status === "closed" && <Badge variant="outline">Closed</Badge>}
        </div>

        <h3 className="mt-3 line-clamp-2 font-display text-base font-semibold leading-snug transition-colors group-hover:text-secondary">
          {market.question}
        </h3>

        {(market.team_a || market.team_b) && (
          <p className="mt-1.5 truncate text-xs text-muted">
            {[market.team_a, market.team_b].filter(Boolean).join(" vs ")}
            {market.league ? ` · ${market.league}` : ""}
          </p>
        )}

        {options.length > 0 && (
          <div className="mt-4 space-y-1.5">
            {options.slice(0, 3).map((option) => (
              <div
                key={option.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-accent/25 bg-accent/10 px-3 py-2"
              >
                <p className="truncate text-xs font-medium text-foreground/90">
                  {option.label}
                </p>
                <p className="font-display text-base font-bold text-accent">
                  {fmtCents(option.price)}
                </p>
              </div>
            ))}
            {options.length > 3 && (
              <p className="text-xs text-muted">+{options.length - 3} more outcomes</p>
            )}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <span>{fmtCompact(market.total_volume)} USDG volume</span>
          <span>{fmtRelative(market.end_time)}</span>
        </div>
      </Link>
    </Card>
  );
}
