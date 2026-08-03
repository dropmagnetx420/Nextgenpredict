"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { getKycFileUrl } from "@/app/actions/admin";

/**
 * KYC uploads live in a private bucket, so the URL is minted on demand
 * rather than embedded in the page for every row.
 */
export function KycFileLink({ path, label }: { path: string | null; label: string }) {
  const [loading, setLoading] = useState(false);

  if (!path) return <span className="text-xs text-muted">{label}: —</span>;

  const open = async () => {
    setLoading(true);
    try {
      const url = await getKycFileUrl(path);
      if (url) window.open(url, "_blank", "noopener,noreferrer");
      else toast.error("Couldn't open that file.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button type="button" variant="outline" size="sm" onClick={open} disabled={loading}>
      {loading ? "Opening…" : label}
    </Button>
  );
}
