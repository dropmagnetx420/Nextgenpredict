import { z } from "zod";

// ─── Shared primitives ───────────────────────────────────────
const email = z.string().trim().toLowerCase().email("Enter a valid email address");

const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be 72 characters or fewer")
  .regex(/[a-z]/, "Include at least one lowercase letter")
  .regex(/[A-Z]/, "Include at least one uppercase letter")
  .regex(/[0-9]/, "Include at least one number");

const money = z.coerce
  .number()
  .positive("Enter an amount greater than zero")
  .max(1_000_000, "Amount is too large")
  .refine((n) => Number.isFinite(n), "Enter a valid amount");

/** EVM address. Both supported networks use the 0x… 20-byte format. */
const evmAddress = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/, "Enter a valid 0x wallet address");

const txHash = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{64}$/, "Enter a valid 0x transaction hash");

const network = z.enum(["robinhood", "ethereum"]);
const asset = z.enum(["ETH", "USDG", "USDC", "USDT"]);

/** Rejects the combinations the SQL CHECK constraint would reject anyway. */
const networkAssetPair = <T extends { network: "robinhood" | "ethereum"; asset: string }>(
  data: T,
  ctx: z.RefinementCtx
) => {
  const allowed =
    data.network === "robinhood" ? ["ETH", "USDG"] : ["USDC", "USDT", "ETH"];
  if (!allowed.includes(data.asset)) {
    ctx.addIssue({
      code: "custom",
      path: ["asset"],
      message: `${data.asset} is not supported on this network`,
    });
  }
};

