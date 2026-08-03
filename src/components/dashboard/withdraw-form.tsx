"use client";

import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FormBanner, SubmitButton } from "@/components/ui/form";
import { submitWithdrawal } from "@/app/actions/wallet";
import { NETWORKS, assetsForNetwork } from "@/lib/constants";
import { fmtMoney } from "@/lib/utils";
import type {
  ActionResult,
  AssetSymbol,
  ChainNetwork,
  WithdrawRequest,
} from "@/lib/types";

export function WithdrawForm({
  available,
  minWithdrawal,
  withdrawFee,
  pendingTurnover,
}: {
  available: number;
  minWithdrawal: number;
  withdrawFee: number;
  pendingTurnover: number;
}) {
  const [network, setNetwork] = useState<ChainNetwork>("robinhood");
  const [asset, setAsset] = useState<AssetSymbol>("USDG");
  const [amount, setAmount] = useState("");

  const [state, action] = useActionState<ActionResult<WithdrawRequest> | null, FormData>(
    submitWithdrawal,
    null
  );

  const assets = assetsForNetwork(network);

  useEffect(() => {
    if (!assets.includes(asset)) setAsset(assets[0]!);
  }, [assets, asset]);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Withdrawal requested.");
      setAmount("");
    }
  }, [state]);

  const amountNum = Number(amount) || 0;
  const net = Math.max(0, amountNum - withdrawFee);
  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardContent className="p-6">
          <form action={action} className="space-y-4">
            <input type="hidden" name="network" value={network} />
            <input type="hidden" name="asset" value={asset} />

            {state?.ok && <FormBanner variant="success">{state.message}</FormBanner>}
            {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

            {pendingTurnover > 0 && (
              <FormBanner variant="info">
                {fmtMoney(pendingTurnover)} USDG of bonus turnover is still outstanding. Bonus
                funds stay locked until it clears.
              </FormBanner>
            )}

            <Field label="Network" htmlFor="network-select">
              <Select
                value={network}
                onValueChange={(value) => setNetwork(value as ChainNetwork)}
              >
                <SelectTrigger id="network-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NETWORKS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Asset" htmlFor="asset-select">
              <Select value={asset} onValueChange={(value) => setAsset(value as AssetSymbol)}>
                <SelectTrigger id="asset-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Amount (USDG)"
              htmlFor="amount"
              hint={`Minimum ${fmtMoney(minWithdrawal)} · Available ${fmtMoney(available)}`}
              errors={errors?.amount}
            >
              <Input
                id="amount"
                name="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={minWithdrawal}
                max={available}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50.00"
              />
            </Field>

            <div className="flex gap-2">
              {[25, 50, 100].map((pct) => (
                <Button
                  key={pct}
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setAmount(((available * pct) / 100).toFixed(2))}
                >
                  {pct}%
                </Button>
              ))}
            </div>

            <Field
              label="Destination address"
              htmlFor="to_address"
              hint="Double-check this. Transfers to a wrong address cannot be reversed."
              errors={errors?.to_address}
            >
              <Input id="to_address" name="to_address" required placeholder="0x…" />
            </Field>

            <SubmitButton
              className="w-full"
              size="lg"
              pendingLabel="Requesting…"
              disabled={available < minWithdrawal}
            >
              Request withdrawal
            </SubmitButton>

            {available < minWithdrawal && (
              <p className="text-xs text-muted">
                Your available balance is below the {fmtMoney(minWithdrawal)} USDG minimum.
              </p>
            )}
          </form>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardContent className="p-6">
          <h2 className="font-display text-base font-semibold">Summary</h2>
          <dl className="mt-4 space-y-2.5 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted">Requested</dt>
              <dd className="font-medium">{fmtMoney(amountNum)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted">Network fee</dt>
              <dd className="font-medium">−{fmtMoney(withdrawFee)}</dd>
            </div>
            <div className="flex justify-between border-t border-white/10 pt-2.5">
              <dt className="text-muted">You receive</dt>
              <dd className="font-display font-bold text-accent">{fmtMoney(net)}</dd>
            </div>
          </dl>

          <p className="mt-5 text-xs leading-relaxed text-muted">
            Requests are reviewed by our team before the transfer is broadcast. You&apos;ll get a
            notification once it&apos;s processed.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
