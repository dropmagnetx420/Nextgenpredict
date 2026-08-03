import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/stat-card";
import { AnnouncementForm } from "@/components/admin/announcement-form";
import { Card, CardContent } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { fmtDateTime } from "@/lib/utils";
import type { Notification } from "@/lib/types";

export const metadata: Metadata = {
  title: "Announcements · Admin",
  robots: { index: false, follow: false },
};

export default async function AdminAnnouncementsPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("type", "announcement")
    .order("created_at", { ascending: false })
    .limit(10);

  const recent = (data ?? []) as Notification[];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Announcements"
        description="One broadcast reaches every active member's notification list."
      />

      <AnnouncementForm />

      {recent.length > 0 && (
        <section>
          <h2 className="font-display text-lg font-semibold">Recently sent</h2>
          <ul className="mt-4 space-y-3">
            {recent.map((item) => (
              <li key={item.id}>
                <Card>
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-display text-sm font-semibold">{item.title}</p>
                        <p className="mt-1 text-sm text-muted">{item.body}</p>
                      </div>
                      <span className="whitespace-nowrap text-xs text-muted">
                        {fmtDateTime(item.created_at)}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
