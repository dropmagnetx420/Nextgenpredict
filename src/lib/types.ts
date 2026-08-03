// Domain types mirroring the SQL schema in supabase/migrations.
// Regenerate the fully-typed client version any time with:
//   npm run db:generate

export type UserRole = "user" | "admin";
export type UserStatus = "active" | "suspended" | "banned";
export type KycStatus = "none" | "pending" | "approved" | "rejected";
export type KycDocType = "national_id" | "passport" | "driving_license";
export type Sport = "football" | "cricket" | "basketball" | "tennis" | "esports";
export type MarketStatus = "draft" | "open" | "closed" | "resolved" | "cancelled";
export type MarketOutcome = "yes" | "no" | "invalid";
export type TradeSide = "yes" | "no";
export type TradeStatus = "open" | "cancelled" | "won" | "lost" | "refunded";
export type RequestStatus = "pending" | "approved" | "rejected";
export type ChainNetwork = "robinhood" | "ethereum";
export type AssetSymbol = "ETH" | "USDG" | "USDC" | "USDT";
export type WalletKind = "main" | "bonus";

export type TxType =
  | "deposit" | "withdrawal" | "trade_open" | "trade_cancel" | "trade_payout"
  | "trade_refund" | "fee" | "bonus" | "referral_commission" | "admin_adjustment";

export type NotificationType =
  | "deposit_approved" | "deposit_rejected" | "withdrawal_approved"
  | "withdrawal_rejected" | "prediction_won" | "prediction_lost"
  | "prediction_refunded" | "kyc_approved" | "kyc_rejected"
  | "bonus_credited" | "referral_earning" | "announcement";

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  country: string | null;
  phone: string | null;
  role: UserRole;
  status: UserStatus;
  kyc_status: KycStatus;
  referral_code: string;
  referred_by: string | null;
  total_trades: number;
  trades_won: number;
  trades_lost: number;
  total_volume: number;
  total_pnl: number;
  turnover: number;
  suspended_until: string | null;
  ban_reason: string | null;
  last_login_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  user_id: string;
  available: number;
  bonus: number;
  locked: number;
  total_deposited: number;
  total_withdrawn: number;
  updated_at: string;
}

export interface Market {
  id: string;
  slug: string;
  sport: Sport;
  league: string | null;
  title: string;
  question: string;
  description: string | null;
  team_a: string | null;
  team_b: string | null;
  team_a_logo: string | null;
  team_b_logo: string | null;
  banner_url: string | null;
  yes_price: number;
  min_trade: number;
  max_trade: number;
  total_volume: number;
  yes_volume: number;
  no_volume: number;
  trade_count: number;
  status: MarketStatus;
  outcome: MarketOutcome | null;
  is_trending: boolean;
  is_featured: boolean;
  start_time: string;
  end_time: string;
  resolved_at: string | null;
  resolved_by: string | null;
  resolution_note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Trade {
  id: string;
  user_id: string;
  market_id: string;
  market_option_id: string | null;
  side: TradeSide;
  stake: number;
  stake_from_main: number;
  stake_from_bonus: number;
  price: number;
  shares: number;
  potential_payout: number;
  open_fee: number;
  cancel_fee: number;
  payout: number;
  pnl: number;
  status: TradeStatus;
  settled_at: string | null;
  cancelled_at: string | null;
  created_at: string;
}

export type TradeWithMarket = Trade & { market: Market | null };

export interface Transaction {
  id: string;
  user_id: string;
  type: TxType;
  wallet: WalletKind;
  amount: number;
  balance_after: number;
  reference_id: string | null;
  reference_table: string | null;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface DepositRequest {
  id: string;
  user_id: string;
  amount: number;
  network: ChainNetwork;
  asset: AssetSymbol;
  tx_hash: string;
  to_address: string;
  receipt_url: string | null;
  status: RequestStatus;
  credited_amount: number | null;
  bonus_amount: number;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface WithdrawRequest {
  id: string;
  user_id: string;
  amount: number;
  fee: number;
  net_amount: number;
  network: ChainNetwork;
  asset: AssetSymbol;
  to_address: string;
  status: RequestStatus;
  tx_hash: string | null;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface KycRequest {
  id: string;
  user_id: string;
  doc_type: KycDocType;
  full_name: string;
  date_of_birth: string | null;
  country: string;
  document_number: string;
  document_front_path: string;
  document_back_path: string | null;
  selfie_path: string;
  status: RequestStatus;
  admin_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string | null;
  type: NotificationType;
  title: string;
  body: string;
  link: string | null;
  is_read: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface BonusHistory {
  id: string;
  user_id: string;
  kind: string;
  amount: number;
  turnover_required: number;
  turnover_progress: number;
  is_cleared: boolean;
  expires_at: string | null;
  reference_id: string | null;
  note: string | null;
  created_at: string;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_id: string;
  code_used: string;
  signup_bonus_paid: boolean;
  total_commission: number;
  total_volume: number;
  created_at: string;
}

export interface DepositAddress {
  id: string;
  network: ChainNetwork;
  asset: AssetSymbol;
  address: string;
  label: string | null;
  is_active: boolean;
  total_received: number;
  created_at: string;
}

export interface PromoBanner {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string | null;
  cta_label: string | null;
  cta_link: string | null;
  promo_bonus_percent: number | null;
  promo_bonus_cap: number | null;
  max_joiners: number | null;
  join_count: number;
  is_active: boolean;
  sort_order: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
}

export interface Partner {
  id: string;
  name: string;
  logo_url: string | null;
  website: string | null;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

export interface AdminLog {
  id: string;
  admin_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown>;
  ip: string | null;
  created_at: string;
}

export interface RevenueSummary {
  total_fees: number;
  total_deposits: number;
  total_withdrawals: number;
  total_bonus: number;
  total_payouts: number;
  net_revenue: number;
  active_users: number;
  open_markets: number;
}

export type SiteSettings = Record<string, unknown>;

/** Shape returned by every server action. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string[]> };
