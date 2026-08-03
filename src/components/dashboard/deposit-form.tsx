"use client";

import { useActionState, useEffect, useState } from "react";
import { Check, Copy, RefreshCw } from "lucide-react";
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
import { getDepositAddress, submitDeposit } from "@/app/actions/wallet";
import { NETWORKS, assetsForNetwork } from "@/lib/constants";
import { fmtMoney } from "@/lib/utils";
import type {
  ActionResult,
  AssetSymbol,
  ChainNetwork,
  DepositRequest,
} from "@/lib/types";

export function DepositForm({
  minDeposit,
  bonusPercent,
  bonusCap,
}: {
  minDeposit: number;
  bonusPercent: number;
  bonusCap: number;
}) {
  const [network, setNetwork] = useState<ChainNetwork>("robinhood");
  const [asset, setAsset] = useState<AssetSymbol>("USDG");
  const [amount, setAmount] = useState("");
  const [address, setAddress] = useState<string | null>(null);
  const [loadingAddress, setLoadingAddress] = useState(false);
  const [copied, setCopied] = useState(false);

  const [state, action] = useActionState<ActionResult<DepositRequest> | null, FormData>(
    submitDeposit,
    null
  );

  const assets = assetsForNetwork(network);

  // Keep the selected asset valid whenever the network changes.
  useEffect(() => {
    if (!assets.includes(asset)) setAsset(assets[0]!);
  }, [assets, asset]);

  useEffect(() => {
    let active = true;
    setLoadingAddress(true);
    setAddress(null);

    getDepositAddress(network, asset)
      .then((result) => {
        if (active) setAddress(result?.address ?? null);
      })
      .finally(() => {
        if (active) setLoadingAddress(false);
      });

    return () => {
      active = false;
    };
  }, [network, asset]);

  useEffect(() => {
    if (state?.ok) {
      toast.success(state.message ?? "Deposit submitted.");
      setAmount("");
    }
  }, [state]);

  const amountNum = Number(amount) || 0;
  const bonusAmount =
    bonusPercent > 0 ? Math.min((amountNum * bonusPercent) / 100, bonusCap) : 0;

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the address manually.");
    }
  };

  const errors = state && !state.ok ? state.fieldErrors : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <CardContent className="p-6">
          <h2 className="font-display text-base font-semibold">1. Send your transfer</h2>
          <p className="mt-1.5 text-sm text-muted">
            Pick a network and asset, then send to the address shown.
          </p>

          <div className="mt-5 space-y-4">
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

            <div>
              <p className="text-sm font-medium text-foreground/90">Deposit address</p>
              <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-white/12 bg-black/25 px-3.5 py-2.5">
                <code className="min-w-0 flex-1 break-all text-xs text-foreground">
                  {loadingAddress
                    ? "Loading…"
                    : (address ?? "No address configured for this pair")}
                </code>
                {address && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="iconSm"
                    onClick={copyAddress}
                    aria-label="Copy deposit address"
                  >
                    {copied ? <Check className="text-accent" /> : <Copy />}
                  </Button>
                )}
              </div>
              <p className="mt-2 text-xs text-muted">
                <RefreshCw className="mr-1 inline h-3 w-3" aria-hidden />
                Addresses rotate. Always copy the one shown for this transfer.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <h2 className="font-display text-base font-semibold">2. Confirm the details</h2>
          <p className="mt-1.5 text-sm text-muted">
            Submit the transaction hash so we can verify and credit it.
          </p>

          <form action={action} className="mt-5 space-y-4">
            <input type="hidden" name="network" value={network} />
            <input type="hidden" name="asset" value={asset} />
            <input type="hidden" name="to_address" value={address ?? ""} />

            {state?.ok && <FormBanner variant="success">{state.message}</FormBanner>}
            {state && !state.ok && <FormBanner>{state.error}</FormBanner>}

            <Field
              label="Amount (USDG value)"
              htmlFor="amount"
              hint={`Minimum ${fmtMoney(minDeposit)} USDG`}
              errors={errors?.amount}
            >
              <Input
                id="amount"
                name="amount"
                type="number"
                inputMode="decimal"
                step="0.01"
                min={minDeposit}
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="100.00"
              />
            </Field>

            <Field
              label="Transaction hash"
              htmlFor="tx_hash"
              hint="The 0x… hash from your wallet after sending."
              errors={errors?.tx_hash}
            >
              <Input id="tx_hash" name="tx_hash" required placeholder="0x…" />
            </Field>

            {bonusAmount > 0 && (
              <FormBanner variant="info">
                This deposit qualifies for a {fmtMoney(bonusAmount)} USDG bonus
                ({bonusPercent}%{bonusCap ? `, capped at ${fmtMoney(bonusCap)}` : ""}).
              </FormBanner>
            )}

            <SubmitButton
              className="w-full"
              size="lg"
              pendingLabel="Submitting…"
              disabled={!address}
            >
              Submit deposit
            </SubmitButton>

            <p className="text-xs text-muted">
              Deposits are credited after our team confirms the transfer on-chain, usually
              within one business day.
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
