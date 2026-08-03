import Link from "next/link";
import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/stat-card";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SubmitButton } from "@/components/ui/form";
import { markAllRead } from "@/app/actions/notifications";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { cn, fmtRelative } from "@/lib/utils";
import type { Notification } from "@/lib/types";

export const metadata: Metadata = {
  title: "Notifications",
  robots: { index: false, follow: false },
};

export default async function NotificationsPage() {
  const user = await requireUser("/dashboard/notifications");

  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .or(`user_id.eq.${user.id},user_id.is.null`)
    .order("created_at", { ascending: false })
    .limit(50);

  const notifications = (data ?? []) as Notification[];
  const unread = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description={unread > 0 ? `${unread} unread` : "You're all caught up."}
        action={
          unread > 0 ? (
            <form action={markAllRead}>
              <SubmitButton variant="outline" size="sm" pendingLabel="Marking…">
                Mark all read
              </SubmitButton>
            </form>
          ) : undefined
        }
      />

      {notifications.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <p className="font-display text-base font-semibold">Nothing yet</p>
            <p className="mt-2 text-sm text-muted">
              Deposits, settlements and account updates will show up here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {notifications.map((item) => (
            <li key={item.id}>
              <Card className={cn(!item.is_read && "border-secondary/30 bg-secondary/[0.05]")}>
                <CardContent className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-display text-sm font-semibold">{item.title}</p>
                        {!item.is_read && (
                          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
                            New
                          </Badge>
                        )}
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-muted">{item.body}</p>
                      {item.link && (
                        <Link
                          href={item.link}
                          className="mt-2 inline-block text-xs text-secondary hover:underline"
                        >
                          View details
                        </Link>
                      )}
                    </div>
                    <span className="whitespace-nowrap text-xs text-muted">
                      {fmtRelative(item.created_at)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
