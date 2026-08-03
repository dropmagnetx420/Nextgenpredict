"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { setMarketStatus } from "@/app/actions/admin";

export function MarketStatusButton({
  marketId,
  status,
}: {
  marketId: string;
  status: "draft" | "open" | "closed";
}) {
  const [pending, start] = useTransition();

  const label = { draft: "Move to draft", open: "Open", closed: "Close" }[status];

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() =>
        start(async () => {
          const result = await setMarketStatus(marketId, status);
          if (result.ok) toast.success(result.message ?? "Updated.");
          else toast.error(result.error);
        })
      }
    >
      {pending ? "Working…" : label}
    </Button>
  );
}
