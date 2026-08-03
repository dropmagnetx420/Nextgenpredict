import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { PageHeader, StatCard } from "@/components/dashboard/stat-card";
import { MarketForm } from "@/components/admin/market-form";
import { ResolveMarketDialog } from "@/components/admin/resolve-market-dialog";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { fmtCents, fmtDateTime, fmtMoney } from "@/lib/utils";
import type { Market } from "@/lib/types";

export const metadata: Metadata = {
  title: "Edit market · Admin",
  robots: { index: false, follow: false },
};

export default async function EditMarketPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data } = await supabase
    .from("markets")
    .select("*")
    .eq("id", id)
    .maybeSingle<Market>();

  if (!data) notFound();
  const market = data;

  const settled = market.status === "resolved" || market.status === "cancelled";

  return (
    <div className="space-y-6">
      <PageHeader
        title="Edit market"
        description={market.title}
        action={
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(market.status)}>{market.status}</Badge>
            {!settled && (
              <ResolveMarketDialog marketId={market.id} question={market.question} />
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Volume" value={`${fmtMoney(market.total_volume)} USDG`} />
        <StatCard label="Trades" value={String(market.trade_count)} />
        <StatCard label="YES" value={fmtCents(market.yes_price)} tone="accent" />
        <StatCard label="NO" value={fmtCents(100 - market.yes_price)} />
      </div>

      {settled ? (
        <Card>
          <CardContent className="p-6">
            <p className="font-display text-base font-semibold">
              Settled {market.outcome?.toUpperCase()}
            </p>
            <p className="mt-1.5 text-sm text-muted">
              {market.resolved_at ? fmtDateTime(market.resolved_at) : "—"}
              {market.resolution_note ? ` · ${market.resolution_note}` : ""}
            </p>
            <p className="mt-4 text-sm text-muted">
              Settled markets are read-only.{" "}
              <Link href="/admin/markets" className="text-secondary hover:underline">
                Back to markets
              </Link>
            </p>
          </CardContent>
        </Card>
      ) : (
        <MarketForm market={market} />
      )}
    </div>
  );
}
