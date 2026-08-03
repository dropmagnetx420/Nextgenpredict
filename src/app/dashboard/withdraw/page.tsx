import Link from "next/link";
import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { PageHeader } from "@/components/dashboard/stat-card";
import { WithdrawForm } from "@/components/dashboard/withdraw-form";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser, getWallet } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Withdraw",
  robots: { index: false, follow: false },
};

export default async function WithdrawPage() {
  const user = await requireUser("/dashboard/withdraw");
  const settings = await getSettings();

  if (!settings.withdrawals_enabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="Withdraw" />
        <Card className="border-amber-400/25 bg-amber-400/[0.06]">
          <CardContent className="py-14 text-center">
            <p className="font-display text-base font-semibold">Withdrawals are paused</p>
            <p className="mt-2 text-sm text-muted">
              We&apos;ve temporarily disabled withdrawals. Please check back shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.kyc_status !== "approved") {
    return (
      <div className="space-y-6">
        <PageHeader title="Withdraw" />
        <Card>
          <CardContent className="py-14 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-secondary/30 bg-secondary/10 text-secondary">
              <ShieldCheck className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-4 font-display text-base font-semibold">
              Verify your identity first
            </p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted">
              {user.kyc_status === "pending"
                ? "Your documents are under review. We'll notify you as soon as it's approved."
                : "Withdrawals require a verified identity. It usually takes one business day."}
            </p>
            {user.kyc_status !== "pending" && (
              <Button asChild className="mt-6">
                <Link href="/dashboard/kyc">Start verification</Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  const supabase = await createClient();
  const [wallet, turnoverRes] = await Promise.all([
    getWallet(user.id),
    supabase.rpc("pending_turnover", { p_user_id: user.id }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Withdraw"
        description="Send your available balance to an external wallet."
      />
      <WithdrawForm
        available={Number(wallet?.available ?? 0)}
        minWithdrawal={settings.min_withdrawal}
        withdrawFee={settings.withdraw_fee}
        pendingTurnover={Number(turnoverRes.data ?? 0)}
      />
    </div>
  );
}
