import Link from "next/link";
import { ArrowRight, ShieldCheck, Wallet, Zap } from "lucide-react";
import { MarketCard } from "@/components/site/market-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SPORTS, FAQ_ITEMS } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { getOptionsByMarket } from "@/lib/markets";
import { fmtCompact, fmtMoney } from "@/lib/utils";
import type { Market, Partner, PromoBanner } from "@/lib/types";

export const revalidate = 30;

const FEATURES = [
  {
    icon: Zap,
    title: "Live, volume-driven odds",
    body: "Prices move with real trading flow, so every quote reflects what the market actually believes right now.",
  },
  {
    icon: Wallet,
    title: "Crypto in, crypto out",
    body: "Fund with ETH, USDG, USDC or USDT across Robinhood Chain and Ethereum. Withdrawals reviewed same day.",
  },
  {
    icon: ShieldCheck,
    title: "Settled on the record",
    body: "Every market resolves against the official result, with the resolution note attached for anyone to audit.",
  },
];

export default async function HomePage() {
  const supabase = await createClient();
  const settings = await getSettings();

  const [featuredRes, trendingRes, promosRes, partnersRes] = await Promise.all([
    supabase
      .from("markets")
      .select("*")
      .eq("status", "open")
      .eq("is_featured", true)
      .order("total_volume", { ascending: false })
      .limit(6),
    supabase
      .from("markets")
      .select("*")
      .eq("status", "open")
      .order("total_volume", { ascending: false })
      .limit(6),
    supabase
      .from("promo_banners")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .limit(3),
    supabase
      .from("partners")
      .select("*")
      .eq("is_active", true)
      .order("sort_order")
      .limit(12),
  ]);

  const featured = (featuredRes.data ?? []) as Market[];
  const trending = (trendingRes.data ?? []) as Market[];
  const markets = featured.length > 0 ? featured : trending;
  const promos = (promosRes.data ?? []) as PromoBanner[];
  const partners = (partnersRes.data ?? []) as Partner[];

  const totalVolume = markets.reduce((sum, m) => sum + Number(m.total_volume), 0);
  const totalTrades = markets.reduce((sum, m) => sum + Number(m.trade_count), 0);
  const optionsByMarket = await getOptionsByMarket(markets.map((market) => market.id));

  return (
    <>
      <section className="relative overflow-hidden">
        <div className="mx-auto w-full max-w-7xl px-4 py-20 sm:px-6 lg:py-28">
          <div className="max-w-3xl">
            <Badge variant="secondary">{settings.site_tagline}</Badge>
            <h1 className="mt-5 font-display text-4xl font-bold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
              Trade the outcome of{" "}
              <span className="text-gradient">every game that matters</span>
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-muted sm:text-lg">
              Back any outcome — home, draw, away or anything else — on football, cricket,
              basketball, tennis and esports events. Prices are probabilities in cents.
              Winning shares settle at 1.00 USDG.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg">
                <Link href="/signup">
                  Start predicting <ArrowRight />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <Link href="/markets">Browse markets</Link>
              </Button>
            </div>

            {settings.welcome_bonus_amount > 0 && (
              <p className="mt-4 text-sm text-muted">
                New accounts get a{" "}
                <span className="font-semibold text-accent">
                  {fmtMoney(settings.welcome_bonus_amount)} USDG
                </span>{" "}
                welcome bonus after email confirmation.
              </p>
            )}
          </div>

          <dl className="mt-14 grid max-w-2xl grid-cols-3 gap-4">
            <div className="rounded-2xl border border-white/10 bg-surface/50 px-4 py-4 backdrop-blur-xl">
              <dt className="text-xs uppercase tracking-wide text-muted">Open markets</dt>
              <dd className="mt-1 font-display text-2xl font-bold">{markets.length}</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-surface/50 px-4 py-4 backdrop-blur-xl">
              <dt className="text-xs uppercase tracking-wide text-muted">Volume</dt>
              <dd className="mt-1 font-display text-2xl font-bold">{fmtCompact(totalVolume)}</dd>
            </div>
            <div className="rounded-2xl border border-white/10 bg-surface/50 px-4 py-4 backdrop-blur-xl">
              <dt className="text-xs uppercase tracking-wide text-muted">Predictions</dt>
              <dd className="mt-1 font-display text-2xl font-bold">{fmtCompact(totalTrades)}</dd>
            </div>
          </dl>
        </div>
      </section>

      {promos.length > 0 && (
        <section className="mx-auto w-full max-w-7xl px-4 pb-4 sm:px-6">
          <div className="grid gap-4 md:grid-cols-3">
            {promos.map((promo) => (
              <Card key={promo.id} className="border-primary/25 bg-primary/[0.07]">
                <CardContent className="p-5">
                  <h2 className="font-display text-base font-semibold">{promo.title}</h2>
                  {promo.subtitle && (
                    <p className="mt-1.5 text-sm text-muted">{promo.subtitle}</p>
                  )}
                  {promo.promo_bonus_percent ? (
                    <p className="mt-3 font-display text-xl font-bold text-accent">
                      +{promo.promo_bonus_percent}% bonus
                      {promo.promo_bonus_cap
                        ? ` up to ${fmtMoney(promo.promo_bonus_cap)} USDG`
                        : ""}
                    </p>
                  ) : null}
                  {promo.cta_label && promo.cta_link && (
                    <Button asChild size="sm" variant="outline" className="mt-4">
                      <Link href={promo.cta_link}>{promo.cta_label}</Link>
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}

      <section className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="font-display text-2xl font-bold sm:text-3xl">
              {featured.length > 0 ? "Featured markets" : "Most active markets"}
            </h2>
            <p className="mt-1.5 text-sm text-muted">
              Live prices across every sport we cover.
            </p>
          </div>
          <Button asChild variant="ghost" size="sm">
            <Link href="/markets">
              View all <ArrowRight />
            </Link>
          </Button>
        </div>

        {markets.length === 0 ? (
          <Card className="mt-8">
            <CardContent className="py-16 text-center">
              <p className="text-sm text-muted">
                No markets are open right now. Check back shortly.
              </p>
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

        <div className="mt-10 flex flex-wrap gap-2">
          {SPORTS.map((sport) => (
            <Button key={sport.value} asChild variant="outline" size="sm">
              <Link href={`/markets?sport=${sport.value}`}>
                <span aria-hidden>{sport.emoji}</span> {sport.label}
              </Link>
            </Button>
          ))}
        </div>
      </section>

      <section className="border-y border-white/10 bg-surface/30">
        <div className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6">
          <h2 className="font-display text-2xl font-bold sm:text-3xl">
            Built for people who take the call seriously
          </h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <Card key={feature.title}>
                <CardContent className="p-6">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-secondary/30 bg-secondary/10 text-secondary">
                    <feature.icon className="h-5 w-5" aria-hidden />
                  </span>
                  <h3 className="mt-4 font-display text-base font-semibold">{feature.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{feature.body}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6">
        <h2 className="font-display text-2xl font-bold sm:text-3xl">Common questions</h2>
        <div className="mt-6 divide-y divide-white/10 rounded-2xl border border-white/10 bg-surface/50">
          {FAQ_ITEMS.slice(0, 4).map((item) => (
            <details key={item.q} className="group px-5 py-4">
              <summary className="cursor-pointer list-none font-medium marker:content-none">
                <span className="flex items-center justify-between gap-4">
                  {item.q}
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-90"
                    aria-hidden
                  />
                </span>
              </summary>
              <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
            </details>
          ))}
        </div>
        <Button asChild variant="ghost" size="sm" className="mt-4">
          <Link href="/faq">
            All questions <ArrowRight />
          </Link>
        </Button>
      </section>

      {partners.length > 0 && (
        <section className="border-t border-white/10">
          <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6">
            <p className="text-center text-xs uppercase tracking-widest text-muted">
              Trusted by
            </p>
            <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {partners.map((partner) => (
                <li key={partner.id} className="text-sm font-medium text-muted">
                  {partner.website ? (
                    <a
                      href={partner.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="transition-colors hover:text-foreground"
                    >
                      {partner.name}
                    </a>
                  ) : (
                    partner.name
                  )}
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </>
  );
}