/** Strips control characters and collapses whitespace on free text. */
const safeText = (max: number, label = "This field") =>
  z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`)
    // eslint-disable-next-line no-control-regex
    .transform((s) => s.replace(/[\u0000-\u001F\u007F]/g, "").replace(/\s+/g, " "));

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => v === "" || /^https?:\/\/\S+$/.test(v), "Enter a valid URL")
  .transform((v) => (v === "" ? null : v))
  .nullable()
  .optional();

// ─── Auth ────────────────────────────────────────────────────
export const signUpSchema = z
  .object({
    full_name: safeText(80, "Full name"),
    email,
    password,
    confirm_password: z.string(),
    referral_code: z
      .string()
      .trim()
      .toUpperCase()
      .max(16)
      .regex(/^[A-Z0-9]*$/, "Referral codes are letters and numbers only")
      .optional()
      .or(z.literal("")),
    accept_terms: z.coerce.boolean().refine((v) => v, "You must accept the terms"),
  })
  .refine((d) => d.password === d.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match",
  });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "Enter your password"),
  next: z.string().trim().max(200).optional(),
});

export const otpSchema = z.object({
  email,
  token: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({ password, confirm_password: z.string() })
  .refine((d) => d.password === d.confirm_password, {
    path: ["confirm_password"],
    message: "Passwords do not match",
  });

export const profileSchema = z.object({
  full_name: safeText(80, "Full name"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,24}$/, "3–24 characters: letters, numbers, underscore")
    .optional()
    .or(z.literal("")),
  country: z.string().trim().max(60).optional().or(z.literal("")),
  phone: z
    .string()
    .trim()
    .regex(/^[+0-9()\s-]{6,20}$/, "Enter a valid phone number")
    .optional()
    .or(z.literal("")),
});

// ─── Trading ─────────────────────────────────────────────────
export const placeTradeSchema = z.object({
  market_id: z.string().uuid("Invalid market"),
  option_id: z.string().uuid("Pick an outcome"),
  stake: money,
});

export const cancelTradeSchema = z.object({
  trade_id: z.string().uuid("Invalid trade"),
});

// ─── Wallet ──────────────────────────────────────────────────
export const depositSchema = z
  .object({
    amount: money,
    network,
    asset,
    tx_hash: txHash,
    to_address: evmAddress,
    receipt_path: z.string().trim().max(300).optional().or(z.literal("")),
  })
  .superRefine(networkAssetPair);

export const withdrawSchema = z
  .object({
    amount: money,
    network,
    asset,
    to_address: evmAddress,
  })
  .superRefine(networkAssetPair);

// ─── KYC ─────────────────────────────────────────────────────
export const kycSchema = z.object({
  doc_type: z.enum(["national_id", "passport", "driving_license"]),
  full_name: safeText(80, "Full name"),
  date_of_birth: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .refine((d) => {
      const dob = new Date(d);
      if (Number.isNaN(dob.getTime())) return false;
      const age = (Date.now() - dob.getTime()) / 31_557_600_000;
      return age >= 18 && age <= 120;
    }, "You must be at least 18 years old"),
  country: safeText(60, "Country"),
  document_number: safeText(40, "Document number"),
  front_path: z.string().trim().min(1, "Upload the document front"),
  back_path: z.string().trim().optional().or(z.literal("")),
  selfie_path: z.string().trim().min(1, "Capture a live selfie"),
});

// ─── Admin: markets ──────────────────────────────────────────
export const MAX_MARKET_OPTIONS = 12;

/** One row of the outcome editor: what members can back, and at what price. */
export const marketOptionSchema = z.object({
  label: safeText(60, "Outcome name"),
  price: z.coerce
    .number()
    .min(1, "Opening odds must be at least 1¢")
    .max(99, "Opening odds must be at most 99¢"),
});

export const marketOptionsSchema = z
  .array(marketOptionSchema)
  .min(2, "A market needs at least two outcomes")
  .max(MAX_MARKET_OPTIONS, `A market can have at most ${MAX_MARKET_OPTIONS} outcomes`)
  .superRefine((options, ctx) => {
    const seen = new Set<string>();
    options.forEach((option, index) => {
      const key = option.label.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: [index, "label"],
          message: `"${option.label}" is listed twice`,
        });
      }
      seen.add(key);
    });
  });

export const marketSchema = z
  .object({
    title: safeText(140, "Title"),
    question: safeText(240, "Question"),
    description: z.string().trim().max(2000).optional().or(z.literal("")),
    sport: z.enum(["football", "cricket", "basketball", "tennis", "esports"]),
    league: z.string().trim().max(80).optional().or(z.literal("")),
    team_a: z.string().trim().max(80).optional().or(z.literal("")),
    team_b: z.string().trim().max(80).optional().or(z.literal("")),
    team_a_logo: optionalUrl,
    team_b_logo: optionalUrl,
    banner_url: optionalUrl,
    min_trade: money,
    max_trade: money,
    start_time: z.string().trim().min(1, "Start time is required"),
    end_time: z.string().trim().min(1, "End time is required"),
    status: z.enum(["draft", "open", "closed"]),
    is_trending: z.coerce.boolean().optional(),
    is_featured: z.coerce.boolean().optional(),
  })
  .refine((d) => new Date(d.end_time) > new Date(d.start_time), {
    path: ["end_time"],
    message: "End time must be after start time",
  })
  .refine((d) => d.max_trade >= d.min_trade, {
    path: ["max_trade"],
    message: "Maximum must be greater than or equal to the minimum",
  });

/** An empty winning_option_id means "void the market and refund everyone". */
export const resolveMarketSchema = z.object({
  market_id: z.string().uuid(),
  winning_option_id: z
    .string()
    .trim()
    .refine((v) => v === "" || z.string().uuid().safeParse(v).success, "Pick an outcome")
    .transform((v) => (v === "" ? null : v)),
  note: z.string().trim().max(500).optional().or(z.literal("")),
});

// ─── Admin: reviews & moderation ─────────────────────────────
export const reviewSchema = z.object({
  request_id: z.string().uuid(),
  decision: z.enum(["approved", "rejected"]),
  note: z.string().trim().max(500).optional().or(z.literal("")),
  tx_hash: z.string().trim().max(120).optional().or(z.literal("")),
});

export const userStatusSchema = z.object({
  user_id: z.string().uuid(),
  status: z.enum(["active", "suspended", "banned"]),
  reason: z.string().trim().max(300).optional().or(z.literal("")),
  suspended_until: z.string().trim().optional().or(z.literal("")),
});

export const balanceAdjustSchema = z.object({
  user_id: z.string().uuid(),
  amount: z.coerce
    .number()
    .refine((n) => n !== 0, "Enter a non-zero amount")
    .refine((n) => Math.abs(n) <= 1_000_000, "Amount is too large"),
  reason: safeText(200, "Reason"),
});

export const grantBonusSchema = z.object({
  user_id: z.string().uuid(),
  kind: z.enum(["welcome", "deposit", "promo", "referral", "manual"]),
  amount: money,
  note: z.string().trim().max(200).optional().or(z.literal("")),
});

// ─── Admin: content & settings ───────────────────────────────
export const depositAddressSchema = z
  .object({
    network,
    asset,
    address: evmAddress,
    label: z.string().trim().max(40).optional().or(z.literal("")),
  })
  .superRefine(networkAssetPair);

export const promoBannerSchema = z
  .object({
    title: safeText(120, "Title"),
    subtitle: z.string().trim().max(240).optional().or(z.literal("")),
    image_url: optionalUrl,
    cta_label: z.string().trim().max(40).optional().or(z.literal("")),
    cta_link: z.string().trim().max(300).optional().or(z.literal("")),
    promo_bonus_percent: z.coerce.number().min(0).max(500).optional(),
    promo_bonus_cap: z.coerce.number().min(0).max(100_000).optional(),
    max_joiners: z.coerce.number().int().min(0).max(1_000_000).optional(),
    is_active: z.coerce.boolean().optional(),
    sort_order: z.coerce.number().int().min(0).max(999).optional(),
    starts_at: z.string().trim().optional().or(z.literal("")),
    ends_at: z.string().trim().optional().or(z.literal("")),
  })
  .refine(
    (d) => !d.starts_at || !d.ends_at || new Date(d.ends_at) > new Date(d.starts_at),
    { path: ["ends_at"], message: "End must be after start" }
  );

export const partnerSchema = z.object({
  name: safeText(80, "Name"),
  logo_url: optionalUrl,
  website: optionalUrl,
  is_active: z.coerce.boolean().optional(),
  sort_order: z.coerce.number().int().min(0).max(999).optional(),
});

export const settingsSchema = z.object({
  site_name: safeText(60, "Site name"),
  site_tagline: z.string().trim().max(140).optional().or(z.literal("")),
  support_email: email,
  trade_fee_percent: z.coerce.number().min(0).max(10),
  trade_fee_min: z.coerce.number().min(0).max(100),
  trade_fee_max: z.coerce.number().min(0).max(100),
  market_liquidity_anchor: z.coerce.number().min(10).max(1_000_000),
  min_deposit: z.coerce.number().min(0).max(100_000),
  min_withdrawal: z.coerce.number().min(0).max(100_000),
  withdraw_fee: z.coerce.number().min(0).max(1_000),
  welcome_bonus_amount: z.coerce.number().min(0).max(10_000),
  deposit_bonus_percent: z.coerce.number().min(0).max(500),
  deposit_bonus_cap: z.coerce.number().min(0).max(100_000),
  bonus_turnover_multiplier: z.coerce.number().min(0).max(100),
  referral_commission_percent: z.coerce.number().min(0).max(100),
  referral_min_deposit: z.coerce.number().min(0).max(100_000),
  referral_signup_bonus: z.coerce.number().min(0).max(10_000),
  social_twitter: z.string().trim().max(300).optional().or(z.literal("")),
  social_telegram: z.string().trim().max(300).optional().or(z.literal("")),
  social_discord: z.string().trim().max(300).optional().or(z.literal("")),
  deposits_enabled: z.coerce.boolean().optional(),
  withdrawals_enabled: z.coerce.boolean().optional(),
  trading_enabled: z.coerce.boolean().optional(),
  maintenance_mode: z.coerce.boolean().optional(),
}).refine((d) => d.trade_fee_max >= d.trade_fee_min, {
  path: ["trade_fee_max"],
  message: "Maximum fee must be greater than or equal to the minimum",
});

export const announcementSchema = z.object({
  title: safeText(120, "Title"),
  body: safeText(600, "Message"),
  link: z.string().trim().max(300).optional().or(z.literal("")),
});
