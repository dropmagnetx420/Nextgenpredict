import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/stat-card";
import { PasswordForm, ProfileForm } from "@/components/dashboard/settings-forms";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { fmtDate } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Settings",
  robots: { index: false, follow: false },
};

export default async function SettingsPage() {
  const user = await requireUser("/dashboard/settings");

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" description="Manage your account details and security." />

      <ProfileForm user={user} />

      <Card>
        <CardContent className="p-6">
          <h2 className="font-display text-base font-semibold">Account</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Verification</dt>
              <dd className="flex items-center gap-2">
                <Badge variant={statusVariant(user.kyc_status)}>{user.kyc_status}</Badge>
                {user.kyc_status !== "approved" && (
                  <Link href="/dashboard/kyc" className="text-xs text-secondary hover:underline">
                    Verify
                  </Link>
                )}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Referral code</dt>
              <dd className="font-mono text-xs">{user.referral_code}</dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-muted">Member since</dt>
              <dd>{fmtDate(user.created_at)}</dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <PasswordForm />

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <h2 className="font-display text-base font-semibold">Sign out</h2>
            <p className="mt-1.5 text-sm text-muted">
              End this session on this device. Your positions stay open.
            </p>
          </div>
          <SignOutButton />
        </CardContent>
      </Card>
    </div>
  );
}
