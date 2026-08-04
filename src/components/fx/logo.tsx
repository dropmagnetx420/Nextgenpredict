import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";

/**
 * Brand wordmark. The glyph is the NextGen Predict compass logo image with a
 * soft pulsing glow behind it.
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
    sm: { box: "h-8 w-8", px: 32, text: "text-base", glow: "blur-md" },
    md: { box: "h-10 w-10", px: 40, text: "text-xl", glow: "blur-lg" },
    lg: { box: "h-14 w-14", px: 56, text: "text-3xl sm:text-4xl", glow: "blur-xl" },
  }[size];

  const mark = (
    <span className={cn("group inline-flex items-center gap-2.5", className)}>
      <span className={cn("relative shrink-0", dims.box)}>
        <span
          aria-hidden
          className={cn(
            "absolute inset-0 rounded-full bg-gradient-to-br from-primary via-secondary to-accent opacity-70",
            dims.glow,
            "[animation:glowPulse_4s_ease-in-out_infinite]"
          )}
        />
        <Image
          src="/images/logo.png"
          alt=""
          width={dims.px}
          height={dims.px}
          priority
          className="relative h-full w-full rounded-full border border-white/15 object-cover"
        />
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
