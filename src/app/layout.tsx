import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { BlockchainBackground } from "@/components/fx/blockchain-background";
import { hasSupabaseEnv } from "@/lib/env";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "NextGen Predict — Sports Prediction Markets",
    template: "%s · NextGen Predict",
  },
  description:
    "Trade the outcome of football, cricket, basketball, tennis and esports events on a transparent prediction market. Real-time odds, instant settlement.",
  keywords: [
    "prediction market", "sports betting alternative", "football predictions",
    "cricket markets", "esports odds", "crypto prediction",
  ],
  openGraph: {
    type: "website",
    url: siteUrl,
    siteName: "NextGen Predict",
    title: "NextGen Predict — Sports Prediction Markets",
    description:
      "Predict the game. Own the outcome. Live odds across football, cricket, basketball, tennis and esports.",
  },
  twitter: {
    card: "summary_large_image",
    title: "NextGen Predict",
    description: "Sports prediction markets with live odds and instant settlement.",
  },
  robots: { index: true, follow: true },
};

export const viewport: Viewport = {
  themeColor: "#060816",
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

/**
 * Every page in this app reads from Supabase, so without real credentials the
 * whole site renders as blank shells. Say so once, here, instead of letting
 * each route fail on its own.
 */
function SetupNotice() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-4 px-6 text-sm">
      <h1 className="font-display text-2xl font-bold">Supabase is not configured</h1>
      <p className="text-muted">
        <code>.env.local</code> still holds the <code>your-…</code> placeholders from{" "}
        <code>.env.example</code>, so sign-up, sign-in and the dashboard cannot work.
      </p>
      <ol className="list-decimal space-y-1 pl-5 text-muted">
        <li>Create a project at supabase.com.</li>
        <li>
          Copy Project Settings → API into <code>.env.local</code>:{" "}
          <code>NEXT_PUBLIC_SUPABASE_URL</code>, <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code>,{" "}
          <code>SUPABASE_SERVICE_ROLE_KEY</code>.
        </li>
        <li>
          Run the migrations in <code>supabase/</code>, then restart <code>npm run dev</code>.
        </li>
      </ol>
    </main>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} min-h-dvh`}>
        <BlockchainBackground />
        {hasSupabaseEnv() ? children : <SetupNotice />}
        <Toaster
          position="top-center"
          richColors
          closeButton
          toastOptions={{
            style: {
              background: "rgba(11,15,36,0.92)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#f2f5ff",
              backdropFilter: "blur(16px)",
            },
          }}
        />
      </body>
    </html>
  );
}
