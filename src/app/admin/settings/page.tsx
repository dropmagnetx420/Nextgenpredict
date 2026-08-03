import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/stat-card";
import { SettingsForm } from "@/components/admin/settings-form";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Settings · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminSettingsPage() {
  const settings = await getSettings();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Site settings"
        description="These take effect immediately across the platform."
      />
      <SettingsForm settings={settings} />
    </div>
  );
}
