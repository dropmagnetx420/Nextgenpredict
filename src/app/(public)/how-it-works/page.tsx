import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { getSettings } from "@/lib/settings";
import { fmtMoney } from "@/lib/utils";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Understand how prediction market pricing, fees, settlement and payouts work on NextGen Predict.",
};

export default async function HowItWorksPage() {
  const settings = await getSettings();

  const steps = [
    {
      title: "Fund your account",
      body: `Deposit ETH, USDG, USDC or USDT on Robinhood Chain or Ethereum. Send to the address shown, submit the transaction hash, and our team credits your balance once it confirms. Minimum deposit is ${fmtMoney(settings.min_deposit)} USDG.`,
    },
    {
      title: "Read the price as a probability",
      body: "Every market is a yes-or-no question. YES and NO prices are quoted in cents and always sum to 100¢. A YES price of 63¢ means the market thinks there's a 63% chance it happens.",
    },
    {
      title: "Buy the side you think is mispriced",
      body: `Your stake buys shares at the current price. Shares = stake ÷ (price ÷ 100). A flat fee between ${fmtMoney(settings.trade_fee_min)} and ${fmtMoney(settings.trade_fee_max)} USDG applies per position, shown before you confirm.`,
    },
    {
      title: "Prices move with the flow",
      body: "As traders take sides, volume shifts the quoted odds. You can cancel an open position while the market is still open and get your stake back, minus the cancellation fee.",
    },
    {
      title: "Settlement pays winners at 1.00",
      body: "When the event finishes, we resolve the market against the official result. Winning shares settle at 1.00 USDG each, losing shares at zero. Invalid markets refund every position in full.",
    },
  ];

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">How it works</h1>
      <p className="mt-3 text-base text-muted">
        A prediction market turns an opinion into a price. Here is the full path from deposit to
        payout.
      </p>

      <ol className="mt-10 space-y-4">
        {steps.map((step, index) => (
          <li key={step.title}>
            <Card>
              <CardContent className="flex gap-5 p-6">
                <span
                  aria-hidden
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/40 bg-primary/15 font-display font-bold text-primary"
                >
                  {index + 1}
                </span>
                <div>
                  <h2 className="font-display text-base font-semibold">{step.title}</h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ol>

      <Card className="mt-8 border-secondary/25 bg-secondary/[0.06]">
        <CardContent className="p-6">
          <h2 className="font-display text-base font-semibold">A worked example</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted">
            You stake 50 USDG on YES at 40¢. That buys 125 shares (50 ÷ 0.40). If the event
            happens, those shares settle at 1.00 each — 125 USDG back, a profit of 75 USDG before
            the platform fee. If it does not happen, the position settles at zero.
          </p>
        </CardContent>
      </Card>

      <div className="mt-10 flex flex-wrap gap-3">
        <Button asChild size="lg">
          <Link href="/signup">
            Create an account <ArrowRight />
          </Link>
        </Button>
        <Button asChild size="lg" variant="outline">
          <Link href="/faq">Read the FAQ</Link>
        </Button>
      </div>
    </div>
  );
}
