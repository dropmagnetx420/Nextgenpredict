"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — select the text manually.");
    }
  };

  return (
    <div className="flex items-center gap-2 rounded-xl border border-white/12 bg-black/25 px-3.5 py-2.5">
      <code className="min-w-0 flex-1 truncate text-sm text-foreground">{value}</code>
      <Button
        type="button"
        variant="ghost"
        size="iconSm"
        onClick={copy}
        aria-label={`Copy ${label}`}
      >
        {copied ? <Check className="text-accent" /> : <Copy />}
      </Button>
    </div>
  );
}
