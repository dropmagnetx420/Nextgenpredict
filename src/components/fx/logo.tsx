import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Animated wordmark. The glyph is inline SVG (no image request) with an
 * orbiting ring and a soft pulsing glow behind it.
 */
export function Logo({
  href = "/",
  size = "md",
  showText = true,
  className,
}: {
  href?: string | null;
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  className?: string;
}) {
  const dims = {
    sm: { box: "h-8 w-8", text: "text-base", glow: "blur-md" },
    md: { box: "h-10 w-10", text: "text-xl", glow: "blur-lg" },
    lg: { box: "h-14 w-14", text: "text-3xl sm:text-4xl", glow: "blur-xl" },
  }[size];

  const mark = (
    <span className={cn("group inline-flex items-center gap-2.5", className)}>
      <span className={cn("relative shrink-0", dims.box)}>
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-xl bg-gradient-to-br from-primary via-secondary to-accent opacity-70",
            dims.glow,
            "[animation:glowPulse_4s_ease-in-out_infinite]"
          )}
        />
        <span className="relative flex h-full w-full items-center justify-center rounded-xl border border-white/15 bg-surface/90">
          <svg viewBox="0 0 32 32" className="h-[62%] w-[62%]" fill="none" aria-hidden>
            <defs>
              <linearGradient id="ngp-mark" x1="0" y1="0" x2="32" y2="32">
                <stop offset="0%" stopColor="#7c5cff" />
                <stop offset="55%" stopColor="#00d4ff" />
                <stop offset="100%" stopColor="#00ffb3" />
              </linearGradient>
            </defs>
            {/* Rising prediction curve */}
            <path
              d="M4 22 L11 15 L16 19 L28 7"
              stroke="url(#ngp-mark)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="28" cy="7" r="3" fill="url(#ngp-mark)" />
          </svg>
          <span
            aria-hidden
            className="absolute inset-0 rounded-xl border border-secondary/30 [animation:orbit_14s_linear_infinite]"
            style={{ clipPath: "polygon(0 0, 55% 0, 55% 22%, 0 22%)" }}
          />
        </span>
      </span>

      {showText && (
        <span className={cn("font-display font-bold tracking-tight", dims.text)}>
          <span className="text-gradient">NextGen</span>
          <span className="text-foreground"> Predict</span>
        </span>
      )}
    </span>
  );

  if (!href) return mark;

  return (
    <Link href={href} aria-label="NextGen Predict — home" className="inline-flex">
      {mark}
    </Link>
  );
}
