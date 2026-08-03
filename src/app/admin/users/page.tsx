import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/stat-card";
import { UserActions } from "@/components/admin/user-actions";
import { Badge, statusVariant } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableEmpty,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { createClient } from "@/lib/supabase/server";
import { PAGE_SIZE } from "@/lib/constants";
import { fmtDate, fmtMoney } from "@/lib/utils";
import type { AppUser, UserStatus } from "@/lib/types";

export const metadata: Metadata = {
  title: "Users · Admin",
  robots: { index: false, follow: false },
};

type Row = AppUser & { wallet: { available: number; bonus: number }[] };

const FILTERS: (UserStatus | "all")[] = ["all", "active", "suspended", "banned"];

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const status = (FILTERS as string[]).includes(params.status ?? "")
    ? (params.status as UserStatus | "all")
    : "all";
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from("users")
    .select("*, wallet:wallets(available, bonus)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (status !== "all") query = query.eq("status", status);
  if (q) {
    // PostgREST `or` treats commas as separators, so keep the term simple.
    const term = q.replace(/[,()*]/g, "");
    query = query.or(`email.ilike.%${term}%,full_name.ilike.%${term}%,username.ilike.%${term}%`);
  }

  const { data, count } = await query;
  const users = (data ?? []) as Row[];
  const total = count ?? 0;
  const hasNext = from + users.length < total;

  const qs = (overrides: Record<string, string | number>) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (status !== "all") sp.set("status", status);
    for (const [key, value] of Object.entries(overrides)) sp.set(key, String(value));
    return `/admin/users?${sp.toString()}`;
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Members" description={`${total} account${total === 1 ? "" : "s"}.`} />

      <Card>
        <CardContent className="p-5">
          <form className="flex flex-wrap gap-3" action="/admin/users">
            {status !== "all" && <input type="hidden" name="status" value={status} />}
            <Input
              name="q"
              defaultValue={q}
              placeholder="Search name, email or username"
              className="min-w-56 flex-1"
              aria-label="Search members"
            />
            <Button type="submit" variant="outline">
              Search
            </Button>
          </form>
        </CardContent>
      </Card>

      <div className="flex flex-wrap gap-2">
        {FILTERS.map((value) => (
          <Link
            key={value}
            href={value === "all" ? "/admin/users" : `/admin/users?status=${value}`}
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
              <TableHead>Balance</TableHead>
              <TableHead>Activity</TableHead>
              <TableHead>Joined</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.length === 0 ? (
              <TableEmpty colSpan={6}>No members match this search.</TableEmpty>
            ) : (
              users.map((row) => {
                const wallet = row.wallet?.[0];
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <span className="font-medium">{row.full_name ?? "Member"}</span>
                      {row.role === "admin" && (
                        <Badge variant="accent" className="ml-2">
                          Admin
                        </Badge>
                      )}
                      <p className="text-xs text-muted">{row.email}</p>
                      {row.username && <p className="text-xs text-muted">@{row.username}</p>}
                    </TableCell>
                    <TableCell>
                      {fmtMoney(wallet?.available ?? 0)}
                      {(wallet?.bonus ?? 0) > 0 && (
                        <p className="text-xs text-accent">
                          +{fmtMoney(wallet?.bonus ?? 0)} bonus
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {row.total_trades} trades
                      <p className="text-xs text-muted">
                        {fmtMoney(row.total_volume)} volume
                      </p>
                    </TableCell>
                    <TableCell className="text-muted">{fmtDate(row.created_at)}</TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                      <p className="mt-1 text-xs text-muted capitalize">
                        KYC {row.kyc_status}
                      </p>
                    </TableCell>
                    <TableCell>
                      <UserActions user={row} />
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </Card>

      {(page > 1 || hasNext) && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted">Page {page}</p>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={qs({ page: page - 1 })}
                className="rounded-xl border border-white/12 px-4 py-2 text-sm hover:bg-white/5"
              >
                Previous
              </Link>
            )}
            {hasNext && (
              <Link
                href={qs({ page: page + 1 })}
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
