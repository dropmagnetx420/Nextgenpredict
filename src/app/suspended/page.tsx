import type { Metadata } from "next";
import { ShieldAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { SignOutButton } from "@/components/dashboard/sign-out-button";
import { getSessionUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { fmtDateTime } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Account restricted",
  robots: { index: false, follow: false },
};

export default async function SuspendedPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const [params, user, settings] = await Promise.all([
    searchParams,
    getSessionUser(),
    getSettings(),
  ]);

  const banned = params.reason === "banned" || user?.status === "banned";

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md border-rose-400/25">
        <CardContent className="p-8 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-rose-400/30 bg-rose-400/10 text-rose-300">
            <ShieldAlert className="h-6 w-6" aria-hidden />
          </span>

          <h1 className="mt-4 font-display text-xl font-bold">
            {banned ? "Account closed" : "Account suspended"}
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-muted">
            {banned
              ? "This account has been permanently closed and can no longer trade."
              : "Your account is temporarily suspended, so trading and withdrawals are paused."}
          </p>

          {user?.ban_reason && (
            <p className="mt-4 rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-muted">
              {user.ban_reason}
            </p>
          )}

          {!banned && user?.suspended_until && (
            <p className="mt-4 text-sm text-muted">
              Scheduled to lift on {fmtDateTime(user.suspended_until)}.
            </p>
          )}

          <p className="mt-6 text-sm text-muted">
            Think this is a mistake? Write to{" "}
            <a
              href={`mailto:${settings.support_email}`}
              className="text-secondary hover:underline"
            >
              {settings.support_email}
            </a>
            .
          </p>

          <div className="mt-8">
            <SignOutButton className="w-full" variant="outline" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
