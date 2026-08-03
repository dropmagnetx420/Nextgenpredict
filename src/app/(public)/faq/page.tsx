import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FAQ_ITEMS } from "@/lib/constants";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "FAQ",
  description:
    "Answers about pricing, fees, deposits, withdrawals, bonuses, KYC and referrals on NextGen Predict.",
};

export default async function FaqPage() {
  const settings = await getSettings();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="font-display text-3xl font-bold sm:text-4xl">
        Frequently asked questions
      </h1>
      <p className="mt-3 text-sm text-muted">
        Everything about how markets price, settle and pay out.
      </p>

      <div className="mt-8 space-y-3">
        {FAQ_ITEMS.map((item) => (
          <details
            key={item.q}
            className="group rounded-2xl border border-white/10 bg-surface/50 px-5 py-4"
          >
            <summary className="cursor-pointer list-none font-medium marker:content-none">
              <span className="flex items-center justify-between gap-4">
                {item.q}
                <span
                  aria-hidden
                  className="shrink-0 text-muted transition-transform group-open:rotate-45"
                >
                  +
                </span>
              </span>
            </summary>
            <p className="mt-3 text-sm leading-relaxed text-muted">{item.a}</p>
          </details>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-white/10 bg-surface/50 px-6 py-8 text-center">
        <h2 className="font-display text-lg font-semibold">Still stuck?</h2>
        <p className="mt-2 text-sm text-muted">
          Our team answers support mail within one business day.
        </p>
        <Button asChild variant="outline" size="sm" className="mt-5">
          <a href={`mailto:${settings.support_email}`}>Email {settings.support_email}</a>
        </Button>
      </div>

      <p className="mt-8 text-center text-sm text-muted">
        Ready to trade?{" "}
        <Link href="/markets" className="text-secondary hover:underline">
          Browse open markets
        </Link>
      </p>
    </div>
  );
}
