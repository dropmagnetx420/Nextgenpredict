import type { Metadata } from "next";
import { CheckCircle2, Clock, XCircle } from "lucide-react";
import { PageHeader } from "@/components/dashboard/stat-card";
import { KycForm } from "@/components/dashboard/kyc-form";
import { Card, CardContent } from "@/components/ui/card";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/utils";
import type { KycRequest } from "@/lib/types";

export const metadata: Metadata = {
  title: "Verification",
  robots: { index: false, follow: false },
};

export default async function KycPage() {
  const user = await requireUser("/dashboard/kyc");

  const supabase = await createClient();
  const { data: latest } = await supabase
    .from("kyc_requests")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<KycRequest>();

  if (user.kyc_status === "approved") {
    return (
      <div className="space-y-6">
        <PageHeader title="Identity verification" />
        <Card className="border-emerald-400/25 bg-emerald-400/[0.06]">
          <CardContent className="py-14 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-emerald-400/30 bg-emerald-400/10 text-emerald-300">
              <CheckCircle2 className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-4 font-display text-base font-semibold">You&apos;re verified</p>
            <p className="mt-2 text-sm text-muted">
              Your identity was approved
              {latest?.reviewed_at ? ` on ${fmtDateTime(latest.reviewed_at)}` : ""}. Withdrawals
              are unlocked.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (user.kyc_status === "pending") {
    return (
      <div className="space-y-6">
        <PageHeader title="Identity verification" />
        <Card className="border-amber-400/25 bg-amber-400/[0.06]">
          <CardContent className="py-14 text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-300">
              <Clock className="h-6 w-6" aria-hidden />
            </span>
            <p className="mt-4 font-display text-base font-semibold">Review in progress</p>
            <p className="mt-2 text-sm text-muted">
              Submitted {latest ? fmtDateTime(latest.created_at) : "recently"}. Most reviews
              finish within one business day and we&apos;ll notify you when it&apos;s done.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Identity verification"
        description="Required before your first withdrawal. Takes about two minutes."
      />

      {user.kyc_status === "rejected" && latest && (
        <Card className="border-rose-400/25 bg-rose-400/[0.06]">
          <CardContent className="flex gap-4 p-5">
            <XCircle className="h-5 w-5 shrink-0 text-rose-300" aria-hidden />
            <div>
              <p className="font-display text-sm font-semibold">
                Your last submission was rejected
              </p>
              <p className="mt-1 text-sm text-muted">
                {latest.admin_note ??
                  "Please re-upload clearer images of your document and selfie."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <KycForm userId={user.id} defaultName={user.full_name ?? ""} />
    </div>
  );
}
