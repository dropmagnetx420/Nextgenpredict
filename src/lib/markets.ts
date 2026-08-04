import { createClient } from "@/lib/supabase/server";
import type { MarketOption } from "@/lib/types";

/** Just enough of an outcome to quote it in a list or a card. */
export type OptionQuote = Pick<MarketOption, "id" | "market_id" | "label" | "price">;

/**
 * Outcomes for a batch of markets, grouped by market id. Market lists render
 * many cards at once, so this is one round trip instead of one per card.
 */
export async function getOptionsByMarket(
  marketIds: string[]
): Promise<Map<string, OptionQuote[]>> {
  const grouped = new Map<string, OptionQuote[]>();
  if (marketIds.length === 0) return grouped;

  const supabase = await createClient();
  const { data } = await supabase
    .from("market_options")
    .select("id, market_id, label, price")
    .in("market_id", marketIds)
    .eq("is_active", true)
    .order("sort_order");

  for (const option of (data ?? []) as OptionQuote[]) {
    const list = grouped.get(option.market_id) ?? [];
    list.push(option);
    grouped.set(option.market_id, list);
  }

  return grouped;
}
