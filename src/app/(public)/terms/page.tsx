import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = {
  title: "Terms of service",
  description: "The terms governing your use of the NextGen Predict platform.",
};

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of service"
      updated="January 2026"
      sections={[
        {
          heading: "1. Eligibility",
          body: [
            "You must be at least 18 years old and legally permitted to participate in prediction markets in your jurisdiction. We may require identity verification at any time and will restrict access where local law prohibits participation.",
            "Accounts are personal. You may not open more than one account, share access, or trade on behalf of another person.",
          ],
        },
        {
          heading: "2. Markets and pricing",
          body: [
            "Each market is a binary question with YES and NO shares quoted in cents that always sum to 100. Prices move as traders take positions; a quoted price is not a guarantee of execution at that price if the market state changes between your request and confirmation.",
            "Minimum and maximum position sizes are published on each market and may be adjusted before a market opens.",
          ],
        },
        {
          heading: "3. Fees",
          body: [
            "A flat platform fee applies when you open a position and again if you cancel it. The exact amount is displayed before you confirm. Withdrawal fees, where applicable, are shown at the time of request.",
          ],
        },
        {
          heading: "4. Settlement and resolution",
          body: [
            "We resolve markets against the official result published by the relevant governing body or competition organiser. Winning shares settle at 1.00 USDG, losing shares at zero.",
            "Where a result is void, abandoned, or cannot be determined, we may resolve the market as invalid and refund all positions in full. Resolution decisions are final, and the resolution note is attached to every settled market.",
          ],
        },
        {
          heading: "5. Deposits, withdrawals and bonuses",
          body: [
            "Deposits are credited after the on-chain transfer confirms and our team reviews the submitted transaction hash. Always send to the address displayed for that specific transfer.",
            "Bonus funds carry a wagering requirement disclosed at the time of credit. Withdrawals of bonus-derived balance unlock once that requirement is cleared. Identity verification is required before your first withdrawal.",
          ],
        },
        {
          heading: "6. Prohibited conduct",
          body: [
            "You may not manipulate market prices, use automated tooling to gain an unfair execution advantage, exploit software faults, collude with other accounts, or trade on non-public information about an event's outcome.",
            "We may suspend or close accounts, void trades, and withhold balances where we reasonably believe this section has been breached.",
          ],
        },
        {
          heading: "7. Risk and limitation of liability",
          body: [
            "Prediction markets carry a genuine risk of loss. Only commit funds you can afford to lose. Nothing on this platform is investment advice.",
            "To the fullest extent permitted by law, our liability is limited to the balance held in your account. We are not liable for losses arising from network congestion, third-party custody failures, or events outside our reasonable control.",
          ],
        },
        {
          heading: "8. Changes to these terms",
          body: [
            "We may update these terms as the platform evolves. Material changes will be announced in-product. Continuing to use the platform after a change takes effect constitutes acceptance.",
          ],
        },
      ]}
    />
  );
}
