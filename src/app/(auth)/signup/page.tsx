import type { Metadata } from "next";
import { SignupForm } from "@/components/auth/signup-form";
import { getSettings } from "@/lib/settings";

export const metadata: Metadata = {
  title: "Create account",
  description: "Open a NextGen Predict account and start trading sports outcomes.",
  robots: { index: false, follow: false },
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const [params, settings] = await Promise.all([searchParams, getSettings()]);

  const referralCode = params.ref?.replace(/[^a-zA-Z0-9]/g, "").toUpperCase().slice(0, 16);

  return (
    <SignupForm
      referralCode={referralCode || undefined}
      welcomeBonus={settings.welcome_bonus_amount}
    />
  );
}
