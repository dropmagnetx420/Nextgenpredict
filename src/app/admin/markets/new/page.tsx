import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/stat-card";
import { MarketForm } from "@/components/admin/market-form";

export const metadata: Metadata = {
  title: "New market · Admin",
  robots: { index: false, follow: false },
};

export default function NewMarketPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        title="New market"
        description="Drafts stay hidden from members until you open them."
      />
      <MarketForm />
    </div>
  );
}
