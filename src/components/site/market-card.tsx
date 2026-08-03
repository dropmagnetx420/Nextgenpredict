import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SPORT_LABEL } from "@/lib/constants";
import { fmtCents, fmtCompact, fmtRelative } from "@/lib/utils";
import type { Market } from "@/lib/types";

/** Shared market tile used on the home page and the browse grid. */
export function MarketCard({ market }: { market: Market }) {
  const yes = Number(market.yes_price);
  const no = 100 - yes;

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

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-emerald-300/80">
              Yes
            </p>
            <p className="font-display text-lg font-bold text-emerald-300">{fmtCents(yes)}</p>
          </div>
          <div className="rounded-xl border border-rose-400/25 bg-rose-400/10 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-rose-300/80">No</p>
            <p className="font-display text-lg font-bold text-rose-300">{fmtCents(no)}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-xs text-muted">
          <span>{fmtCompact(market.total_volume)} USDG volume</span>
          <span>{fmtRelative(market.end_time)}</span>
        </div>
      </Link>
    </Card>
  );
}
