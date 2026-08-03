import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";

export const metadata: Metadata = {
  title: "Privacy policy",
  description: "How NextGen Predict collects, uses and protects your personal data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy policy"
      updated="January 2026"
      sections={[
        {
          heading: "1. What we collect",
          body: [
            "We collect the information you give us directly: your email address, name, country and phone number when you set up your profile, and the identity documents and selfies you submit for verification.",
            "We also collect technical data — IP address, device and browser signatures, and usage logs — to keep the platform secure and functional.",
          ],
        },
        {
          heading: "2. How we use it",
          body: [
            "Your data is used to operate your account, process deposits and withdrawals, comply with anti-money-laundering and know-your-customer obligations, prevent fraud, and improve the product.",
            "We do not sell your personal data to third parties.",
          ],
        },
        {
          heading: "3. Identity verification",
          body: [
            "Documents you submit for KYC are stored encrypted, access is restricted to trained reviewers on a need-to-know basis, and records are retained only as long as required by law.",
          ],
        },
        {
          heading: "4. Sharing",
          body: [
            "We share data only with service providers who help us operate (such as cloud infrastructure and email delivery) under contractual terms that require them to protect your data, and with regulators where law requires it.",
          ],
        },
        {
          heading: "5. Your rights",
          body: [
            "You can export your trading history and transaction records at any time. Subject to local law you may also request access to, correction of, or deletion of your personal data by writing to support.",
          ],
        },
        {
          heading: "6. Cookies",
          body: [
            "We use strictly necessary cookies to keep you signed in and secure. We do not run advertising trackers.",
          ],
        },
        {
          heading: "7. Contact",
          body: [
            "Questions about this policy or your data can be sent to the support address shown in the footer. We respond within one business day.",
          ],
        },
      ]}
    />
  );
}
