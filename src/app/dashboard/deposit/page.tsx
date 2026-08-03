import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/stat-card";
import { DepositForm } from "@/components/dashboard/deposit-form";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Deposit",
  robots: { index: false, follow: false },
};

export default async function DepositPage() {
  await requireUser("/dashboard/deposit");
  const settings = await getSettings();

  if (!settings.deposits_enabled) {
    return (
      <div className="space-y-6">
        <PageHeader title="Deposit" />
        <Card className="border-amber-400/25 bg-amber-400/[0.06]">
          <CardContent className="py-14 text-center">
            <p className="font-display text-base font-semibold">Deposits are paused</p>
            <p className="mt-2 text-sm text-muted">
              We&apos;ve temporarily disabled deposits. Please check back shortly.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deposit"
        description="Fund your account with crypto on Robinhood Chain or Ethereum."
      />
      <DepositForm
        minDeposit={settings.min_deposit}
        bonusPercent={settings.deposit_bonus_percent}
        bonusCap={settings.deposit_bonus_cap}
      />
    </div>
  );
}
