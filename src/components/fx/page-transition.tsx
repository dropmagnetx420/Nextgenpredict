"use client";

import { usePathname } from "next/navigation";

/**
 * Fades + lifts page content on route change.
 *
 * Deliberately CSS rather than framer-motion: this wraps every public page,
 * so importing an animation library here pulled it into the first load of
 * the whole marketing site to run a quarter-second fade.
 *
 * The `key` remounts the node on navigation, which restarts the animation.
 */
export function PageTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div key={pathname} className="animate-page-in">
      {children}
    </div>
  );
}
