import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const usd = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compact = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** Money display. Values are USDG-denominated across the app. */
export function fmtMoney(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return usd.format(Number.isFinite(n) ? n : 0);
}

export function fmtCompact(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  return compact.format(Number.isFinite(n) ? n : 0);
}

/** Odds are stored as cents (1–99). */
export function fmtCents(value: number | string | null | undefined): string {
  return `${Number(value ?? 0).toFixed(0)}¢`;
}

export function fmtPercent(value: number | string | null | undefined, digits = 1): string {
  return `${Number(value ?? 0).toFixed(digits)}%`;
}

export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** "in 3h 12m" / "2d ago" */
export function fmtRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(diff);
  const mins = Math.floor(abs / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);

  let label: string;
  if (days > 0) label = `${days}d ${hours % 24}h`;
  else if (hours > 0) label = `${hours}h ${mins % 60}m`;
  else label = `${Math.max(mins, 1)}m`;

  return diff > 0 ? `in ${label}` : `${label} ago`;
}

export function truncateAddress(addr: string | null | undefined, size = 6): string {
  if (!addr) return "—";
  if (addr.length <= size * 2 + 2) return addr;
  return `${addr.slice(0, size)}…${addr.slice(-4)}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .slice(0, 70);
}

/**
 * Payout for a stake at a given cent-price. Mirrors place_trade():
 * shares = stake / (price/100), each winning share settles at 1.00.
 */
export function calcPayout(stake: number, priceCents: number): number {
  if (!stake || !priceCents) return 0;
  return stake / (priceCents / 100);
}

/** Mirrors calc_trade_fee() so the UI preview matches what the DB charges. */
export function calcFee(
  stake: number,
  pct: number,
  min: number,
  max: number
): number {
  const raw = (stake * pct) / 100;
  return Math.min(Math.max(raw, min), max);
}

export function initials(name: string | null | undefined, email?: string): string {
  const source = name?.trim() || email?.split("@")[0] || "?";
  return source
    .split(/[\s._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

/** Maps Postgres RAISE codes from our functions to user-facing copy. */
const DB_ERRORS: Record<string, string> = {
  NOT_AUTHENTICATED: "Please sign in to continue.",
  FORBIDDEN: "You don't have permission to do that.",
  INSUFFICIENT_FUNDS: "Insufficient balance for this action.",
  WALLET_NOT_FOUND: "Wallet not found. Contact support.",
  MARKET_NOT_FOUND: "This market no longer exists.",
  MARKET_NOT_OPEN: "This market is not accepting trades.",
  MARKET_NOT_STARTED: "This market hasn't opened yet.",
  MARKET_CLOSED: "This market has closed.",
  MARKET_ALREADY_SETTLED: "This market is already settled.",
  MARKET_NOT_CANCELLABLE: "Trades can only be cancelled while the market is open.",
  MARKET_HAS_TRADES:
    "This market already has predictions on it, so its outcomes can no longer be changed.",
  OPTION_NOT_FOUND: "That outcome is not part of this market.",
  OPTION_NOT_AVAILABLE: "That outcome is no longer available.",
  TOO_FEW_OPTIONS: "A market needs at least two outcomes before it can open.",
  TOO_MANY_OPTIONS: "That's more outcomes than a market can hold.",
  STAKE_BELOW_MIN: "Stake is below the market minimum.",
  STAKE_ABOVE_MAX: "Stake exceeds the market maximum.",
  TRADE_NOT_FOUND: "Trade not found.",
  TRADE_NOT_OPEN: "This trade is no longer open.",
  ACCOUNT_SUSPENDED: "Your account is suspended.",
  ACCOUNT_BANNED: "Your account has been banned.",
  REQUEST_NOT_FOUND: "Request not found.",
  REQUEST_ALREADY_REVIEWED: "This request was already reviewed.",
  BELOW_MIN_DEPOSIT: "Amount is below the minimum deposit.",
  BELOW_MIN_WITHDRAWAL: "Amount is below the minimum withdrawal.",
  DEPOSIT_NOT_ENABLED: "Deposits are unavailable for that network right now.",
  WITHDRAW_NOT_ENABLED: "Withdrawals are unavailable for that network right now.",
  UNKNOWN_ADDRESS: "That deposit address is not recognised. Refresh and retry.",
  TX_HASH_REQUIRED: "A transaction hash is required.",
  ADDRESS_REQUIRED: "A wallet address is required.",
  KYC_REQUIRED: "Verify your identity before withdrawing.",
  KYC_ALREADY_APPROVED: "Your identity is already verified.",
  KYC_ALREADY_PENDING: "You already have a KYC review in progress.",
  INVALID_FILE_PATH: "Invalid upload. Please try again.",
  PROTECTED_COLUMN: "That field cannot be edited.",
  CANNOT_MODERATE_SELF: "You cannot moderate your own account.",
  CANNOT_CHANGE_OWN_ROLE: "You cannot change your own role.",
  duplicate_key: "That record already exists.",
};

export function humanizeDbError(message: string | null | undefined): string {
  if (!message) return "Something went wrong. Please try again.";

  if (message.includes("BONUS_TURNOVER_PENDING")) {
    const amount = message.split(":")[1]?.trim().split(" ")[0];
    return amount
      ? `You still need to wager ${fmtMoney(amount)} USDG to unlock bonus funds.`
      : "Complete your bonus turnover requirement before withdrawing.";
  }
  if (message.includes("deposit_tx_hash_unique")) {
    return "That transaction hash has already been submitted.";
  }
  for (const [code, copy] of Object.entries(DB_ERRORS)) {
    if (message.includes(code)) return copy;
  }
  return "Something went wrong. Please try again.";
}
