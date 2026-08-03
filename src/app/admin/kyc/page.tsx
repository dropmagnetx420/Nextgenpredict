import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/stat-card";
import { ReviewDialog } from "@/components/admin/review-dialog";
import { KycFileLink } from "@/components/admin/kyc-file-link";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { reviewKyc } from "@/app/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { KYC_DOC_LABEL, PAGE_SIZE } from "@/lib/constants";
import { fmtDate, fmtDateTime } from "@/lib/utils";
import type { KycRequest, RequestStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "KYC review · Admin",
  robots: { index: false, follow: false },
};

type Row = KycRequest & {
  user: { full_name: string | null; email: string } | null;
};

const FILTERS: (RequestStatus | "all")[] = ["pending", "approved", "rejected", "all"];

export default async function AdminKycPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const status = (FILTERS as string[]).includes(params.status ?? "")
    ? (params.status as RequestStatus | "all")
    : "pending";
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("kyc_requests")
    .select("*, user:users!kyc_requests_user_id_fkey(full_name, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status !== "all") query = query.eq("status", status);

  const { data, count } = await query;
  const rows = (data ?? []) as Row[];
  const total = count ?? 0;
  const hasNext = from + rows.length < total;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Identity verification"
        description="Check that the document matches the declared details and that the selfie is the same person."
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <Link
            key={value}
            href={`/admin/kyc?status=${value}`}
            className={
              value === status
                ? "rounded-full bg-primary/20 px-3.5 py-1.5 text-xs font-medium capitalize text-foreground"
                : "rounded-full border border-white/12 px-3.5 py-1.5 text-xs font-medium capitalize text-muted hover:text-foreground"
            }
          >
            {value}
          </Link>
        ))}
      </div>

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted">
            Nothing in this queue.
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-4">
          {rows.map((row) => (
            <li key={row.id}>
              <Card>
                <CardContent className="p-6">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="font-display text-base font-semibold">{row.full_name}</p>
                      <p className="text-sm text-muted">{row.user?.email ?? "—"}</p>
                    </div>
                    <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                  </div>

                  <dl className="mt-5 grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">Document</dt>
                      <dd className="mt-1">{KYC_DOC_LABEL[row.doc_type]}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">Number</dt>
                      <dd className="mt-1 font-mono text-xs">{row.document_number}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">
                        Date of birth
                      </dt>
                      <dd className="mt-1">{fmtDate(row.date_of_birth)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs uppercase tracking-wide text-muted">Country</dt>
                      <dd className="mt-1">{row.country}</dd>
                    </div>
                  </dl>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <KycFileLink path={row.document_front_path} label="Document front" />
                    <KycFileLink path={row.document_back_path} label="Document back" />
                    <KycFileLink path={row.selfie_path} label="Selfie" />
                  </div>

                  <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-white/10 pt-4">
                    <p className="text-xs text-muted">
                      Submitted {fmtDateTime(row.created_at)}
                      {row.admin_note ? ` · Note: ${row.admin_note}` : ""}
                    </p>
                    {row.status === "pending" && (
                      <div className="flex gap-2">
                        <ReviewDialog
                          action={reviewKyc}
                          requestId={row.id}
                          decision="approved"
                          title="Approve identity"
                          description={`Verify ${row.full_name} and unlock withdrawals for this account.`}
                        />
                        <ReviewDialog
                          action={reviewKyc}
                          requestId={row.id}
                          decision="rejected"
                          title="Reject submission"
                          description="Tell the member what to fix so they can resubmit."
                          requireNote
                        />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}

      {(page > 1 || hasNext) && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Page {page} · {total} total
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/kyc?status=${status}&page=${page - 1}`}
                className="rounded-xl border border-white/12 px-4 py-2 text-sm hover:bg-white/5"
              >
                Previous
              </Link>
            )}
            {hasNext && (
              <Link
                href={`/admin/kyc?status=${status}&page=${page + 1}`}
                className="rounded-xl border border-white/12 px-4 py-2 text-sm hover:bg-white/5"
              >
                Next
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
