import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/stat-card";
import {
  DeleteContentButton,
  DepositAddressForm,
  PartnerForm,
  PromoBannerForm,
  ToggleAddressButton,
} from "@/components/admin/content-forms";
import { Badge } from "@/components/ui/badge";
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
import { createClient } from "@/lib/supabase/server";
import { NETWORK_LABEL } from "@/lib/constants";
import { fmtDate, fmtMoney, truncateAddress } from "@/lib/utils";
import type { DepositAddress, Partner, PromoBanner } from "@/lib/types";

export const metadata: Metadata = {
  title: "Content · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminContentPage() {
  const supabase = await createClient();

  const [addressesRes, bannersRes, partnersRes] = await Promise.all([
    supabase
      .from("deposit_addresses")
      .select("*")
      .order("network")
      .order("created_at", { ascending: false }),
    supabase.from("promo_banners").select("*").order("sort_order"),
    supabase.from("partners").select("*").order("sort_order"),
  ]);

  const addresses = (addressesRes.data ?? []) as DepositAddress[];
  const banners = (bannersRes.data ?? []) as PromoBanner[];
  const partners = (partnersRes.data ?? []) as Partner[];

  return (
    <div className="space-y-10">
      <PageHeader
        title="Content"
        description="Deposit addresses, homepage promotions and partner logos."
      />

      <section>
        <h2 className="font-display text-lg font-semibold">Deposit addresses</h2>
        <p className="mt-1.5 text-sm text-muted">
          Members are shown a random active address for their chosen network and asset. Seed
          several per pair so deposits spread out.
        </p>

        <div className="mt-4 grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card className="h-fit">
            <CardContent className="p-6">
              <DepositAddressForm />
            </CardContent>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Route</TableHead>
                  <TableHead>Address</TableHead>
                  <TableHead>Received</TableHead>
                  <TableHead className="text-right">State</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {addresses.length === 0 ? (
                  <TableEmpty colSpan={4}>
                    No addresses yet — deposits will fail until you add one.
                  </TableEmpty>
                ) : (
                  addresses.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        {NETWORK_LABEL[row.network]}
                        <p className="text-xs text-muted">{row.asset}</p>
                      </TableCell>
                      <TableCell>
                        <code className="text-xs">{truncateAddress(row.address, 8)}</code>
                        {row.label && <p className="text-xs text-muted">{row.label}</p>}
                      </TableCell>
                      <TableCell>{fmtMoney(row.total_received)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant={row.is_active ? "success" : "outline"}>
                            {row.is_active ? "Active" : "Off"}
                          </Badge>
                          <ToggleAddressButton id={row.id} isActive={row.is_active} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">Promo banners</h2>
        <p className="mt-1.5 text-sm text-muted">
          Active banners appear on the homepage. A banner with a bonus percent also boosts
          deposits made while it&apos;s live.
        </p>

        <div className="mt-4 grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card className="h-fit">
            <CardContent className="p-6">
              <PromoBannerForm />
            </CardContent>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Banner</TableHead>
                  <TableHead>Bonus</TableHead>
                  <TableHead>Window</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {banners.length === 0 ? (
                  <TableEmpty colSpan={4}>No banners yet.</TableEmpty>
                ) : (
                  banners.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <span className="font-medium">{row.title}</span>
                        {row.subtitle && (
                          <p className="max-w-64 truncate text-xs text-muted">
                            {row.subtitle}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.promo_bonus_percent ? `${row.promo_bonus_percent}%` : "—"}
                        {row.max_joiners ? (
                          <p className="text-xs text-muted">
                            {row.join_count}/{row.max_joiners} joined
                          </p>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-xs text-muted">
                        {row.starts_at ? fmtDate(row.starts_at) : "Always"}
                        {row.ends_at ? ` → ${fmtDate(row.ends_at)}` : ""}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant={row.is_active ? "success" : "outline"}>
                            {row.is_active ? "Live" : "Off"}
                          </Badge>
                          <DeleteContentButton id={row.id} kind="banner" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </section>

      <section>
        <h2 className="font-display text-lg font-semibold">Partners</h2>

        <div className="mt-4 grid gap-6 lg:grid-cols-[380px_1fr]">
          <Card className="h-fit">
            <CardContent className="p-6">
              <PartnerForm />
            </CardContent>
          </Card>

          <Card>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Website</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {partners.length === 0 ? (
                  <TableEmpty colSpan={3}>No partners yet.</TableEmpty>
                ) : (
                  partners.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell className="font-medium">{row.name}</TableCell>
                      <TableCell className="max-w-56 truncate text-xs text-muted">
                        {row.website ?? "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Badge variant={row.is_active ? "success" : "outline"}>
                            {row.is_active ? "Live" : "Off"}
                          </Badge>
                          <DeleteContentButton id={row.id} kind="partner" />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </Card>
        </div>
      </section>
    </div>
  );
}
