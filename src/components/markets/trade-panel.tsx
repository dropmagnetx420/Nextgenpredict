"use client";

import { useActionState, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Field, FormBanner, SubmitButton } from "@/components/ui/form";
import { placeTrade } from "@/app/actions/trade";
import { calcFee, calcPayout, cn, fmtCents, fmtMoney } from "@/lib/utils";
import type { ActionResult, Trade, MarketOption } from "@/lib/types";

export function TradePanel({
  marketId,
  options,
  minTrade,
  maxTrade,
  isOpen,
  isSignedIn,
  balance,
  fee,
}: {
  marketId: string;
  options: Pick<MarketOption, "id" | "label" | "price">[];
  minTrade: number;
  maxTrade: number;
  isOpen: boolean;
  isSignedIn: boolean;
  balance: number | null;
  fee: { percent: number; min: number; max: number };
}) {
  const router = useRouter();
  const [optionId, setOptionId] = useState(options[0]?.id ?? "");
  const [stake, setStake] = useState(String(minTrade));

  const [state, action] = useActionState<ActionResult<Trade> | null, FormData>(
    placeTrade,
    null
  );

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Prediction placed.");
      setStake(String(minTrade));
      router.refresh();
    }
  }, [state, minTrade, router]);

  const selected = options.find((opt) => opt.id === optionId) ?? options[0];
  const price = selected?.price ?? 50;
  const stakeNum = Number(stake) || 0;
  const feeAmount = stakeNum > 0 ? calcFee(stakeNum, fee.percent, fee.min, fee.max) : 0;
  const payout = calcPayout(stakeNum, price);
  const profit = payout - stakeNum;
  const total = stakeNum + feeAmount;
  const insufficient = balance !== null && total > balance;

  if (!isOpen) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="font-display text-base font-semibold">Market closed</p>
          <p className="mt-2 text-sm text-muted">
            This market is no longer accepting predictions.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="sticky top-20">
      <CardContent className="p-5">
        <div className="space-y-2" role="group" aria-label="Choose an outcome">
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setOptionId(option.id)}
              aria-pressed={optionId === option.id}
              className={cn(
                "w-full rounded-xl border px-3 py-3 text-left transition-all",
                optionId === option.id
                  ? "border-accent/60 bg-accent/15 shadow-[0_0_24px_-8px_var(--color-accent)]"
                  : "border-white/10 bg-white/[0.03] hover:border-accent/40"
              )}
            >
              <span className="flex items-center justify-between">
                <span className="text-sm font-medium text-foreground">{option.label}</span>
                <span className="font-display text-xl font-bold text-accent">
                  {fmtCents(option.price)}
                </span>
              </span>
            </button>
          ))}
        </div>

        {isSignedIn ? (
          <form action={action} className="mt-5 space-y-4">
            <input type="hidden" name="market_id" value={marketId} />
            <input type="hidden" name="option_id" value={optionId} />

            {!state?.ok && state?.error && <FormBanner>{state.error}</FormBanner>}

            <Field
              label="Stake (USDG)"
              htmlFor="stake"
              hint={`Min ${fmtMoney(minTrade)} · Max ${fmtMoney(maxTrade)}`}
              errors={!state?.ok ? state?.fieldErrors?.stake : undefined}
            >
              <Input
                id="stake"
                name="stake"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={minTrade}
                max={maxTrade}
                required
                value={stake}
                onChange={(e) => setStake(e.target.value)}
              />
            </Field>

            <div className="flex gap-2">
              {[10, 25, 50, 100].map((amount) => (
                <Button
                  key={amount}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setStake(String(amount))}
                >
                  {amount}
                </Button>
              ))}
            </div>

            <dl className="space-y-1.5 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted">Shares</dt>
                <dd className="font-medium">{payout.toFixed(2)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Platform fee</dt>
                <dd className="font-medium">{fmtMoney(feeAmount)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Total cost</dt>
                <dd className="font-medium">{fmtMoney(total)}</dd>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-1.5">
                <dt className="text-muted">Payout if correct</dt>
                <dd className="font-display font-bold text-accent">{fmtMoney(payout)}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-muted">Profit</dt>
                <dd className="font-medium text-accent">+{fmtMoney(profit)}</dd>
              </div>
            </dl>

            {balance !== null && (
              <p className="text-xs text-muted">
                Available balance: {fmtMoney(balance)} USDG
              </p>
            )}

            {insufficient ? (
              <Button asChild className="w-full" variant="accent">
                <Link href="/dashboard/deposit">Add funds to continue</Link>
              </Button>
            ) : (
              <SubmitButton className="w-full" size="lg" pendingLabel="Placing…">
                Buy {selected?.label ?? "outcome"} at {fmtCents(price)}
              </SubmitButton>
            )}
          </form>
        ) : (
          <div className="mt-5 space-y-3">
            <Button asChild className="w-full" size="lg">
              <Link href={`/login?next=/markets`}>Sign in to predict</Link>
            </Button>
            <p className="text-center text-xs text-muted">
              New here?{" "}
              <Link href="/signup" className="text-secondary hover:underline">
                Create an account
              </Link>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
