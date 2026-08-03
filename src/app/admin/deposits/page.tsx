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
import { reviewDeposit } from "@/app/actions/admin";
import { createClient } from "@/lib/supabase/server";
import { NETWORK_LABEL, PAGE_SIZE } from "@/lib/constants";
import { fmtDateTime, fmtMoney, truncateAddress } from "@/lib/utils";
import type { DepositRequest, RequestStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Deposits · Admin",
  robots: { index: false, follow: false },
};

type Row = DepositRequest & {
  user: { full_name: string | null; email: string } | null;
};

const FILTERS: (RequestStatus | "all")[] = ["pending", "approved", "rejected", "all"];

export default async function AdminDepositsPage({
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
    .from("deposit_requests")
    .select("*, user:users!deposit_requests_user_id_fkey(full_name, email)", {
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
        title="Deposit requests"
        description="Approving credits the member's wallet and applies any deposit bonus."
      />

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <Link
            key={value}
            href={`/admin/deposits?status=${value}`}
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
              <TableHead>Route</TableHead>
              <TableHead>Transaction</TableHead>
              <TableHead>Submitted</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableEmpty colSpan={6}>Nothing in this queue.</TableEmpty>
            ) : (
              rows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-medium">
                    {row.user?.full_name ?? "Member"}
                    <p className="text-xs text-muted">{row.user?.email ?? "—"}</p>
                  </TableCell>
                  <TableCell>
                    <span className="font-medium">{fmtMoney(row.amount)}</span>
                    <p className="text-xs text-muted">{row.asset}</p>
                  </TableCell>
                  <TableCell className="text-muted">
                    {NETWORK_LABEL[row.network]}
                    <p className="text-xs">{truncateAddress(row.to_address)}</p>
                  </TableCell>
                  <TableCell>
                    <code className="text-xs text-secondary">
                      {truncateAddress(row.tx_hash, 8)}
                    </code>
                    {row.bonus_amount > 0 && (
                      <p className="text-xs text-accent">
                        +{fmtMoney(row.bonus_amount)} bonus
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-muted">{fmtDateTime(row.created_at)}</TableCell>
                  <TableCell className="text-right">
                    {row.status === "pending" ? (
                      <div className="flex justify-end gap-2">
                        <ReviewDialog
                          action={reviewDeposit}
                          requestId={row.id}
                          decision="approved"
                          title="Approve deposit"
                          description={`Credit ${fmtMoney(row.amount)} USDG to ${row.user?.email ?? "this member"}. Confirm the transaction on-chain first.`}
                        />
                        <ReviewDialog
                          action={reviewDeposit}
                          requestId={row.id}
                          decision="rejected"
                          title="Reject deposit"
                          description="The member will be notified with your reason."
                          requireNote
                        />
                      </div>
                    ) : (
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                        {row.admin_note && (
                          <span className="max-w-48 truncate text-xs text-muted">
                            {row.admin_note}
                          </span>
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
                href={`/admin/deposits?status=${status}&page=${page - 1}`}
                className="rounded-xl border border-white/12 px-4 py-2 text-sm hover:bg-white/5"
              >
                Previous
              </Link>
            )}
            {hasNext && (
              <Link
                href={`/admin/deposits?status=${status}&page=${page + 1}`}
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
