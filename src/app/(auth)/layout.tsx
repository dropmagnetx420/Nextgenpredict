import Link from "next/link";
import { Logo } from "@/components/fx/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="flex justify-center">
          <Logo size="md" />
        </div>
        {children}
        <p className="mt-8 text-center text-xs text-muted">
          <Link href="/" className="transition-colors hover:text-foreground">
            Back to site
          </Link>
          <span className="mx-2">·</span>
          <Link href="/terms" className="transition-colors hover:text-foreground">
            Terms
          </Link>
          <span className="mx-2">·</span>
          <Link href="/privacy" className="transition-colors hover:text-foreground">
            Privacy
          </Link>
        </p>
      </div>
    </div>
  );
}
