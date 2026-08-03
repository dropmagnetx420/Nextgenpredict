import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors whitespace-nowrap",
  {
    variants: {
      variant: {
        default: "border-primary/40 bg-primary/15 text-primary",
        secondary: "border-secondary/40 bg-secondary/15 text-secondary",
        accent: "border-accent/40 bg-accent/15 text-accent",
        success: "border-emerald-400/40 bg-emerald-400/15 text-emerald-300",
        warning: "border-amber-400/40 bg-amber-400/15 text-amber-300",
        danger: "border-rose-400/40 bg-rose-400/15 text-rose-300",
        outline: "border-white/15 bg-white/5 text-muted",
        live: "border-rose-400/50 bg-rose-500/15 text-rose-300",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

/** Maps a request/market/trade status to a sensible badge colour. */
export function statusVariant(status: string): NonNullable<BadgeProps["variant"]> {
  switch (status) {
    case "approved":
    case "won":
    case "resolved":
    case "active":
      return "success";
    case "pending":
    case "open":
    case "draft":
      return "warning";
    case "rejected":
    case "lost":
    case "banned":
      return "danger";
    case "cancelled":
    case "refunded":
    case "closed":
    case "suspended":
      return "outline";
    default:
      return "secondary";
  }
}

export { Badge, badgeVariants };
