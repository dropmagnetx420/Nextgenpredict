import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import { Toaster } from "sonner";
import { BlockchainBackground } from "@/components/fx/blockchain-background";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${spaceGrotesk.variable} min-h-dvh`}>
        <BlockchainBackground />
        {children}
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
