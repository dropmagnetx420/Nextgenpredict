import type { Metadata } from "next";
import { PageHeader, StatCard } from "@/components/dashboard/stat-card";
import { CopyField } from "@/components/dashboard/copy-field";
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
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { createClient } from "@/lib/supabase/server";
import { fmtDate, fmtMoney } from "@/lib/utils";
import type { Referral } from "@/lib/types";

export const metadata: Metadata = {
  title: "Referrals",
  robots: { index: false, follow: false },
};

type ReferralRow = Referral & {
  referred: { full_name: string | null; email: string; created_at: string } | null;
};

export default async function ReferralsPage() {
  const user = await requireUser("/dashboard/referrals");
  const settings = await getSettings();

  const supabase = await createClient();
  const { data } = await supabase
    .from("referrals")
    .select("*, referred:users!referrals_referred_id_fkey(full_name, email, created_at)")
    .eq("referrer_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const referrals = (data ?? []) as ReferralRow[];

  const totalCommission = referrals.reduce(
    (sum, item) => sum + Number(item.total_commission),
    0
  );
  const totalVolume = referrals.reduce((sum, item) => sum + Number(item.total_volume), 0);

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "";
  const inviteLink = `${siteUrl}/signup?ref=${user.referral_code}`;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Referrals"
        description={`Earn ${settings.referral_commission_percent}% of the platform fee on every trade your invitees place.`}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Invitees" value={String(referrals.length)} />
        <StatCard
          label="Commission earned"
          value={`${fmtMoney(totalCommission)} USDG`}
          tone="accent"
        />
        <StatCard label="Referred volume" value={`${fmtMoney(totalVolume)} USDG`} />
      </div>

      <Card>
        <CardContent className="p-6">
          <h2 className="font-display text-base font-semibold">Your invite link</h2>
          <p className="mt-1.5 text-sm text-muted">
            Share this anywhere. Anyone who signs up through it is linked to you permanently.
          </p>

          <div className="mt-4 space-y-3">
            <div>
              <p className="mb-1.5 text-xs uppercase tracking-wide text-muted">Referral code</p>
              <CopyField value={user.referral_code} label="Referral code" />
            </div>
            <div>
              <p className="mb-1.5 text-xs uppercase tracking-wide text-muted">Invite link</p>
              <CopyField value={inviteLink} label="Invite link" />
            </div>
          </div>

          {settings.referral_signup_bonus > 0 && (
            <p className="mt-4 text-sm text-muted">
              You also earn {fmtMoney(settings.referral_signup_bonus)} USDG once an invitee
              deposits at least {fmtMoney(settings.referral_min_deposit)} USDG.
            </p>
          )}
        </CardContent>
      </Card>

      <section>
        <h2 className="font-display text-lg font-semibold">Your invitees</h2>
        <Card className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Member</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="text-right">Volume</TableHead>
                <TableHead className="text-right">Your commission</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {referrals.length === 0 ? (
                <TableEmpty colSpan={4}>
                  No one has signed up with your code yet.
                </TableEmpty>
              ) : (
                referrals.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">
                      {item.referred?.full_name ?? "Member"}
                      <p className="text-xs text-muted">
                        {item.referred?.email
                          ? `${item.referred.email.slice(0, 3)}•••@${item.referred.email.split("@")[1] ?? ""}`
                          : "—"}
                      </p>
                    </TableCell>
                    <TableCell className="text-muted">{fmtDate(item.created_at)}</TableCell>
                    <TableCell className="text-right">{fmtMoney(item.total_volume)}</TableCell>
                    <TableCell className="text-right font-medium text-accent">
                      {fmtMoney(item.total_commission)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </Card>
      </section>
    </div>
  );
}
