import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader, StatCard } from "@/components/dashboard/stat-card";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { NETWORK_LABEL } from "@/lib/constants";
import { requireUser, getWallet } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime, fmtMoney, truncateAddress } from "@/lib/utils";
import type {
  BonusHistory,
  DepositRequest,
  Transaction,
  WithdrawRequest,
} from "@/lib/types";

export const metadata: Metadata = {
  title: "Wallet",
  robots: { index: false, follow: false },
};

const TX_LABEL: Record<string, string> = {
  deposit: "Deposit",
  withdrawal: "Withdrawal",
  trade_open: "Prediction placed",
  trade_cancel: "Prediction cancelled",
  trade_payout: "Payout",
  trade_refund: "Refund",
  fee: "Fee",
  bonus: "Bonus",
  referral_commission: "Referral commission",
  admin_adjustment: "Adjustment",
};

export default async function WalletPage() {
  const user = await requireUser("/dashboard/wallet");
  const supabase = await createClient();

  const [wallet, txRes, depositsRes, withdrawalsRes, bonusRes, turnoverRes] =
    await Promise.all([
      getWallet(user.id),
      supabase
        .from("transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(25),
      supabase
        .from("deposit_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("withdraw_requests")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(10),
      supabase
        .from("bonus_history")
        .select("*")
        .eq("user_id", user.id)
        .eq("is_cleared", false)
        .order("created_at", { ascending: false }),
      supabase.rpc("pending_turnover", { p_user_id: user.id }),
    ]);

  const transactions = (txRes.data ?? []) as Transaction[];
  const deposits = (depositsRes.data ?? []) as DepositRequest[];
  const withdrawals = (withdrawalsRes.data ?? []) as WithdrawRequest[];
  const bonuses = (bonusRes.data ?? []) as BonusHistory[];
  const pendingTurnover = Number(turnoverRes.data ?? 0);

  const available = Number(wallet?.available ?? 0);
  const bonus = Number(wallet?.bonus ?? 0);
  const locked = Number(wallet?.locked ?? 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Wallet"
        description="Balances, transfers and your full transaction history."
        action={
          <div className="flex gap-2">
            <Button asChild size="sm">
              <Link href="/dashboard/deposit">Deposit</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/dashboard/withdraw">Withdraw</Link>
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Available" value={`${fmtMoney(available)} USDG`} />
        <StatCard label="Bonus" value={`${fmtMoney(bonus)} USDG`} tone="accent" />
        <StatCard label="Locked" value={`${fmtMoney(locked)} USDG`} hint="In open positions" />
        <StatCard
          label="Total deposited"
          value={`${fmtMoney(wallet?.total_deposited ?? 0)} USDG`}
          hint={`${fmtMoney(wallet?.total_withdrawn ?? 0)} withdrawn`}
        />
      </div>

      {bonuses.length > 0 && (
        <Card className="border-accent/25 bg-accent/[0.05]">
          <CardContent className="p-5">
            <h2 className="font-display text-base font-semibold">Bonus turnover</h2>
            <p className="mt-1 text-sm text-muted">
              {fmtMoney(pendingTurnover)} USDG of wagering left before bonus funds unlock for
              withdrawal.
            </p>

            <ul className="mt-4 space-y-3">
              {bonuses.map((item) => {
                const required = Number(item.turnover_required);
                const progress = Number(item.turnover_progress);
                const pct = required > 0 ? Math.min(100, (progress / required) * 100) : 100;

                return (
                  <li key={item.id}>
                    <div className="flex justify-between text-sm">
                      <span className="capitalize">{item.kind} bonus</span>
                      <span className="text-muted">
                        {fmtMoney(progress)} / {fmtMoney(required)}
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full bg-gradient-to-r from-primary to-accent"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <section>
        <h2 className="font-display text-lg font-semibold">Recent transactions</h2>
        <Card className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Type</TableHead>
                <TableHead>Description</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
                <TableHead className="text-right">Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.length === 0 ? (
                <TableEmpty colSpan={5}>No transactions yet.</TableEmpty>
              ) : (
                transactions.map((tx) => {
                  const amount = Number(tx.amount);
                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="whitespace-nowrap font-medium">
                        {TX_LABEL[tx.type] ?? tx.type}
                        {tx.wallet === "bonus" && (
                          <Badge variant="accent" className="ml-2 px-1.5 py-0 text-[10px]">
                            bonus
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-muted">
                        {tx.description ?? "—"}
                      </TableCell>
                      <TableCell
                        className={
                          amount >= 0
                            ? "text-right font-medium text-emerald-300"
                            : "text-right font-medium text-rose-300"
                        }
                      >
                        {amount >= 0 ? "+" : ""}
                        {fmtMoney(amount)}
                      </TableCell>
                      <TableCell className="text-right text-muted">
                        {fmtMoney(tx.balance_after)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-right text-muted">
                        {fmtDateTime(tx.created_at)}
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </Card>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section>
          <h2 className="font-display text-lg font-semibold">Deposit requests</h2>
          <Card className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Network</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deposits.length === 0 ? (
                  <TableEmpty colSpan={3}>No deposits yet.</TableEmpty>
                ) : (
                  deposits.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="font-medium">{fmtMoney(item.amount)}</span>{" "}
                        <span className="text-xs text-muted">{item.asset}</span>
                        <p className="text-xs text-muted">{fmtDateTime(item.created_at)}</p>
                      </TableCell>
                      <TableCell className="text-muted">
                        {NETWORK_LABEL[item.network]}
                        <p className="text-xs">{truncateAddress(item.tx_hash, 8)}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </section>

        <section>
          <h2 className="font-display text-lg font-semibold">Withdrawal requests</h2>
          <Card className="mt-4">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Amount</TableHead>
                  <TableHead>Destination</TableHead>
                  <TableHead className="text-right">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {withdrawals.length === 0 ? (
                  <TableEmpty colSpan={3}>No withdrawals yet.</TableEmpty>
                ) : (
                  withdrawals.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell>
                        <span className="font-medium">{fmtMoney(item.net_amount)}</span>{" "}
                        <span className="text-xs text-muted">{item.asset}</span>
                        <p className="text-xs text-muted">{fmtDateTime(item.created_at)}</p>
                      </TableCell>
                      <TableCell className="text-muted">
                        {NETWORK_LABEL[item.network]}
                        <p className="text-xs">{truncateAddress(item.to_address)}</p>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={statusVariant(item.status)}>{item.status}</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </section>
      </div>
    </div>
  );
}
