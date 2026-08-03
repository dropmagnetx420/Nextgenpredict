import Link from "next/link";
import { Logo } from "@/components/fx/logo";
import { getSettings } from "@/lib/settings";

const GROUPS = [
  {
    title: "Platform",
    links: [
      { href: "/markets", label: "Browse markets" },
      { href: "/how-it-works", label: "How it works" },
      { href: "/faq", label: "FAQ" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/terms", label: "Terms of service" },
      { href: "/privacy", label: "Privacy policy" },
      { href: "/responsible-trading", label: "Responsible trading" },
    ],
  },
];

export async function SiteFooter() {
  const settings = await getSettings();

  const socials = [
    { href: settings.social_twitter, label: "Twitter" },
    { href: settings.social_telegram, label: "Telegram" },
    { href: settings.social_discord, label: "Discord" },
  ].filter((s) => typeof s.href === "string" && s.href.length > 0);

  return (
    <footer className="border-t border-white/10 bg-surface/40">
      <div className="mx-auto w-full max-w-7xl px-4 py-14 sm:px-6">
        <div className="grid gap-10 md:grid-cols-4">
          <div className="md:col-span-2">
            <Logo size="sm" />
            <p className="mt-4 max-w-sm text-sm text-muted">{settings.site_tagline}</p>
            <p className="mt-4 text-xs text-muted">
              Support:{" "}
              <a
                className="text-secondary hover:underline"
                href={`mailto:${settings.support_email}`}
              >
                {settings.support_email}
              </a>
            </p>
          </div>

          {GROUPS.map((group) => (
            <div key={group.title}>
              <h2 className="font-display text-sm font-semibold">{group.title}</h2>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-muted transition-colors hover:text-foreground"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-white/10 pt-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted">
            &copy; {new Date().getFullYear()} {settings.site_name}. All rights reserved.
          </p>

          {socials.length > 0 && (
            <ul className="flex items-center gap-4">
              {socials.map((social) => (
                <li key={social.label}>
                  <a
                    href={social.href as string}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted transition-colors hover:text-secondary"
                  >
                    {social.label}
                  </a>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="mt-6 text-xs leading-relaxed text-muted/70">
          Trading prediction markets involves risk of loss. Only commit funds you can afford to
          lose. Must be 18 or older. Not available where prohibited by law.
        </p>
      </div>
    </footer>
  );
}
