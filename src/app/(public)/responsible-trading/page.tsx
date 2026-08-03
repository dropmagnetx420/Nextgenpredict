import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = {
  title: "Responsible trading",
  description:
    "Guides, limits and resources for keeping prediction trading safe and under control.",
};

export default function ResponsibleTradingPage() {
  return (
    <LegalPage
      title="Responsible trading"
      updated="January 2026"
      sections={[
        {
          heading: "Keep it in proportion",
          body: [
            "Prediction markets are entertainment and a test of judgement — never a guaranteed income. Only stake money you can afford to lose, and treat any win as a bonus rather than the point of trading.",
          ],
        },
        {
          heading: "Know your limits",
          body: [
            "Set yourself a budget before a season or tournament starts and stick to it. If you lose it, stop. Our market minimums and maximums keep positions bounded, but the first line of defence is your own plan.",
          ],
        },
        {
          heading: "Watch for the warning signs",
          body: [
            "Chasing losses, staking borrowed money, hiding activity from people close to you, or feeling compelled to trade on every fixture are all signals it is time to step back.",
          ],
        },
        {
          heading: "Take breaks and get help",
          body: [
            "You can step away any time by closing this tab — your positions remain safe and settle normally. If trading stops being enjoyable, reach out to a friend or a professional support service. We can also place a voluntary block on your account on request.",
          ],
        },
      ]}
    />
  );
}
