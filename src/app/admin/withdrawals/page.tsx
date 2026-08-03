import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/stat-card";
import { ReviewDialog } from "@/components/admin/review-dialog";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { reviewWithdrawal } from "@/app/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { NETWORK_LABEL, PAGE_SIZE } from "@/lib/constants";
import { fmtDateTime, fmtMoney, truncateAddress } from "@/lib/utils";
import type { RequestStatus, WithdrawRequest } from "@/lib/types";

export const metadata: Metadata = {
  title: "Withdrawals · Admin",
  robots: { index: false, follow: false },
};

type Row = WithdrawRequest & {
  user: { full_name: string | null; email: string; kyc_status: string } | null;
};

const FILTERS: (RequestStatus | "all")[] = ["pending", "approved", "rejected", "all"];

export default async function AdminWithdrawalsPage({
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
    .from("withdraw_requests")
    .select("*, user:users!withdraw_requests_user_id_fkey(full_name, email, kyc_status)", {
      count: "exact",
    })
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
        title="Withdrawal requests"
        description="Funds are already held. Approving records the payout; rejecting refunds the member."
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <Link
            key={value}
            href={`/admin/withdrawals?status=${value}`}
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

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Member</TableHead>
              <TableHead>Amount</TableHead>
              <TableHead>Destination</TableHead>
              <TableHead>Requested</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={5}>Nothing in this queue.</TableEmpty>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.user?.full_name ?? "Member"}
                    <p className="text-xs text-muted">{row.user?.email ?? "—"}</p>
                    {row.user && row.user.kyc_status !== "approved" && (
                      <Badge variant="danger" className="mt-1">
                        KYC {row.user.kyc_status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{fmtMoney(row.net_amount)}</span>
                    <p className="text-xs text-muted">
                      {fmtMoney(row.amount)} − {fmtMoney(row.fee)} fee
                    </p>
                  </TableCell>
                  <TableCell className="text-muted">
                    {NETWORK_LABEL[row.network]} · {row.asset}
                    <p className="text-xs">{truncateAddress(row.to_address, 8)}</p>
                  </TableCell>
                  <TableCell className="text-muted">{fmtDateTime(row.created_at)}</TableCell>
                  <TableCell className="text-right">
                    {row.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <ReviewDialog
                          action={reviewWithdrawal}
                          requestId={row.id}
                          decision="approved"
                          title="Approve withdrawal"
                          description={`Send ${fmtMoney(row.net_amount)} ${row.asset} to ${truncateAddress(row.to_address, 8)}, then record the hash below.`}
                          requireTxHash
                        />
                        <ReviewDialog
                          action={reviewWithdrawal}
                          requestId={row.id}
                          decision="rejected"
                          title="Reject withdrawal"
                          description="The held amount is returned to the member's available balance."
                          requireNote
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                        {row.tx_hash && (
                          <code className="text-xs text-secondary">
                            {truncateAddress(row.tx_hash, 6)}
                          </code>
                        )}
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </Card>

      {(page > 1 || hasNext) && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">
            Page {page} · {total} total
          </p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={`/admin/withdrawals?status=${status}&page=${page - 1}`}
                className="rounded-xl border border-white/12 px-4 py-2 text-sm hover:bg-white/5"
              >
                Previous
              </Link>
            )}
            {hasNext && (
              <Link
                href={`/admin/withdrawals?status=${status}&page=${page + 1}`}
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
