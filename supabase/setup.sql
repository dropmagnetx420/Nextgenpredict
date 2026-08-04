-- ============================================================
-- NextGen Predict — full schema, 0001 through 0013 in one file
-- ============================================================
-- GENERATED FILE — do not edit. Regenerate with scripts/build-setup-sql.mjs.
--
-- Paste this whole file into the Supabase SQL Editor and run it once to
-- build the schema from empty. The numbered migrations are the source of
-- truth; this is only a convenience so the editor needs one paste
-- instead of 13 in the right order.
--
-- Safe to re-run: every statement is create-if-not-exists, create-or-
-- replace, or drop-then-create.
-- ============================================================


-- ==========================================================
-- >>> 0001_init_core.sql
-- ==========================================================

-- ============================================================
-- NextGen Predict — 0001 Extensions, Enums, Core Tables
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ------------------------- ENUMS ---------------------------
do $$ begin
  create type user_role       as enum ('user', 'admin');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type user_status     as enum ('active', 'suspended', 'banned');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type kyc_status      as enum ('none', 'pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type kyc_doc_type    as enum ('national_id', 'passport', 'driving_license');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type sport_type      as enum ('football', 'cricket', 'basketball', 'tennis', 'esports');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type market_status   as enum ('draft', 'open', 'closed', 'resolved', 'cancelled');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type market_outcome  as enum ('yes', 'no', 'invalid');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type trade_side      as enum ('yes', 'no');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type trade_status    as enum ('open', 'cancelled', 'won', 'lost', 'refunded');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type request_status  as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type chain_network   as enum ('robinhood', 'ethereum');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type asset_symbol    as enum ('ETH', 'USDG', 'USDC', 'USDT');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type wallet_kind     as enum ('main', 'bonus');
exception when duplicate_object then null;
end $$;
do $$ begin
  create type tx_type as enum (
    'deposit', 'withdrawal', 'trade_open', 'trade_cancel', 'trade_payout',
    'trade_refund', 'fee', 'bonus', 'referral_commission', 'admin_adjustment'
  );
exception when duplicate_object then null;
end $$;
do $$ begin
  create type notification_type as enum (
    'deposit_approved', 'deposit_rejected', 'withdrawal_approved', 'withdrawal_rejected',
    'prediction_won', 'prediction_lost', 'prediction_refunded', 'kyc_approved',
    'kyc_rejected', 'bonus_credited', 'referral_earning', 'announcement'
  );
exception when duplicate_object then null;
end $$;

-- ------------------------- USERS ---------------------------
-- Mirrors auth.users. Populated by a trigger on signup.
create table if not exists public.users (
  id             uuid primary key references auth.users(id) on delete cascade,
  email          citext not null unique,
  full_name      text,
  username       citext unique,
  avatar_url     text,
  country        text,
  phone          text,
  role           user_role   not null default 'user',
  status         user_status not null default 'active',
  kyc_status     kyc_status  not null default 'none',
  referral_code  text not null unique,
  referred_by    uuid references public.users(id) on delete set null,
  -- denormalised stats, maintained by triggers/functions
  total_trades   integer not null default 0,
  trades_won     integer not null default 0,
  trades_lost    integer not null default 0,
  total_volume   numeric(20,6) not null default 0,
  total_pnl      numeric(20,6) not null default 0,
  turnover       numeric(20,6) not null default 0,
  suspended_until timestamptz,
  ban_reason     text,
  last_login_at  timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint users_username_len check (username is null or char_length(username) between 3 and 24)
);

create index if not exists users_referral_code_idx on public.users (referral_code);
create index if not exists users_referred_by_idx   on public.users (referred_by);
create index if not exists users_role_idx          on public.users (role) where role = 'admin';
create index if not exists users_created_at_idx    on public.users (created_at desc);

-- ------------------------ WALLETS --------------------------
-- One row per user. Balances are in USD-equivalent units.
create table if not exists public.wallets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.users(id) on delete cascade,
  available       numeric(20,6) not null default 0 check (available >= 0),
  bonus           numeric(20,6) not null default 0 check (bonus >= 0),
  locked          numeric(20,6) not null default 0 check (locked >= 0),
  total_deposited numeric(20,6) not null default 0,
  total_withdrawn numeric(20,6) not null default 0,
  updated_at      timestamptz not null default now()
);

create index if not exists wallets_user_id_idx on public.wallets (user_id);

-- ------------------------ MARKETS --------------------------
create table if not exists public.markets (
  id            uuid primary key default gen_random_uuid(),
  slug          text not null unique,
  sport         sport_type not null,
  league        text,
  title         text not null,
  question      text not null,
  description   text,
  team_a        text,
  team_b        text,
  team_a_logo   text,
  team_b_logo   text,
  banner_url    text,
  -- odds expressed as YES price in cents (1..99); NO price = 100 - yes_price
  yes_price     numeric(6,2) not null default 50 check (yes_price > 0 and yes_price < 100),
  min_trade     numeric(20,6) not null default 1 check (min_trade > 0),
  max_trade     numeric(20,6) not null default 10000 check (max_trade > 0),
  total_volume  numeric(20,6) not null default 0,
  yes_volume    numeric(20,6) not null default 0,
  no_volume     numeric(20,6) not null default 0,
  trade_count   integer not null default 0,
  status        market_status not null default 'draft',
  outcome       market_outcome,
  is_trending   boolean not null default false,
  is_featured   boolean not null default false,
  start_time    timestamptz not null,
  end_time      timestamptz not null,
  resolved_at   timestamptz,
  resolved_by   uuid references public.users(id) on delete set null,
  resolution_note text,
  created_by    uuid references public.users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint markets_time_order check (end_time > start_time),
  constraint markets_trade_range check (max_trade >= min_trade)
);

create index if not exists markets_status_idx     on public.markets (status);
create index if not exists markets_sport_idx      on public.markets (sport);
create index if not exists markets_end_time_idx   on public.markets (end_time);
create index if not exists markets_trending_idx   on public.markets (is_trending) where is_trending;
create index if not exists markets_featured_idx   on public.markets (is_featured) where is_featured;
create index if not exists markets_open_list_idx  on public.markets (status, end_time desc) where status = 'open';

-- Optional richer outcome set (multi-option markets / future proofing)
create table if not exists public.market_options (
  id          uuid primary key default gen_random_uuid(),
  market_id   uuid not null references public.markets(id) on delete cascade,
  label       text not null,
  side        trade_side not null,
  price       numeric(6,2) not null check (price > 0 and price < 100),
  volume      numeric(20,6) not null default 0,
  is_winner   boolean,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now(),
  unique (market_id, side)
);

create index if not exists market_options_market_id_idx on public.market_options (market_id);

-- ==========================================================
-- >>> 0002_trades_money.sql
-- ==========================================================

-- ============================================================
-- NextGen Predict — 0002 Trades, Money Movement, User Activity
-- ============================================================

-- ------------------------- TRADES --------------------------
-- A prediction position. `stake` is split across main/bonus wallet
-- so cancellations refund each source exactly.
create table if not exists public.trades (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  market_id        uuid not null references public.markets(id) on delete cascade,
  market_option_id uuid references public.market_options(id) on delete set null,
  side             trade_side not null,
  stake            numeric(20,6) not null check (stake > 0),
  stake_from_main  numeric(20,6) not null default 0 check (stake_from_main >= 0),
  stake_from_bonus numeric(20,6) not null default 0 check (stake_from_bonus >= 0),
  price            numeric(6,2)  not null check (price > 0 and price < 100),
  shares           numeric(20,6) not null check (shares > 0),
  potential_payout numeric(20,6) not null check (potential_payout >= 0),
  open_fee         numeric(20,6) not null default 0 check (open_fee >= 0),
  cancel_fee       numeric(20,6) not null default 0 check (cancel_fee >= 0),
  payout           numeric(20,6) not null default 0 check (payout >= 0),
  pnl              numeric(20,6) not null default 0,
  status           trade_status not null default 'open',
  settled_at       timestamptz,
  cancelled_at     timestamptz,
  created_at       timestamptz not null default now(),
  constraint trades_stake_split check (stake_from_main + stake_from_bonus = stake)
);

create index if not exists trades_user_id_idx       on public.trades (user_id, created_at desc);
create index if not exists trades_market_id_idx     on public.trades (market_id);
create index if not exists trades_status_idx        on public.trades (status);
create index if not exists trades_open_by_market_idx on public.trades (market_id, status) where status = 'open';

-- ----------------------- TRANSACTIONS ----------------------
-- Immutable ledger. Every balance change writes exactly one row.
create table if not exists public.transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.users(id) on delete cascade,
  type            tx_type not null,
  wallet          wallet_kind not null default 'main',
  amount          numeric(20,6) not null,          -- signed: +credit / -debit
  balance_after   numeric(20,6) not null,
  reference_id    uuid,                            -- trade / deposit / withdrawal id
  reference_table text,
  description     text,
  metadata        jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now()
);

create index if not exists transactions_user_id_idx   on public.transactions (user_id, created_at desc);
create index if not exists transactions_type_idx      on public.transactions (type);
create index if not exists transactions_reference_idx on public.transactions (reference_id);
create index if not exists transactions_created_idx   on public.transactions (created_at desc);

-- --------------------- DEPOSIT REQUESTS --------------------
create table if not exists public.deposit_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  amount         numeric(20,6) not null check (amount > 0),
  network        chain_network not null,
  asset          asset_symbol not null,
  tx_hash        text not null,
  to_address     text not null,
  receipt_url    text,
  status         request_status not null default 'pending',
  credited_amount numeric(20,6),
  bonus_amount   numeric(20,6) not null default 0,
  admin_note     text,
  reviewed_by    uuid references public.users(id) on delete set null,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now(),
  constraint deposit_asset_network_valid check (
    (network = 'robinhood' and asset in ('ETH','USDG')) or
    (network = 'ethereum'  and asset in ('USDC','USDT','ETH'))
  ),
  -- A given on-chain transfer may only ever be claimed once.
  constraint deposit_tx_hash_unique unique (network, tx_hash)
);

create index if not exists deposit_requests_user_idx   on public.deposit_requests (user_id, created_at desc);
create index if not exists deposit_requests_status_idx on public.deposit_requests (status, created_at desc);

-- -------------------- WITHDRAW REQUESTS --------------------
create table if not exists public.withdraw_requests (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references public.users(id) on delete cascade,
  amount        numeric(20,6) not null check (amount > 0),
  fee           numeric(20,6) not null default 0 check (fee >= 0),
  net_amount    numeric(20,6) not null check (net_amount > 0),
  network       chain_network not null,
  asset         asset_symbol not null,
  to_address    text not null,
  status        request_status not null default 'pending',
  tx_hash       text,
  admin_note    text,
  reviewed_by   uuid references public.users(id) on delete set null,
  reviewed_at   timestamptz,
  created_at    timestamptz not null default now(),
  constraint withdraw_asset_network_valid check (
    (network = 'robinhood' and asset in ('ETH','USDG')) or
    (network = 'ethereum'  and asset in ('USDC','USDT','ETH'))
  )
);

create index if not exists withdraw_requests_user_idx   on public.withdraw_requests (user_id, created_at desc);
create index if not exists withdraw_requests_status_idx on public.withdraw_requests (status, created_at desc);

-- ------------------------ KYC REQUESTS ---------------------
create table if not exists public.kyc_requests (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.users(id) on delete cascade,
  doc_type       kyc_doc_type not null,
  full_name      text not null,
  date_of_birth  date,
  country        text not null,
  document_number text not null,
  document_front_path text not null,
  document_back_path  text,
  selfie_path    text not null,
  status         request_status not null default 'pending',
  admin_note     text,
  reviewed_by    uuid references public.users(id) on delete set null,
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);

create index if not exists kyc_requests_user_idx   on public.kyc_requests (user_id, created_at desc);
create index if not exists kyc_requests_status_idx on public.kyc_requests (status, created_at desc);
-- Only one in-flight KYC application per user.
create unique index if not exists kyc_one_pending_per_user
  on public.kyc_requests (user_id) where status = 'pending';

-- ----------------------- NOTIFICATIONS ---------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.users(id) on delete cascade, -- null = broadcast
  type       notification_type not null,
  title      text not null,
  body       text not null,
  link       text,
  is_read    boolean not null default false,
  metadata   jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_idx    on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx  on public.notifications (user_id, is_read) where not is_read;
create index if not exists notifications_broadcast_idx on public.notifications (created_at desc) where user_id is null;

-- ----------------------- BONUS HISTORY ---------------------
create table if not exists public.bonus_history (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null references public.users(id) on delete cascade,
  kind              text not null,  -- welcome | deposit | promo | referral | manual
  amount            numeric(20,6) not null check (amount > 0),
  turnover_required numeric(20,6) not null default 0,
  turnover_progress numeric(20,6) not null default 0,
  is_cleared        boolean not null default false,
  expires_at        timestamptz,
  reference_id      uuid,
  note              text,
  created_at        timestamptz not null default now()
);

create index if not exists bonus_history_user_idx   on public.bonus_history (user_id, created_at desc);
create index if not exists bonus_history_active_idx on public.bonus_history (user_id) where not is_cleared;

-- ------------------------ REFERRALS ------------------------
create table if not exists public.referrals (
  id                uuid primary key default gen_random_uuid(),
  referrer_id       uuid not null references public.users(id) on delete cascade,
  referred_id       uuid not null unique references public.users(id) on delete cascade,
  code_used         text not null,
  signup_bonus_paid boolean not null default false,
  total_commission  numeric(20,6) not null default 0,
  total_volume      numeric(20,6) not null default 0,
  created_at        timestamptz not null default now(),
  constraint referrals_no_self check (referrer_id <> referred_id)
);

create index if not exists referrals_referrer_idx on public.referrals (referrer_id, created_at desc);

-- ==========================================================
-- >>> 0003_admin_content.sql
-- ==========================================================

-- ============================================================
-- NextGen Predict — 0003 Admin, Settings, Content Tables
-- ============================================================

-- ----------------------- SITE SETTINGS ---------------------
-- Single-row-per-key settings consumed by server components.
create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- --------------------- DEPOSIT ADDRESSES -------------------
-- Admin seeds 10–15 wallet addresses per network+asset. Each user's
-- deposit page shows a random one (rotate_deposit_address()).
create table if not exists public.deposit_addresses (
  id          uuid primary key default gen_random_uuid(),
  network     chain_network not null,
  asset       asset_symbol not null,
  address     text not null unique,
  label       text,
  is_active   boolean not null default true,
  total_received numeric(20,6) not null default 0,
  created_at  timestamptz not null default now()
);

create index if not exists deposit_addresses_active_idx
  on public.deposit_addresses (network, asset) where is_active;

-- ---------------------- PROMO BANNERS ----------------------
-- Multiple simultaneously. `limit_reached` is managed automatically
-- when a promo bonus offer is attached (joining-user cap).
create table if not exists public.promo_banners (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  subtitle      text,
  image_url     text,
  cta_label     text,
  cta_link      text,
  promo_bonus_percent numeric(6,2),
  promo_bonus_cap    numeric(20,6),
  max_joiners   integer,
  join_count    integer not null default 0,
  is_active     boolean not null default true,
  sort_order    integer not null default 0,
  starts_at     timestamptz,
  ends_at       timestamptz,
  created_at    timestamptz not null default now()
);

-- ------------------------ PARTNERS -------------------------
-- Sponsor / partner logos shown in the footer (set from admin).
create table if not exists public.partners (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  logo_url   text,
  website    text,
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------- ADMIN LOGS ------------------------
create table if not exists public.admin_logs (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.users(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  ip          text,
  created_at  timestamptz not null default now()
);

create index if not exists admin_logs_admin_idx  on public.admin_logs (admin_id, created_at desc);
create index if not exists admin_logs_action_idx on public.admin_logs (action);

-- ----------------------- RATE LIMITS -----------------------
-- Lightweight sliding-window limiter for auth & trade endpoints.
create table if not exists public.rate_limits (
  key        text primary key,
  count      integer not null default 0,
  reset_at   timestamptz not null default now()
);

-- ==========================================================
-- >>> 0004_functions_core.sql
-- ==========================================================

-- ============================================================
-- NextGen Predict — 0004 Helper Functions & Triggers
-- ============================================================

-- Reads a numeric setting with a fallback.
create or replace function public.setting_num(p_key text, p_default numeric)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::numeric from site_settings where key = p_key), p_default);
$$;

create or replace function public.setting_bool(p_key text, p_default boolean)
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select (value #>> '{}')::boolean from site_settings where key = p_key), p_default);
$$;

-- Is the calling user an admin? Used throughout RLS.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.users
    where id = auth.uid() and role = 'admin' and status = 'active'
  );
$$;

-- Trade fee: percentage of stake, clamped to the admin's [min,max] band.
-- Defaults enforce the 0.3–1.0 USDG requirement on both open and cancel.
create or replace function public.calc_trade_fee(p_stake numeric)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  v_pct numeric := setting_num('trade_fee_percent', 0.5);
  v_min numeric := setting_num('trade_fee_min', 0.3);
  v_max numeric := setting_num('trade_fee_max', 1.0);
  v_fee numeric;
begin
  v_fee := round(p_stake * v_pct / 100.0, 6);
  if v_fee < v_min then v_fee := v_min; end if;
  if v_fee > v_max then v_fee := v_max; end if;
  return v_fee;
end;
$$;

-- Generates a collision-free referral code.
create or replace function public.gen_referral_code()
returns text language plpgsql volatile security definer set search_path = public as $$
declare
  v_code text;
  v_alphabet text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- no ambiguous chars
  i integer;
begin
  loop
    v_code := '';
    for i in 1..8 loop
      v_code := v_code || substr(v_alphabet, 1 + floor(random() * length(v_alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from public.users where referral_code = v_code);
  end loop;
  return v_code;
end;
$$;

-- Writes a ledger row and mutates the wallet atomically.
-- p_amount is signed. Raises if the resulting balance would go negative.
create or replace function public.apply_balance(
  p_user_id uuid,
  p_wallet  wallet_kind,
  p_amount  numeric,
  p_type    tx_type,
  p_reference_id uuid default null,
  p_reference_table text default null,
  p_description text default null,
  p_metadata jsonb default '{}'::jsonb
) returns numeric language plpgsql volatile security definer set search_path = public as $$
declare
  v_after numeric;
begin
  if p_wallet = 'main' then
    update wallets set available = available + p_amount, updated_at = now()
    where user_id = p_user_id
    returning available into v_after;
  else
    update wallets set bonus = bonus + p_amount, updated_at = now()
    where user_id = p_user_id
    returning bonus into v_after;
  end if;

  if v_after is null then
    raise exception 'WALLET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_after < 0 then
    raise exception 'INSUFFICIENT_FUNDS' using errcode = 'P0001';
  end if;

  insert into transactions (user_id, type, wallet, amount, balance_after,
                            reference_id, reference_table, description, metadata)
  values (p_user_id, p_type, p_wallet, p_amount, v_after,
          p_reference_id, p_reference_table, p_description, p_metadata);

  return v_after;
end;
$$;

-- Creates a notification (no-op guard for broadcast rows).
create or replace function public.notify_user(
  p_user_id uuid, p_type notification_type, p_title text,
  p_body text, p_link text default null, p_metadata jsonb default '{}'::jsonb
) returns uuid language plpgsql volatile security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into notifications (user_id, type, title, body, link, metadata)
  values (p_user_id, p_type, p_title, p_body, p_link, p_metadata)
  returning id into v_id;
  return v_id;
end;
$$;

-- Credits turnover progress against a user's un-cleared bonuses.
-- Bonus funds only become withdrawable once turnover_required is met.
create or replace function public.credit_turnover(p_user_id uuid, p_volume numeric)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  update users set turnover = turnover + p_volume where id = p_user_id;

  update bonus_history
  set turnover_progress = least(turnover_progress + p_volume, turnover_required)
  where user_id = p_user_id and not is_cleared;

  update bonus_history
  set is_cleared = true
  where user_id = p_user_id and not is_cleared
    and turnover_progress >= turnover_required;
end;
$$;

-- Remaining turnover a user must wager before withdrawing.
create or replace function public.pending_turnover(p_user_id uuid)
returns numeric language sql stable security definer set search_path = public as $$
  select coalesce(sum(turnover_required - turnover_progress), 0)
  from bonus_history
  where user_id = p_user_id and not is_cleared;
$$;

-- Returns one random active deposit address for the network+asset.
create or replace function public.random_deposit_address(
  p_network chain_network, p_asset asset_symbol
) returns table (id uuid, address text, label text)
language sql stable security definer set search_path = public as $$
  select id, address, label
  from deposit_addresses
  where network = p_network and asset = p_asset and is_active
  order by random()
  limit 1;
$$;

-- Sliding-window rate limiter. Returns true when the call is allowed.
create or replace function public.check_rate_limit(
  p_key text, p_max integer, p_window_seconds integer
) returns boolean language plpgsql volatile security definer set search_path = public as $$
declare v_count integer; v_reset timestamptz;
begin
  insert into rate_limits (key, count, reset_at)
  values (p_key, 1, now() + make_interval(secs => p_window_seconds))
  on conflict (key) do update
    set count = case when rate_limits.reset_at < now() then 1 else rate_limits.count + 1 end,
        reset_at = case when rate_limits.reset_at < now()
                        then now() + make_interval(secs => p_window_seconds)
                        else rate_limits.reset_at end
  returning count, reset_at into v_count, v_reset;

  return v_count <= p_max;
end;
$$;

-- ------------------------- TRIGGERS ------------------------
create or replace function public.touch_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end;
$$;

drop trigger if exists users_touch on public.users;
create trigger users_touch   before update on public.users   for each row execute function public.touch_updated_at();
drop trigger if exists markets_touch on public.markets;
create trigger markets_touch before update on public.markets for each row execute function public.touch_updated_at();

-- Provisions a public.users row + wallet whenever auth.users gains a row.
-- Applies the welcome bonus and links the referrer if a code was supplied.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_code       text := gen_referral_code();
  v_ref_code   text := nullif(trim(new.raw_user_meta_data ->> 'referral_code'), '');
  v_referrer   uuid;
  v_welcome    numeric := setting_num('welcome_bonus_amount', 0);
  v_turnover_x numeric := setting_num('bonus_turnover_multiplier', 5);
  v_bootstrap  text := coalesce(current_setting('app.admin_bootstrap_emails', true), '');
  v_role       user_role := 'user';
begin
  if v_ref_code is not null then
    select id into v_referrer from users where referral_code = upper(v_ref_code);
  end if;

  if v_bootstrap <> '' and position(lower(new.email) in lower(v_bootstrap)) > 0 then
    v_role := 'admin';
  end if;

  insert into users (id, email, full_name, avatar_url, referral_code, referred_by, role)
  values (
    new.id,
    new.email,
    nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name',
                         new.raw_user_meta_data ->> 'name')), ''),
    new.raw_user_meta_data ->> 'avatar_url',
    v_code,
    v_referrer,
    v_role
  );

  insert into wallets (user_id) values (new.id);

  if v_referrer is not null then
    insert into referrals (referrer_id, referred_id, code_used)
    values (v_referrer, new.id, upper(v_ref_code))
    on conflict (referred_id) do nothing;
  end if;

  if v_welcome > 0 then
    perform apply_balance(new.id, 'bonus', v_welcome, 'bonus', null, null, 'Welcome bonus');
    insert into bonus_history (user_id, kind, amount, turnover_required)
    values (new.id, 'welcome', v_welcome, v_welcome * v_turnover_x);
    perform notify_user(new.id, 'bonus_credited', 'Welcome bonus credited',
      format('You received a %s USDG welcome bonus. Wager %sx to unlock withdrawals.',
             v_welcome, v_turnover_x), '/dashboard/wallet');
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ==========================================================
-- >>> 0005_functions_trading.sql
-- ==========================================================

-- ============================================================
-- NextGen Predict — 0005 Trading Engine
-- All balance mutations happen inside these functions so a trade
-- can never partially apply. Market rows are locked FOR UPDATE.
-- ============================================================

-- Liquidity-anchored price: starts at 50c and drifts with volume
-- imbalance. Bounded to 2..98 so a side is never free.
create or replace function public.derive_yes_price(p_yes_vol numeric, p_no_vol numeric)
returns numeric language plpgsql stable security definer set search_path = public as $$
declare
  v_l numeric := setting_num('market_liquidity_anchor', 500);
  v_price numeric;
begin
  v_price := 100.0 * (p_yes_vol + v_l) / (p_yes_vol + p_no_vol + 2 * v_l);
  return round(greatest(2, least(98, v_price)), 2);
end;
$$;

-- ------------------------ PLACE TRADE ----------------------
create or replace function public.place_trade(
  p_market_id uuid,
  p_side      trade_side,
  p_stake     numeric
) returns public.trades
language plpgsql volatile security definer set search_path = public as $$
declare
  v_user     uuid := auth.uid();
  v_u        users;
  v_m        markets;
  v_w        wallets;
  v_fee      numeric;
  v_price    numeric;
  v_shares   numeric;
  v_payout   numeric;
  v_total    numeric;
  v_from_main  numeric;
  v_from_bonus numeric;
  v_fee_main   numeric;
  v_trade    trades;
  v_option   uuid;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_u from users where id = v_user;
  if v_u.status <> 'active' then
    raise exception 'ACCOUNT_%', upper(v_u.status::text) using errcode = 'P0001';
  end if;

  -- Serialise concurrent trades on the same market.
  select * into v_m from markets where id = p_market_id for update;
  if not found then
    raise exception 'MARKET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_m.status <> 'open' then
    raise exception 'MARKET_NOT_OPEN' using errcode = 'P0001';
  end if;
  if now() < v_m.start_time then
    raise exception 'MARKET_NOT_STARTED' using errcode = 'P0001';
  end if;
  if now() >= v_m.end_time then
    raise exception 'MARKET_CLOSED' using errcode = 'P0001';
  end if;
  if p_stake < v_m.min_trade then
    raise exception 'STAKE_BELOW_MIN' using errcode = 'P0001';
  end if;
  if p_stake > v_m.max_trade then
    raise exception 'STAKE_ABOVE_MAX' using errcode = 'P0001';
  end if;

  v_fee   := calc_trade_fee(p_stake);
  v_total := p_stake + v_fee;

  select * into v_w from wallets where user_id = v_user for update;
  if v_w.available + v_w.bonus < v_total then
    raise exception 'INSUFFICIENT_FUNDS' using errcode = 'P0001';
  end if;

  -- Spend real balance first, then bonus. The fee is always taken from
  -- whichever pool funds it, but tracked separately from the stake.
  v_from_main  := least(v_w.available, v_total);
  v_from_bonus := v_total - v_from_main;

  -- Attribute the fee to main where possible so stake splits stay clean.
  v_fee_main := least(v_fee, v_from_main);
  v_from_main  := v_from_main  - v_fee_main;
  v_from_bonus := v_from_bonus - (v_fee - v_fee_main);

  v_price  := v_m.yes_price;
  if p_side = 'no' then v_price := 100 - v_m.yes_price; end if;

  v_shares := round(p_stake / (v_price / 100.0), 6);
  v_payout := v_shares; -- each winning share settles at 1.00

  select id into v_option from market_options
  where market_id = p_market_id and side = p_side;

  insert into trades (user_id, market_id, market_option_id, side, stake,
                      stake_from_main, stake_from_bonus, price, shares,
                      potential_payout, open_fee)
  values (v_user, p_market_id, v_option, p_side, p_stake,
          v_from_main, v_from_bonus, v_price, v_shares, v_payout, v_fee)
  returning * into v_trade;

  if v_from_main + v_fee_main > 0 then
    perform apply_balance(v_user, 'main', -(v_from_main + v_fee_main), 'trade_open',
      v_trade.id, 'trades', format('%s %s @ %sc', upper(p_side::text), v_m.title, v_price));
  end if;
  if v_from_bonus + (v_fee - v_fee_main) > 0 then
    perform apply_balance(v_user, 'bonus', -(v_from_bonus + (v_fee - v_fee_main)), 'trade_open',
      v_trade.id, 'trades', format('%s %s @ %sc (bonus)', upper(p_side::text), v_m.title, v_price));
  end if;

  update markets set
    yes_volume   = yes_volume + case when p_side = 'yes' then p_stake else 0 end,
    no_volume    = no_volume  + case when p_side = 'no'  then p_stake else 0 end,
    total_volume = total_volume + p_stake,
    trade_count  = trade_count + 1,
    yes_price    = derive_yes_price(
                     yes_volume + case when p_side = 'yes' then p_stake else 0 end,
                     no_volume  + case when p_side = 'no'  then p_stake else 0 end)
  where id = p_market_id;

  update market_options o set
    volume = o.volume + case when o.side = p_side then p_stake else 0 end,
    price  = case when o.side = 'yes'
                  then (select yes_price from markets where id = p_market_id)
                  else 100 - (select yes_price from markets where id = p_market_id) end
  where o.market_id = p_market_id;

  update users set total_trades = total_trades + 1,
                   total_volume = total_volume + p_stake
  where id = v_user;

  perform credit_turnover(v_user, p_stake);

  -- Referral commission on the trade fee.
  perform pay_referral_commission(v_user, v_fee, v_trade.id);

  return v_trade;
end;
$$;

-- ------------------------ CANCEL TRADE ---------------------
-- Users may cancel while the market is still open. A cancel fee in the
-- same 0.3–1 band applies. Turnover credit is reversed so open/cancel
-- cycles cannot be used to clear a bonus for free.
create or replace function public.cancel_trade(p_trade_id uuid)
returns public.trades
language plpgsql volatile security definer set search_path = public as $$
declare
  v_user   uuid := auth.uid();
  v_t      trades;
  v_m      markets;
  v_fee    numeric;
  v_refund_main  numeric;
  v_refund_bonus numeric;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_t from trades where id = p_trade_id for update;
  if not found then
    raise exception 'TRADE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_t.user_id <> v_user and not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_t.status <> 'open' then
    raise exception 'TRADE_NOT_OPEN' using errcode = 'P0001';
  end if;

  select * into v_m from markets where id = v_t.market_id for update;
  if v_m.status <> 'open' then
    raise exception 'MARKET_NOT_CANCELLABLE' using errcode = 'P0001';
  end if;

  v_fee := calc_trade_fee(v_t.stake);

  -- Refund each source exactly; the cancel fee is deducted from the
  -- main-wallet refund, falling back to the bonus portion if needed.
  v_refund_main  := v_t.stake_from_main;
  v_refund_bonus := v_t.stake_from_bonus;

  if v_refund_main >= v_fee then
    v_refund_main := v_refund_main - v_fee;
  else
    v_refund_bonus := greatest(0, v_refund_bonus - (v_fee - v_refund_main));
    v_refund_main  := 0;
  end if;

  update trades set status = 'cancelled', cancel_fee = v_fee,
                    cancelled_at = now(), pnl = -(open_fee + v_fee)
  where id = p_trade_id
  returning * into v_t;

  if v_refund_main > 0 then
    perform apply_balance(v_user, 'main', v_refund_main, 'trade_cancel',
      v_t.id, 'trades', format('Cancelled %s — refund', v_m.title));
  end if;
  if v_refund_bonus > 0 then
    perform apply_balance(v_user, 'bonus', v_refund_bonus, 'trade_cancel',
      v_t.id, 'trades', format('Cancelled %s — bonus refund', v_m.title));
  end if;

  update markets set
    yes_volume   = greatest(0, yes_volume - case when v_t.side = 'yes' then v_t.stake else 0 end),
    no_volume    = greatest(0, no_volume  - case when v_t.side = 'no'  then v_t.stake else 0 end),
    total_volume = greatest(0, total_volume - v_t.stake),
    trade_count  = greatest(0, trade_count - 1),
    yes_price    = derive_yes_price(
                     greatest(0, yes_volume - case when v_t.side = 'yes' then v_t.stake else 0 end),
                     greatest(0, no_volume  - case when v_t.side = 'no'  then v_t.stake else 0 end))
  where id = v_t.market_id;

  update users set total_trades = greatest(0, total_trades - 1),
                   total_volume = greatest(0, total_volume - v_t.stake),
                   turnover     = greatest(0, turnover - v_t.stake)
  where id = v_user;

  update bonus_history
  set turnover_progress = greatest(0, turnover_progress - v_t.stake),
      is_cleared = (greatest(0, turnover_progress - v_t.stake) >= turnover_required)
  where user_id = v_user and not is_cleared;

  perform notify_user(v_user, 'prediction_refunded', 'Trade cancelled',
    format('Your %s position on "%s" was cancelled. Fee: %s USDG.',
           upper(v_t.side::text), v_m.title, v_fee), '/dashboard/predictions');

  return v_t;
end;
$$;

-- ----------------------- RESOLVE MARKET --------------------
-- Admin-only. Settles every open position in one transaction.
-- outcome 'invalid' refunds all stakes to their original wallets.
create or replace function public.resolve_market(
  p_market_id uuid,
  p_outcome   market_outcome,
  p_note      text default null
) returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  v_admin uuid := auth.uid();
  v_m     markets;
  v_t     trades;
  v_count integer := 0;
  v_payout numeric;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_m from markets where id = p_market_id for update;
  if not found then
    raise exception 'MARKET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_m.status in ('resolved', 'cancelled') then
    raise exception 'MARKET_ALREADY_SETTLED' using errcode = 'P0001';
  end if;

  for v_t in
    select * from trades where market_id = p_market_id and status = 'open' for update
  loop
    if p_outcome = 'invalid' then
      if v_t.stake_from_main > 0 then
        perform apply_balance(v_t.user_id, 'main', v_t.stake_from_main, 'trade_refund',
          v_t.id, 'trades', format('Market voided — refund: %s', v_m.title));
      end if;
      if v_t.stake_from_bonus > 0 then
        perform apply_balance(v_t.user_id, 'bonus', v_t.stake_from_bonus, 'trade_refund',
          v_t.id, 'trades', format('Market voided — bonus refund: %s', v_m.title));
      end if;

      update trades set status = 'refunded', payout = v_t.stake,
                        pnl = -v_t.open_fee, settled_at = now()
      where id = v_t.id;

      perform notify_user(v_t.user_id, 'prediction_refunded', 'Market voided',
        format('"%s" was voided. Your %s USDG stake has been refunded.',
               v_m.title, v_t.stake), '/dashboard/predictions');

    elsif v_t.side::text = p_outcome::text then
      v_payout := v_t.potential_payout;

      perform apply_balance(v_t.user_id, 'main', v_payout, 'trade_payout',
        v_t.id, 'trades', format('Won %s — %s', v_m.title, upper(v_t.side::text)));

      update trades set status = 'won', payout = v_payout,
                        pnl = v_payout - v_t.stake - v_t.open_fee, settled_at = now()
      where id = v_t.id;

      update users set trades_won = trades_won + 1,
                       total_pnl = total_pnl + (v_payout - v_t.stake - v_t.open_fee)
      where id = v_t.user_id;

      perform notify_user(v_t.user_id, 'prediction_won', 'Prediction won',
        format('You won %s USDG on "%s".', round(v_payout, 2), v_m.title),
        '/dashboard/predictions');

    else
      update trades set status = 'lost', payout = 0,
                        pnl = -(v_t.stake + v_t.open_fee), settled_at = now()
      where id = v_t.id;

      update users set trades_lost = trades_lost + 1,
                       total_pnl = total_pnl - (v_t.stake + v_t.open_fee)
      where id = v_t.user_id;

      perform notify_user(v_t.user_id, 'prediction_lost', 'Prediction settled',
        format('Your %s position on "%s" did not win.',
               upper(v_t.side::text), v_m.title), '/dashboard/predictions');
    end if;

    v_count := v_count + 1;
  end loop;

  update markets set
    status = case when p_outcome = 'invalid' then 'cancelled' else 'resolved' end,
    outcome = p_outcome, resolved_at = now(), resolved_by = v_admin,
    resolution_note = p_note
  where id = p_market_id;

  update market_options set is_winner = (side::text = p_outcome::text)
  where market_id = p_market_id;

  insert into admin_logs (admin_id, action, entity_type, entity_id, details)
  values (v_admin, 'resolve_market', 'markets', p_market_id,
          jsonb_build_object('outcome', p_outcome, 'settled', v_count, 'note', p_note));

  return v_count;
end;
$$;

-- ==========================================================
-- >>> 0006_functions_deposits.sql
-- ==========================================================

-- ============================================================
-- NextGen Predict — 0006 Deposit / Withdrawal / Bonus
-- ============================================================

-- --------------------- REFERRAL COMMISSION -----------------
-- Pays the referrer a % of the referee's trade fee, only once the
-- referee's total deposited volume exceeds the payout threshold.
create or replace function public.pay_referral_commission(
  p_user_id uuid, p_fee_amount numeric, p_trade_id uuid default null
) returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_ref   referrals;
  v_rate  numeric := setting_num('referral_commission_percent', 10);
  v_min_dep numeric := setting_num('referral_min_deposit', 10);
  v_total_dep numeric;
  v_amount numeric;
begin
  select * into v_ref from referrals where referred_id = p_user_id;
  if not found then return; end if;

  select total_deposited into v_total_dep
  from wallets where user_id = p_user_id;

  if v_total_dep < v_min_dep then return; end if;

  v_amount := round(p_fee_amount * v_rate / 100.0, 6);
  if v_amount <= 0 then return; end if;

  perform apply_balance(v_ref.referrer_id, 'main', v_amount, 'referral_commission',
    p_trade_id, 'trades', 'Referral commission from your invitee');

  update referrals set total_commission = total_commission + v_amount,
                       total_volume = total_volume + p_fee_amount
  where id = v_ref.id;

  perform notify_user(v_ref.referrer_id, 'referral_earning', 'Referral earning',
    format('You earned %s USDG commission from your invitee.', v_amount),
    '/dashboard/referrals');
end;
$$;

-- ---------------------- DEPOSIT REQUEST --------------------
-- Pre-validates the network/asset/tx-hash before storing a pending row.
create or replace function public.create_deposit_request(
  p_amount    numeric,
  p_network   chain_network,
  p_asset     asset_symbol,
  p_tx_hash   text,
  p_to_address text,
  p_receipt_url text default null
) returns public.deposit_requests
language plpgsql volatile security definer set search_path = public as $$
declare
  v_user  uuid := auth.uid();
  v_min   numeric := setting_num('min_deposit', 1);
  v_known boolean;
  v_row   deposit_requests;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if not exists (select 1 from deposit_addresses
                 where network = p_network and asset = p_asset and is_active) then
    raise exception 'DEPOSIT_NOT_ENABLED' using errcode = 'P0001';
  end if;

  select exists (select 1 from deposit_addresses
                 where network = p_network and asset = p_asset
                   and address = p_to_address and is_active) into v_known;
  if not v_known then
    raise exception 'UNKNOWN_ADDRESS' using errcode = 'P0001';
  end if;

  if p_amount < v_min then
    raise exception 'BELOW_MIN_DEPOSIT' using errcode = 'P0001';
  end if;
  if nullif(trim(p_tx_hash), '') is null then
    raise exception 'TX_HASH_REQUIRED' using errcode = 'P0001';
  end if;

  insert into deposit_requests (user_id, amount, network, asset, tx_hash, to_address, receipt_url)
  values (v_user, p_amount, p_network, p_asset, trim(p_tx_hash), p_to_address, p_receipt_url)
  returning * into v_row;

  perform notify_user(v_user, 'announcement', 'Deposit submitted',
    format('Your %s %s deposit of %s USDG is under review.', p_asset, p_network, p_amount),
    '/dashboard/deposit');

  return v_row;
end;
$$;

-- ---------------------- APPROVE DEPOSIT --------------------
-- Admin-only. Credits main balance, applies deposit bonus + promo
-- join tracking, records ledger rows, notifies the user.
create or replace function public.approve_deposit(p_request_id uuid)
returns public.deposit_requests
language plpgsql volatile security definer set search_path = public as $$
declare
  v_admin uuid := auth.uid();
  v_req   deposit_requests;
  v_bonus numeric := 0;
  v_row   deposit_requests;
  v_banner promo_banners;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_req from deposit_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'REQUEST_ALREADY_REVIEWED' using errcode = 'P0001';
  end if;

  -- Match an active promo bonus whose cap hasn't been hit yet.
  select * into v_banner from promo_banners
  where is_active and promo_bonus_percent is not null
    and (max_joiners is null or join_count < max_joiners)
    and (starts_at is null or starts_at <= now())
    and (ends_at   is null or ends_at   >= now())
  order by sort_order limit 1;

  if v_banner.id is not null then
    v_bonus := round(v_req.amount * v_banner.promo_bonus_percent / 100.0, 6);
    if v_banner.promo_bonus_cap is not null and v_bonus > v_banner.promo_bonus_cap then
      v_bonus := v_banner.promo_bonus_cap;
    end if;
    update promo_banners set join_count = join_count + 1 where id = v_banner.id;
  end if;

  if v_bonus <= 0 then
    v_bonus := round(v_req.amount * setting_num('deposit_bonus_percent', 0) / 100.0, 6);
    if v_bonus > setting_num('deposit_bonus_cap', 100) then
      v_bonus := setting_num('deposit_bonus_cap', 100);
    end if;
  end if;

  update deposit_requests
  set status = 'approved', credited_amount = v_req.amount, bonus_amount = v_bonus,
      reviewed_by = v_admin, reviewed_at = now()
  where id = p_request_id
  returning * into v_row;

  perform apply_balance(v_req.user_id, 'main', v_req.amount, 'deposit',
    v_req.id, 'deposit_requests',
    format('Deposit approved: %s %s on %s', v_req.amount, v_req.asset, v_req.network));

  if v_bonus > 0 then
    perform apply_balance(v_req.user_id, 'bonus', v_bonus, 'bonus',
      v_req.id, 'deposit_requests',
      format('Deposit bonus %s USDG', v_bonus));

    insert into bonus_history (user_id, kind, amount,
      turnover_required, reference_id, note)
    values (v_req.user_id, 'deposit', v_bonus,
      v_bonus * setting_num('bonus_turnover_multiplier', 5),
      v_req.id, 'Deposit bonus');

    perform notify_user(v_req.user_id, 'bonus_credited', 'Deposit bonus credited',
      format('You earned a %s USDG deposit bonus. Turnover requirement applies.',
             v_bonus), '/dashboard/wallet');
  end if;

  update wallets set total_deposited = total_deposited + v_req.amount
  where user_id = v_req.user_id;

  update deposit_addresses
  set total_received = total_received + v_req.amount
  where address = v_req.to_address and network = v_req.network;

  perform notify_user(v_req.user_id, 'deposit_approved', 'Deposit approved',
    format('Your deposit of %s USDG has been credited.', v_req.amount),
    '/dashboard/wallet');

  insert into admin_logs (admin_id, action, entity_type, entity_id, details)
  values (v_admin, 'approve_deposit', 'deposit_requests', v_req.id,
          jsonb_build_object('amount', v_req.amount, 'bonus', v_bonus));

  return v_row;
end;
$$;

-- ---------------------- REJECT DEPOSIT ---------------------
create or replace function public.reject_deposit(p_request_id uuid, p_reason text default null)
returns public.deposit_requests
language plpgsql volatile security definer set search_path = public as $$
declare
  v_admin uuid := auth.uid();
  v_req   deposit_requests;
  v_row   deposit_requests;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_req from deposit_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'REQUEST_ALREADY_REVIEWED' using errcode = 'P0001';
  end if;

  update deposit_requests set status = 'rejected', admin_note = p_reason,
                              reviewed_by = v_admin, reviewed_at = now()
  where id = p_request_id returning * into v_row;

  perform notify_user(v_req.user_id, 'deposit_rejected', 'Deposit rejected',
    coalesce(p_reason, 'Your deposit request was rejected. Contact support for details.'),
    '/dashboard/deposit');

  insert into admin_logs (admin_id, action, entity_type, entity_id, details)
  values (v_admin, 'reject_deposit', 'deposit_requests', v_req.id,
          jsonb_build_object('reason', p_reason));

  return v_row;
end;
$$;

-- --------------------- WITHDRAWAL FLOW ---------------------
-- User requests: validates min amount, KYC, bonus turnover lock and
-- available balance, then atomically locks funds.
create or replace function public.create_withdraw_request(
  p_amount      numeric,
  p_network     chain_network,
  p_asset       asset_symbol,
  p_to_address  text
) returns public.withdraw_requests
language plpgsql volatile security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_min  numeric := setting_num('min_withdrawal', 10);
  v_fee  numeric := setting_num('withdraw_fee', 0.5);
  v_net  numeric;
  v_w    wallets;
  v_row  withdraw_requests;
  v_pending numeric;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  if (select kyc_status from users where id = v_user) <> 'approved' then
    raise exception 'KYC_REQUIRED' using errcode = 'P0001';
  end if;

  v_pending := pending_turnover(v_user);
  if v_pending > 0 then
    raise exception 'BONUS_TURNOVER_PENDING: % USDG', v_pending using errcode = 'P0001';
  end if;

  if not exists (select 1 from deposit_addresses
                 where network = p_network and asset = p_asset and is_active) then
    raise exception 'WITHDRAW_NOT_ENABLED' using errcode = 'P0001';
  end if;

  if p_amount < v_min then
    raise exception 'BELOW_MIN_WITHDRAWAL' using errcode = 'P0001';
  end if;
  if nullif(trim(p_to_address), '') is null then
    raise exception 'ADDRESS_REQUIRED' using errcode = 'P0001';
  end if;

  v_net := p_amount - v_fee;
  if v_net <= 0 then
    raise exception 'BELOW_MIN_WITHDRAWAL' using errcode = 'P0001';
  end if;

  select * into v_w from wallets where user_id = v_user for update;
  if v_w.available < p_amount then
    raise exception 'INSUFFICIENT_FUNDS' using errcode = 'P0001';
  end if;

  -- Move the requested amount into the locked bucket; released or
  -- written off on review.
  update wallets set locked = locked + p_amount,
                     available = available - p_amount,
                     updated_at = now()
  where user_id = v_user;

  insert into withdraw_requests (user_id, amount, fee, net_amount, network, asset, to_address)
  values (v_user, p_amount, v_fee, v_net, p_network, p_asset, trim(p_to_address))
  returning * into v_row;

  insert into transactions (user_id, type, wallet, amount, balance_after,
                            reference_id, reference_table, description)
  values (v_user, 'withdrawal', 'main', -p_amount,
          (select available from wallets where user_id = v_user),
          v_row.id, 'withdraw_requests',
          format('Withdrawal locked: %s %s to %s', p_amount, p_asset, trim(p_to_address)));

  perform notify_user(v_user, 'announcement', 'Withdrawal submitted',
    format('Your %s %s withdrawal of %s USDG is under review.', p_asset, p_network, p_amount),
    '/dashboard/withdraw');

  return v_row;
end;
$$;

-- --------------------- REVIEW WITHDRAWAL -------------------
create or replace function public.review_withdrawal(
  p_request_id uuid, p_decision request_status, p_note text default null, p_tx_hash text default null
) returns public.withdraw_requests
language plpgsql volatile security definer set search_path = public as $$
declare
  v_admin uuid := auth.uid();
  v_req   withdraw_requests;
  v_w     wallets;
  v_row   withdraw_requests;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_req from withdraw_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'REQUEST_ALREADY_REVIEWED' using errcode = 'P0001';
  end if;

  if p_decision = 'approved' then
    update withdraw_requests set status = 'approved', admin_note = p_note, tx_hash = p_tx_hash,
                                 reviewed_by = v_admin, reviewed_at = now()
    where id = p_request_id returning * into v_row;

    -- Fee is revenue; locked remainder is written off the balance.
    update wallets set locked = locked - v_req.amount,
                       total_withdrawn = total_withdrawn + v_req.amount,
                       updated_at = now()
    where user_id = v_req.user_id;

    perform apply_balance(v_req.user_id, 'main', -v_req.fee, 'withdrawal',
      v_req.id, 'withdraw_requests', 'Withdrawal fee');

    perform notify_user(v_req.user_id, 'withdrawal_approved', 'Withdrawal approved',
      format('Your %s USDG withdrawal is on its way.', v_req.amount),
      '/dashboard/withdraw');

  else
    update withdraw_requests set status = 'rejected', admin_note = p_note,
                                 reviewed_by = v_admin, reviewed_at = now()
    where id = p_request_id returning * into v_row;

    -- Unlock funds back to available.
    update wallets set locked = locked - v_req.amount,
                       available = available + v_req.amount,
                       updated_at = now()
    where user_id = v_req.user_id;

    perform apply_balance(v_req.user_id, 'main', v_req.amount, 'withdrawal',
      v_req.id, 'withdraw_requests', 'Withdrawal rejected — funds unlocked');

    perform notify_user(v_req.user_id, 'withdrawal_rejected', 'Withdrawal rejected',
      coalesce(p_note, 'Your withdrawal request was rejected.'),
      '/dashboard/withdraw');
  end if;

  insert into admin_logs (admin_id, action, entity_type, entity_id, details)
  values (v_admin, format('withdrawal_%s', p_decision), 'withdraw_requests', v_req.id,
          jsonb_build_object('amount', v_req.amount, 'note', p_note, 'tx_hash', p_tx_hash));

  return v_row;
end;
$$;

-- ------------------------ ADMIN ADJUST ---------------------
-- Manual credit/debit of a user's main balance by an admin.
create or replace function public.admin_adjust_balance(
  p_user_id uuid, p_amount numeric, p_reason text
) returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  perform apply_balance(p_user_id, 'main', p_amount, 'admin_adjustment', null, null,
                        coalesce(p_reason, 'Admin adjustment'));

  insert into admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'admin_adjust', 'wallets', p_user_id,
          jsonb_build_object('amount', p_amount, 'reason', p_reason));
end;
$$;

-- ------------------------ BONUS ADMIN ----------------------
create or replace function public.grant_bonus(
  p_user_id uuid, p_kind text, p_amount numeric, p_note text default null
) returns void language plpgsql volatile security definer set search_path = public as $$
declare v_turnover numeric := p_amount * setting_num('bonus_turnover_multiplier', 5);
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  perform apply_balance(p_user_id, 'bonus', p_amount, 'bonus', null, null,
                        coalesce(p_note, 'Bonus credited'));

  insert into bonus_history (user_id, kind, amount, turnover_required, note)
  values (p_user_id, p_kind, p_amount, v_turnover, p_note);

  perform notify_user(p_user_id, 'bonus_credited', 'Bonus credited',
    format('A %s USDG bonus was added to your account.', p_amount), '/dashboard/wallet');

  insert into admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'grant_bonus', 'users', p_user_id,
          jsonb_build_object('kind', p_kind, 'amount', p_amount));
end;
$$;

-- ==========================================================
-- >>> 0007_functions_kyc_admin.sql
-- ==========================================================

-- ============================================================
-- NextGen Predict — 0007 KYC, User Moderation, Market Lifecycle
-- ============================================================

create or replace function public.review_kyc(
  p_request_id uuid, p_decision request_status, p_note text default null
) returns public.kyc_requests
language plpgsql volatile security definer set search_path = public as $$
declare
  v_admin uuid := auth.uid();
  v_req   kyc_requests;
  v_row   kyc_requests;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_req from kyc_requests where id = p_request_id for update;
  if not found then
    raise exception 'REQUEST_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_req.status <> 'pending' then
    raise exception 'REQUEST_ALREADY_REVIEWED' using errcode = 'P0001';
  end if;

  update kyc_requests set status = p_decision, admin_note = p_note,
                          reviewed_by = v_admin, reviewed_at = now()
  where id = p_request_id returning * into v_row;

  update users
  set kyc_status = case when p_decision = 'approved' then 'approved'::kyc_status
                        else 'rejected'::kyc_status end,
      full_name = case when p_decision = 'approved'
                       then coalesce(users.full_name, v_req.full_name)
                       else users.full_name end,
      country   = case when p_decision = 'approved'
                       then coalesce(users.country, v_req.country)
                       else users.country end
  where id = v_req.user_id;

  if p_decision = 'approved' then
    perform notify_user(v_req.user_id, 'kyc_approved', 'Identity verified',
      'Your KYC has been approved. Withdrawals are now unlocked.', '/dashboard/kyc');
  else
    perform notify_user(v_req.user_id, 'kyc_rejected', 'KYC rejected',
      coalesce(p_note, 'Your KYC submission was rejected. Please resubmit.'), '/dashboard/kyc');
  end if;

  insert into admin_logs (admin_id, action, entity_type, entity_id, details)
  values (v_admin, format('kyc_%s', p_decision), 'kyc_requests', v_req.id,
          jsonb_build_object('user_id', v_req.user_id, 'note', p_note));

  return v_row;
end;
$$;

-- Submits a KYC application. Storage paths are validated to belong to
-- the caller's own folder so a user cannot attach someone else's file.
create or replace function public.submit_kyc(
  p_doc_type kyc_doc_type,
  p_full_name text,
  p_date_of_birth date,
  p_country text,
  p_document_number text,
  p_front_path text,
  p_back_path text,
  p_selfie_path text
) returns public.kyc_requests
language plpgsql volatile security definer set search_path = public as $$
declare
  v_user uuid := auth.uid();
  v_row  kyc_requests;
  v_prefix text;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;
  if (select kyc_status from users where id = v_user) = 'approved' then
    raise exception 'KYC_ALREADY_APPROVED' using errcode = 'P0001';
  end if;
  if exists (select 1 from kyc_requests where user_id = v_user and status = 'pending') then
    raise exception 'KYC_ALREADY_PENDING' using errcode = 'P0001';
  end if;

  v_prefix := v_user::text || '/';
  if position(v_prefix in p_front_path) <> 1
     or position(v_prefix in p_selfie_path) <> 1
     or (p_back_path is not null and position(v_prefix in p_back_path) <> 1) then
    raise exception 'INVALID_FILE_PATH' using errcode = 'P0001';
  end if;

  insert into kyc_requests (user_id, doc_type, full_name, date_of_birth, country,
                            document_number, document_front_path, document_back_path, selfie_path)
  values (v_user, p_doc_type, p_full_name, p_date_of_birth, p_country,
          p_document_number, p_front_path, nullif(p_back_path, ''), p_selfie_path)
  returning * into v_row;

  update users set kyc_status = 'pending' where id = v_user;

  return v_row;
end;
$$;

-- ---------------------- USER MODERATION --------------------
create or replace function public.set_user_status(
  p_user_id uuid, p_status user_status, p_reason text default null,
  p_suspended_until timestamptz default null
) returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_MODERATE_SELF' using errcode = 'P0001';
  end if;

  update users set status = p_status,
                   ban_reason = case when p_status = 'active' then null else p_reason end,
                   suspended_until = case when p_status = 'suspended' then p_suspended_until else null end
  where id = p_user_id;

  perform notify_user(p_user_id, 'announcement',
    case p_status when 'banned' then 'Account banned'
                  when 'suspended' then 'Account suspended'
                  else 'Account reinstated' end,
    coalesce(p_reason, 'Your account status was updated by an administrator.'), '/dashboard');

  insert into admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), format('user_%s', p_status), 'users', p_user_id,
          jsonb_build_object('reason', p_reason, 'until', p_suspended_until));
end;
$$;

create or replace function public.set_user_role(p_user_id uuid, p_role user_role)
returns void language plpgsql volatile security definer set search_path = public as $$
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'CANNOT_CHANGE_OWN_ROLE' using errcode = 'P0001';
  end if;

  update users set role = p_role where id = p_user_id;

  insert into admin_logs (admin_id, action, entity_type, entity_id, details)
  values (auth.uid(), 'set_user_role', 'users', p_user_id, jsonb_build_object('role', p_role));
end;
$$;

-- --------------------- MARKET LIFECYCLE --------------------
-- Auto-closes markets past their end_time. Called by /api/cron/close-markets.
create or replace function public.auto_close_expired_markets()
returns integer language plpgsql volatile security definer set search_path = public as $$
declare v_n integer;
begin
  with closed as (
    update markets set status = 'closed'
    where status = 'open' and end_time <= now()
    returning 1
  )
  select count(*) into v_n from closed;
  return v_n;
end;
$$;

-- Broadcast announcement to every active user.
create or replace function public.broadcast_announcement(
  p_title text, p_body text, p_link text default null
) returns integer language plpgsql volatile security definer set search_path = public as $$
declare v_n integer;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  with ins as (
    insert into notifications (user_id, type, title, body, link)
    select id, 'announcement', p_title, p_body, p_link
    from users where status = 'active'
    returning 1
  )
  select count(*) into v_n from ins;

  insert into admin_logs (admin_id, action, details)
  values (auth.uid(), 'broadcast', jsonb_build_object('title', p_title, 'recipients', v_n));

  return v_n;
end;
$$;

-- Aggregate revenue view for the admin dashboard.
create or replace function public.revenue_summary(p_days integer default 30)
returns table (
  total_fees numeric, total_deposits numeric, total_withdrawals numeric,
  total_bonus numeric, total_payouts numeric, net_revenue numeric,
  active_users bigint, open_markets bigint
) language sql stable security definer set search_path = public as $$
  with window_tx as (
    select * from transactions where created_at >= now() - make_interval(days => p_days)
  )
  select
    coalesce((select sum(open_fee + cancel_fee) from trades
              where created_at >= now() - make_interval(days => p_days)), 0),
    coalesce((select sum(amount) from window_tx where type = 'deposit'), 0),
    coalesce((select -sum(amount) from window_tx where type = 'withdrawal' and amount < 0), 0),
    coalesce((select sum(amount) from window_tx where type = 'bonus'), 0),
    coalesce((select sum(amount) from window_tx where type = 'trade_payout'), 0),
    coalesce((select sum(open_fee + cancel_fee) from trades
              where created_at >= now() - make_interval(days => p_days)), 0)
      - coalesce((select sum(amount) from window_tx where type in ('bonus','referral_commission')), 0),
    (select count(*) from users where status = 'active'),
    (select count(*) from markets where status = 'open');
$$;

-- ==========================================================
-- >>> 0008_rls_policies.sql
-- ==========================================================

-- ============================================================
-- NextGen Predict — 0008 Row Level Security
--
-- Default posture: deny everything, then grant the narrowest
-- possible read/write. Users never write money columns directly —
-- all mutations go through the SECURITY DEFINER functions in 0004-0007.
-- ============================================================

alter table public.users             enable row level security;
alter table public.wallets           enable row level security;
alter table public.markets           enable row level security;
alter table public.market_options    enable row level security;
alter table public.trades            enable row level security;
alter table public.transactions      enable row level security;
alter table public.deposit_requests  enable row level security;
alter table public.withdraw_requests enable row level security;
alter table public.kyc_requests      enable row level security;
alter table public.notifications     enable row level security;
alter table public.bonus_history     enable row level security;
alter table public.referrals         enable row level security;
alter table public.admin_logs        enable row level security;
alter table public.site_settings     enable row level security;
alter table public.deposit_addresses enable row level security;
alter table public.promo_banners     enable row level security;
alter table public.partners          enable row level security;
alter table public.rate_limits       enable row level security;

-- ------------------------- USERS ---------------------------
drop policy if exists users_select_self on public.users;
create policy users_select_self on public.users
  for select using (id = auth.uid() or public.is_admin());

-- Profile fields only. Role/status/balances are protected by the
-- guard trigger below, which rejects privileged column changes.
drop policy if exists users_update_self on public.users;
create policy users_update_self on public.users
  for update using (id = auth.uid()) with check (id = auth.uid());

drop policy if exists users_admin_all on public.users;
create policy users_admin_all on public.users
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.guard_user_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;

  if new.role            is distinct from old.role
     or new.status       is distinct from old.status
     or new.kyc_status   is distinct from old.kyc_status
     or new.referral_code is distinct from old.referral_code
     or new.referred_by  is distinct from old.referred_by
     or new.total_trades is distinct from old.total_trades
     or new.trades_won   is distinct from old.trades_won
     or new.trades_lost  is distinct from old.trades_lost
     or new.total_volume is distinct from old.total_volume
     or new.total_pnl    is distinct from old.total_pnl
     or new.turnover     is distinct from old.turnover
     or new.email        is distinct from old.email then
    raise exception 'PROTECTED_COLUMN' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists users_guard_columns on public.users;
create trigger users_guard_columns
  before update on public.users
  for each row execute function public.guard_user_columns();

-- ------------------------ WALLETS --------------------------
-- Read-only to the owner. Writes happen exclusively via apply_balance().
drop policy if exists wallets_select_self on public.wallets;
create policy wallets_select_self on public.wallets
  for select using (user_id = auth.uid() or public.is_admin());

-- ------------------------ MARKETS --------------------------
drop policy if exists markets_select_public on public.markets;
create policy markets_select_public on public.markets
  for select using (status <> 'draft' or public.is_admin());

drop policy if exists markets_admin_write on public.markets;
create policy markets_admin_write on public.markets
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists market_options_select_public on public.market_options;
create policy market_options_select_public on public.market_options
  for select using (
    exists (select 1 from public.markets m
            where m.id = market_id and (m.status <> 'draft' or public.is_admin()))
  );

drop policy if exists market_options_admin_write on public.market_options;
create policy market_options_admin_write on public.market_options
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------- TRADES --------------------------
-- Inserts/updates are rejected: place_trade()/cancel_trade() only.
drop policy if exists trades_select_self on public.trades;
create policy trades_select_self on public.trades
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists trades_admin_write on public.trades;
create policy trades_admin_write on public.trades
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------- TRANSACTIONS -----------------------
drop policy if exists transactions_select_self on public.transactions;
create policy transactions_select_self on public.transactions
  for select using (user_id = auth.uid() or public.is_admin());

-- -------------------- DEPOSIT REQUESTS ---------------------
drop policy if exists deposits_select_self on public.deposit_requests;
create policy deposits_select_self on public.deposit_requests
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists deposits_admin_write on public.deposit_requests;
create policy deposits_admin_write on public.deposit_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------- WITHDRAW REQUESTS ---------------------
drop policy if exists withdrawals_select_self on public.withdraw_requests;
create policy withdrawals_select_self on public.withdraw_requests
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists withdrawals_admin_write on public.withdraw_requests;
create policy withdrawals_admin_write on public.withdraw_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------- KYC REQUESTS ----------------------
drop policy if exists kyc_select_self on public.kyc_requests;
create policy kyc_select_self on public.kyc_requests
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists kyc_admin_write on public.kyc_requests;
create policy kyc_admin_write on public.kyc_requests
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------- NOTIFICATIONS ----------------------
drop policy if exists notifications_select_self on public.notifications;
create policy notifications_select_self on public.notifications
  for select using (user_id = auth.uid() or user_id is null or public.is_admin());

-- Owner may only flip is_read; enforced by the guard trigger.
drop policy if exists notifications_update_self on public.notifications;
create policy notifications_update_self on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists notifications_admin_write on public.notifications;
create policy notifications_admin_write on public.notifications
  for all using (public.is_admin()) with check (public.is_admin());

create or replace function public.guard_notification_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if public.is_admin() then return new; end if;
  if new.type is distinct from old.type
     or new.title is distinct from old.title
     or new.body  is distinct from old.body
     or new.link  is distinct from old.link
     or new.user_id is distinct from old.user_id then
    raise exception 'PROTECTED_COLUMN' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists notifications_guard_columns on public.notifications;
create trigger notifications_guard_columns
  before update on public.notifications
  for each row execute function public.guard_notification_columns();

-- ---------------------- BONUS HISTORY ----------------------
drop policy if exists bonus_select_self on public.bonus_history;
create policy bonus_select_self on public.bonus_history
  for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists bonus_admin_write on public.bonus_history;
create policy bonus_admin_write on public.bonus_history
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------ REFERRALS ------------------------
drop policy if exists referrals_select_self on public.referrals;
create policy referrals_select_self on public.referrals
  for select using (referrer_id = auth.uid() or referred_id = auth.uid() or public.is_admin());

drop policy if exists referrals_admin_write on public.referrals;
create policy referrals_admin_write on public.referrals
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------ ADMIN LOGS -----------------------
drop policy if exists admin_logs_admin_only on public.admin_logs;
create policy admin_logs_admin_only on public.admin_logs
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------- SITE SETTINGS ----------------------
-- Public settings are readable by anyone (branding, socials, limits).
-- Keys prefixed with `private.` are admin-only.
drop policy if exists settings_select_public on public.site_settings;
create policy settings_select_public on public.site_settings
  for select using (key not like 'private.%' or public.is_admin());

drop policy if exists settings_admin_write on public.site_settings;
create policy settings_admin_write on public.site_settings
  for all using (public.is_admin()) with check (public.is_admin());

-- -------------------- DEPOSIT ADDRESSES --------------------
-- Users never list addresses directly; they receive one via
-- random_deposit_address(). Only admins can read the full set.
drop policy if exists deposit_addresses_admin on public.deposit_addresses;
create policy deposit_addresses_admin on public.deposit_addresses
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------- PROMO BANNERS ----------------------
drop policy if exists banners_select_active on public.promo_banners;
create policy banners_select_active on public.promo_banners
  for select using (
    public.is_admin() or (
      is_active
      and (max_joiners is null or join_count < max_joiners)
      and (starts_at is null or starts_at <= now())
      and (ends_at   is null or ends_at   >= now())
    )
  );

drop policy if exists banners_admin_write on public.promo_banners;
create policy banners_admin_write on public.promo_banners
  for all using (public.is_admin()) with check (public.is_admin());

-- ------------------------ PARTNERS -------------------------
drop policy if exists partners_select_active on public.partners;
create policy partners_select_active on public.partners
  for select using (is_active or public.is_admin());

drop policy if exists partners_admin_write on public.partners;
create policy partners_admin_write on public.partners
  for all using (public.is_admin()) with check (public.is_admin());

-- ----------------------- RATE LIMITS -----------------------
-- Service-role only; no policy grants access to anon/authenticated.

-- ------------------- FUNCTION GRANTS -----------------------
revoke all on function public.apply_balance(uuid, wallet_kind, numeric, tx_type, uuid, text, text, jsonb) from public, anon, authenticated;
revoke all on function public.pay_referral_commission(uuid, numeric, uuid) from public, anon, authenticated;
revoke all on function public.credit_turnover(uuid, numeric) from public, anon, authenticated;
revoke all on function public.check_rate_limit(text, integer, integer) from public, anon;
revoke all on function public.notify_user(uuid, notification_type, text, text, text, jsonb) from public, anon, authenticated;

grant execute on function public.place_trade(uuid, trade_side, numeric) to authenticated;
grant execute on function public.cancel_trade(uuid) to authenticated;
grant execute on function public.create_deposit_request(numeric, chain_network, asset_symbol, text, text, text) to authenticated;
grant execute on function public.create_withdraw_request(numeric, chain_network, asset_symbol, text) to authenticated;
grant execute on function public.submit_kyc(kyc_doc_type, text, date, text, text, text, text, text) to authenticated;
grant execute on function public.random_deposit_address(chain_network, asset_symbol) to authenticated;
grant execute on function public.pending_turnover(uuid) to authenticated;
grant execute on function public.setting_num(text, numeric) to authenticated, anon;
grant execute on function public.setting_bool(text, boolean) to authenticated, anon;
grant execute on function public.calc_trade_fee(numeric) to authenticated;
grant execute on function public.is_admin() to authenticated;

grant execute on function public.resolve_market(uuid, market_outcome, text) to authenticated;
grant execute on function public.approve_deposit(uuid) to authenticated;
grant execute on function public.reject_deposit(uuid, text) to authenticated;
grant execute on function public.review_withdrawal(uuid, request_status, text, text) to authenticated;
grant execute on function public.review_kyc(uuid, request_status, text) to authenticated;
grant execute on function public.set_user_status(uuid, user_status, text, timestamptz) to authenticated;
grant execute on function public.set_user_role(uuid, user_role) to authenticated;
grant execute on function public.admin_adjust_balance(uuid, numeric, text) to authenticated;
grant execute on function public.grant_bonus(uuid, text, numeric, text) to authenticated;
grant execute on function public.broadcast_announcement(text, text, text) to authenticated;
grant execute on function public.revenue_summary(integer) to authenticated;

-- ==========================================================
-- >>> 0009_storage_seed.sql
-- ==========================================================

-- ============================================================
-- NextGen Predict — 0009 Storage Buckets + Default Settings
-- ============================================================

-- ------------------------ BUCKETS --------------------------
-- kyc-documents: PRIVATE. Users write only into their own <uid>/ folder.
-- deposit-receipts: PRIVATE. Same ownership rule.
-- public-assets: PUBLIC. Market banners, partner logos, promo images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('kyc-documents', 'kyc-documents', false, 5242880,
   array['image/jpeg','image/png','image/webp','application/pdf']),
  ('deposit-receipts', 'deposit-receipts', false, 5242880,
   array['image/jpeg','image/png','image/webp','application/pdf']),
  ('public-assets', 'public-assets', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/svg+xml','image/gif'])
on conflict (id) do nothing;

-- Storage RLS policies live in 0010. They need table-owner rights on
-- storage.objects, which the SQL Editor role may not hold.

-- -------------------- DEFAULT SETTINGS ---------------------
insert into public.site_settings (key, value) values
  -- Branding
  ('site_name',            '"NextGen Predict"'),
  ('site_tagline',         '"Predict the game. Own the outcome."'),
  ('support_email',        '"support@nextgenpredict.com"'),
  -- Trading fees (the 0.3–1 USDG band, charged on open AND cancel)
  ('trade_fee_percent',    '0.5'),
  ('trade_fee_min',        '0.3'),
  ('trade_fee_max',        '1.0'),
  ('market_liquidity_anchor', '500'),
  -- Wallet limits
  ('min_deposit',          '10'),
  ('min_withdrawal',       '20'),
  ('withdraw_fee',         '0.5'),
  -- Bonuses
  ('welcome_bonus_amount', '5'),
  ('deposit_bonus_percent','10'),
  ('deposit_bonus_cap',    '100'),
  ('bonus_turnover_multiplier', '5'),
  -- Referrals
  ('referral_commission_percent', '10'),
  ('referral_min_deposit', '10'),
  ('referral_signup_bonus','2'),
  -- Socials (admin-editable from the panel)
  ('social_twitter',       '"https://twitter.com/nextgenpredict"'),
  ('social_telegram',      '"https://t.me/nextgenpredict"'),
  ('social_discord',       '"https://discord.gg/nextgenpredict"'),
  -- Feature flags
  ('deposits_enabled',     'true'),
  ('withdrawals_enabled',  'true'),
  ('trading_enabled',      'true'),
  ('maintenance_mode',     'false')
on conflict (key) do nothing;

-- ---------------- SAMPLE DEPOSIT ADDRESSES -----------------
-- Replace these with real custody addresses before going live.
-- The deposit page shows one at random per visit.
insert into public.deposit_addresses (network, asset, address, label) values
  ('robinhood', 'USDG', '0x7A1f4bC2e9D3a5F8c6B0E4d2A9f1C3b5D7e8F0a2', 'RH-USDG-01'),
  ('robinhood', 'USDG', '0x3E9d2A7f1C5b8D4e6F0a2B9c7D1e5F3a8C6b4D2e', 'RH-USDG-02'),
  ('robinhood', 'USDG', '0xB5c7D1e3F9a2C4b6D8e0F2a4C6b8D0e2F4a6C8b0', 'RH-USDG-03'),
  ('robinhood', 'USDG', '0xF2a4C6b8D0e2F4a6C8b0D2e4F6a8C0b2D4e6F8a0', 'RH-USDG-04'),
  ('robinhood', 'USDG', '0xD4e6F8a0C2b4D6e8F0a2C4b6D8e0F2a4C6b8D0e2', 'RH-USDG-05'),
  ('robinhood', 'ETH',  '0xA1b2C3d4E5f6A7b8C9d0E1f2A3b4C5d6E7f8A9b0', 'RH-ETH-01'),
  ('robinhood', 'ETH',  '0xC3d4E5f6A7b8C9d0E1f2A3b4C5d6E7f8A9b0C1d2', 'RH-ETH-02'),
  ('robinhood', 'ETH',  '0xE5f6A7b8C9d0E1f2A3b4C5d6E7f8A9b0C1d2E3f4', 'RH-ETH-03'),
  ('ethereum',  'USDC', '0x1F2a3B4c5D6e7F8a9B0c1D2e3F4a5B6c7D8e9F0a', 'ETH-USDC-01'),
  ('ethereum',  'USDC', '0x3B4c5D6e7F8a9B0c1D2e3F4a5B6c7D8e9F0a1B2c', 'ETH-USDC-02'),
  ('ethereum',  'USDC', '0x5D6e7F8a9B0c1D2e3F4a5B6c7D8e9F0a1B2c3D4e', 'ETH-USDC-03'),
  ('ethereum',  'USDT', '0x7F8a9B0c1D2e3F4a5B6c7D8e9F0a1B2c3D4e5F6a', 'ETH-USDT-01'),
  ('ethereum',  'USDT', '0x9B0c1D2e3F4a5B6c7D8e9F0a1B2c3D4e5F6a7B8c', 'ETH-USDT-02'),
  ('ethereum',  'ETH',  '0x0c1D2e3F4a5B6c7D8e9F0a1B2c3D4e5F6a7B8c9D', 'ETH-ETH-01'),
  ('ethereum',  'ETH',  '0x2e3F4a5B6c7D8e9F0a1B2c3D4e5F6a7B8c9D0e1F', 'ETH-ETH-02')
on conflict (address) do nothing;

-- ------------------- SAMPLE PROMO BANNERS ------------------
-- No unique key on title, so guard on emptiness to stay re-runnable.
insert into public.promo_banners
  (title, subtitle, cta_label, cta_link, promo_bonus_percent, promo_bonus_cap,
   max_joiners, sort_order)
select * from (values
  ('Launch Week: 100% Deposit Bonus',
   'Double your first deposit up to 250 USDG. Limited to the first 500 traders.',
   'Claim bonus', '/dashboard/deposit', 100, 250, 500, 1),
  ('Refer & Earn 10% Forever',
   'Earn commission on every trade your invitees make. No cap.',
   'Get your link', '/dashboard/referrals', null, null, null, 2)
) as v
where not exists (select 1 from public.promo_banners);

-- ---------------------- SAMPLE PARTNERS --------------------
insert into public.partners (name, website, sort_order)
select * from (values
  ('ChainGuard Custody', 'https://example.com', 1),
  ('Oracle Feeds',       'https://example.com', 2),
  ('SportsData IO',      'https://example.com', 3),
  ('Robinhood Chain',    'https://example.com', 4)
) as v
where not exists (select 1 from public.partners);

-- ==========================================================
-- >>> 0010_storage_policies.sql
-- ==========================================================

-- ============================================================
-- NextGen Predict — 0010 Storage Object Policies
-- Run this in Supabase Dashboard → Storage → Policies,
-- OR via SQL Editor while connected as a superuser role.
-- These require ownership of storage.objects (supabase_storage_admin).
-- ============================================================

drop policy if exists kyc_owner_insert on storage.objects;
create policy kyc_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists kyc_owner_select on storage.objects;
create policy kyc_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'kyc-documents'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

drop policy if exists kyc_owner_update on storage.objects;
create policy kyc_owner_update on storage.objects for update to authenticated
  using (bucket_id = 'kyc-documents' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists receipts_owner_insert on storage.objects;
create policy receipts_owner_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'deposit-receipts' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists receipts_owner_select on storage.objects;
create policy receipts_owner_select on storage.objects for select to authenticated
  using (bucket_id = 'deposit-receipts'
         and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

drop policy if exists public_assets_read on storage.objects;
create policy public_assets_read on storage.objects for select
  using (bucket_id = 'public-assets');

drop policy if exists public_assets_admin_write on storage.objects;
create policy public_assets_admin_write on storage.objects for all to authenticated
  using (bucket_id = 'public-assets' and public.is_admin())
  with check (bucket_id = 'public-assets' and public.is_admin());

-- ==========================================================
-- >>> 0011_fix_user_guard.sql
-- ==========================================================

-- Let trusted server-side roles change protected user columns.
--
-- guard_user_columns() only exempted is_admin(), which resolves through
-- auth.uid(). Connections that carry no end-user JWT — the service-role key
-- used by the app's bootstrap promotion, and the SQL Editor — therefore hit
-- the guard and could never grant the first admin, leaving /admin
-- unreachable. Both connections can already bypass RLS entirely, so this
-- exempts them explicitly. anon and authenticated are still blocked.

create or replace function public.guard_user_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or coalesce(
          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
          ''
        ) = 'service_role'
     or public.is_admin() then
    return new;
  end if;

  if new.role            is distinct from old.role
     or new.status       is distinct from old.status
     or new.kyc_status   is distinct from old.kyc_status
     or new.referral_code is distinct from old.referral_code
     or new.referred_by  is distinct from old.referred_by
     or new.total_trades is distinct from old.total_trades
     or new.trades_won   is distinct from old.trades_won
     or new.trades_lost  is distinct from old.trades_lost
     or new.total_volume is distinct from old.total_volume
     or new.total_pnl    is distinct from old.total_pnl
     or new.turnover     is distinct from old.turnover
     or new.email        is distinct from old.email then
    raise exception 'PROTECTED_COLUMN' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

-- ==========================================================
-- >>> 0012_multi_outcome_volume.sql
-- ==========================================================

-- ============================================================
-- NextGen Predict — 0012 N-way Outcomes + Volume Accounting
-- ============================================================
-- Two changes ship together because they touch the same functions.
--
-- 1. OUTCOMES. The engine was hard-coded binary: a trade_side enum of
--    ('yes','no'), markets.yes_price / yes_volume / no_volume, and a
--    unique(market_id, side) on market_options that capped every market
--    at two choices. A football match therefore had nowhere to put
--    "Draw". market_options is now the single source of truth: any
--    number of rows per market, each with its own label, price and
--    volume. trades.market_option_id is the position's identity and
--    markets.winning_option_id records how it settled.
--
-- 2. VOLUME. total_volume / trade_count were decremented on cancel, so
--    cancelling the only trade on a market reset the headline figure to
--    zero. They are lifetime traded volume now and never decrease.
--    Open interest — the number that actually drives pricing — lives in
--    market_options.volume and is decremented on cancel, which the old
--    code never did at all, so option prices drifted permanently.
-- ============================================================

-- ---------------- MARKET_OPTIONS: N PER MARKET --------------
-- The table shipped without `if not exists` originally, so a database
-- reset or a partially applied migration set can leave it absent. Create
-- it in its final post-0012 shape; the alters below then no-op.
create table if not exists public.market_options (
  id          uuid primary key default gen_random_uuid(),
  market_id   uuid not null references public.markets(id) on delete cascade,
  label       text not null,
  price       numeric(6,2) not null check (price > 0 and price < 100),
  volume      numeric(20,6) not null default 0,
  is_winner   boolean,
  is_active   boolean not null default true,
  sort_order  integer not null default 0,
  created_at  timestamptz not null default now()
);

-- Shed the binary-era shape *before* any row is written: `side` was
-- `not null` with no default, so the backfill below cannot insert while
-- the column still stands.
alter table public.market_options drop constraint if exists market_options_market_id_side_key;
alter table public.market_options drop column if exists side;

alter table public.market_options
  add column if not exists volume     numeric(20,6) not null default 0,
  add column if not exists is_winner  boolean,
  add column if not exists is_active  boolean not null default true,
  add column if not exists sort_order integer not null default 0;

-- Labels identify an option to the admin and inside notifications, so
-- they have to be distinct within a market.
create unique index if not exists market_options_label_uniq
  on public.market_options (market_id, lower(label));

create index if not exists market_options_market_id_idx
  on public.market_options (market_id);

create index if not exists market_options_sort_idx
  on public.market_options (market_id, sort_order);

-- The position's identity. Must exist before it can be backfilled.
alter table public.trades add column if not exists market_option_id uuid;

-- ------------------ BACKFILL EXISTING DATA ------------------
-- Every pre-0012 market was binary, so it gets exactly two options
-- carrying its current prices, volumes and winner. The legacy columns
-- may already be gone (re-run, or a database created after them), so
-- each source is substituted with a neutral default when absent.
do $$
declare
  v_has_price  boolean;
  v_has_volume boolean;
  v_has_out    boolean;
  v_price      text;
  v_yes_vol    text;
  v_no_vol     text;
  v_yes_win    text;
  v_no_win     text;
begin
  select count(*) filter (where column_name = 'yes_price')  > 0,
         count(*) filter (where column_name = 'yes_volume') > 0,
         count(*) filter (where column_name = 'outcome')    > 0
    into v_has_price, v_has_volume, v_has_out
  from information_schema.columns
  where table_schema = 'public' and table_name = 'markets';

  v_price   := case when v_has_price  then 'm.yes_price'  else '50' end;
  v_yes_vol := case when v_has_volume then 'm.yes_volume' else '0'  end;
  v_no_vol  := case when v_has_volume then 'm.no_volume'  else '0'  end;

  if v_has_out then
    v_yes_win := $q$case when m.outcome is null or m.outcome::text = 'invalid'
                         then null else m.outcome::text = 'yes' end$q$;
    v_no_win  := $q$case when m.outcome is null or m.outcome::text = 'invalid'
                         then null else m.outcome::text = 'no'  end$q$;
  else
    v_yes_win := 'null::boolean';
    v_no_win  := 'null::boolean';
  end if;

  execute format($q$
    insert into public.market_options
      (market_id, label, price, volume, is_winner, sort_order)
    select m.id, v.label, v.price, v.volume, v.is_winner, v.sort_order
    from public.markets m
    cross join lateral (values
      ('Yes', (%1$s)::numeric,       (%2$s)::numeric, %4$s, 0),
      ('No',  (100 - %1$s)::numeric, (%3$s)::numeric, %5$s, 1)
    ) as v(label, price, volume, is_winner, sort_order)
    where not exists (
      select 1 from public.market_options o where o.market_id = m.id
    )
  $q$, v_price, v_yes_vol, v_no_vol, v_yes_win, v_no_win);
end $$;

-- Point historical trades at the option matching the side they took.
-- Skipped when `side` is already gone, i.e. this is a re-run.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'trades' and column_name = 'side'
  ) then
    execute $q$
      update public.trades t
      set market_option_id = o.id
      from public.market_options o
      where o.market_id = t.market_id
        and lower(o.label) = t.side::text
        and t.market_option_id is null
    $q$;
  end if;
end $$;

-- A trade with no resolvable option would break settlement. There
-- should be none after the backfill; fail loudly rather than corrupt.
do $$
declare v_orphans integer;
begin
  select count(*) into v_orphans from public.trades where market_option_id is null;
  if v_orphans > 0 then
    raise exception
      'MIGRATION_ABORTED: % trade(s) have no market_option_id', v_orphans;
  end if;
end $$;

-- ------------- TRADES: OPTION IS THE IDENTITY ---------------
alter table public.trades drop constraint if exists trades_market_option_id_fkey;
alter table public.trades
  add constraint trades_market_option_id_fkey
  foreign key (market_option_id) references public.market_options(id) on delete restrict;

alter table public.trades alter column market_option_id set not null;
alter table public.trades drop column if exists side;

create index if not exists trades_option_idx on public.trades (market_option_id);

-- ------------- MARKETS: DROP THE BINARY COLUMNS -------------
alter table public.markets
  add column if not exists winning_option_id uuid references public.market_options(id) on delete set null;

update public.markets m
set winning_option_id = o.id
from public.market_options o
where o.market_id = m.id and o.is_winner is true and m.winning_option_id is null;

alter table public.markets drop column if exists yes_price;
alter table public.markets drop column if exists yes_volume;
alter table public.markets drop column if exists no_volume;
alter table public.markets drop column if exists outcome;

-- The enums the binary shape depended on are now unused.
-- resolve_market/place_trade are recreated below, so cascade is safe.
drop function if exists public.derive_yes_price cascade;
drop function if exists public.place_trade cascade;
drop function if exists public.cancel_trade cascade;
drop function if exists public.resolve_market cascade;
drop type if exists trade_side cascade;
drop type if exists market_outcome cascade;

-- ------------------------- PRICING --------------------------
-- Liquidity-anchored prices generalised to N options. Each option is
-- priced by its share of (volume + anchor), so an untraded market
-- opens at an even split and drifts as money arrives. Bounded to
-- 1..99 so no option is ever free or a certainty.
create or replace function public.reprice_market_options(p_market_id uuid)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_l     numeric := setting_num('market_liquidity_anchor', 500);
  v_count integer;
  v_total numeric;
begin
  select count(*), coalesce(sum(volume), 0) into v_count, v_total
  from market_options where market_id = p_market_id;

  if v_count = 0 then
    return;
  end if;

  update market_options set
    price = round(greatest(1, least(99, 100.0 * (volume + v_l) / (v_total + v_count * v_l))), 2)
  where market_id = p_market_id;
end;
$$;

-- ------------------------ PLACE TRADE ----------------------
-- Takes an option id instead of a side. Lifetime volume counters only
-- ever increase; open interest lives on the option row.
create or replace function public.place_trade(
  p_market_id uuid,
  p_option_id uuid,
  p_stake     numeric
) returns public.trades
language plpgsql volatile security definer set search_path = public as $$
declare
  v_user     uuid := auth.uid();
  v_u        users;
  v_m        markets;
  v_o        market_options;
  v_w        wallets;
  v_fee      numeric;
  v_shares   numeric;
  v_total    numeric;
  v_from_main  numeric;
  v_from_bonus numeric;
  v_fee_main   numeric;
  v_trade    trades;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_u from users where id = v_user;
  if v_u.status <> 'active' then
    raise exception 'ACCOUNT_%', upper(v_u.status::text) using errcode = 'P0001';
  end if;

  -- Serialise concurrent trades on the same market.
  select * into v_m from markets where id = p_market_id for update;
  if not found then
    raise exception 'MARKET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_m.status <> 'open' then
    raise exception 'MARKET_NOT_OPEN' using errcode = 'P0001';
  end if;
  if now() < v_m.start_time then
    raise exception 'MARKET_NOT_STARTED' using errcode = 'P0001';
  end if;
  if now() >= v_m.end_time then
    raise exception 'MARKET_CLOSED' using errcode = 'P0001';
  end if;
  if p_stake < v_m.min_trade then
    raise exception 'STAKE_BELOW_MIN' using errcode = 'P0001';
  end if;
  if p_stake > v_m.max_trade then
    raise exception 'STAKE_ABOVE_MAX' using errcode = 'P0001';
  end if;

  select * into v_o from market_options
  where id = p_option_id and market_id = p_market_id for update;
  if not found then
    raise exception 'OPTION_NOT_FOUND' using errcode = 'P0002';
  end if;
  if not v_o.is_active then
    raise exception 'OPTION_NOT_AVAILABLE' using errcode = 'P0001';
  end if;

  v_fee   := calc_trade_fee(p_stake);
  v_total := p_stake + v_fee;

  select * into v_w from wallets where user_id = v_user for update;
  if v_w.available + v_w.bonus < v_total then
    raise exception 'INSUFFICIENT_FUNDS' using errcode = 'P0001';
  end if;

  -- Spend real balance first, then bonus. The fee is always taken from
  -- whichever pool funds it, but tracked separately from the stake.
  v_from_main  := least(v_w.available, v_total);
  v_from_bonus := v_total - v_from_main;

  -- Attribute the fee to main where possible so stake splits stay clean.
  v_fee_main := least(v_fee, v_from_main);
  v_from_main  := v_from_main  - v_fee_main;
  v_from_bonus := v_from_bonus - (v_fee - v_fee_main);

  v_shares := round(p_stake / (v_o.price / 100.0), 6);

  insert into trades (user_id, market_id, market_option_id, stake,
                      stake_from_main, stake_from_bonus, price, shares,
                      potential_payout, open_fee)
  values (v_user, p_market_id, v_o.id, p_stake,
          v_from_main, v_from_bonus, v_o.price, v_shares, v_shares, v_fee)
  returning * into v_trade;

  if v_from_main + v_fee_main > 0 then
    perform apply_balance(v_user, 'main', -(v_from_main + v_fee_main), 'trade_open',
      v_trade.id, 'trades', format('%s — %s @ %sc', v_m.title, v_o.label, v_o.price));
  end if;
  if v_from_bonus + (v_fee - v_fee_main) > 0 then
    perform apply_balance(v_user, 'bonus', -(v_from_bonus + (v_fee - v_fee_main)), 'trade_open',
      v_trade.id, 'trades', format('%s — %s @ %sc (bonus)', v_m.title, v_o.label, v_o.price));
  end if;

  -- Open interest: drives pricing, reversed on cancel.
  update market_options set volume = volume + p_stake where id = v_o.id;

  -- Lifetime traded volume: never reversed.
  update markets set
    total_volume = total_volume + p_stake,
    trade_count  = trade_count + 1
  where id = p_market_id;

  perform reprice_market_options(p_market_id);

  update users set total_trades = total_trades + 1,
                   total_volume = total_volume + p_stake
  where id = v_user;

  perform credit_turnover(v_user, p_stake);

  -- Referral commission on the trade fee.
  perform pay_referral_commission(v_user, v_fee, v_trade.id);

  return v_trade;
end;
$$;

-- ------------------------ CANCEL TRADE ---------------------
-- Users may cancel while the market is still open. A cancel fee in the
-- same 0.3–1 band applies. Turnover credit is reversed so open/cancel
-- cycles cannot be used to clear a bonus for free — but lifetime
-- volume and trade counts are not, because the trade did happen.
create or replace function public.cancel_trade(p_trade_id uuid)
returns public.trades
language plpgsql volatile security definer set search_path = public as $$
declare
  v_user   uuid := auth.uid();
  v_t      trades;
  v_m      markets;
  v_label  text;
  v_fee    numeric;
  v_refund_main  numeric;
  v_refund_bonus numeric;
begin
  if v_user is null then
    raise exception 'NOT_AUTHENTICATED' using errcode = 'P0001';
  end if;

  select * into v_t from trades where id = p_trade_id for update;
  if not found then
    raise exception 'TRADE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_t.user_id <> v_user and not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;
  if v_t.status <> 'open' then
    raise exception 'TRADE_NOT_OPEN' using errcode = 'P0001';
  end if;

  select * into v_m from markets where id = v_t.market_id for update;
  if v_m.status <> 'open' then
    raise exception 'MARKET_NOT_CANCELLABLE' using errcode = 'P0001';
  end if;

  select label into v_label from market_options where id = v_t.market_option_id;

  v_fee := calc_trade_fee(v_t.stake);

  -- Refund each source exactly; the cancel fee is deducted from the
  -- main-wallet refund, falling back to the bonus portion if needed.
  v_refund_main  := v_t.stake_from_main;
  v_refund_bonus := v_t.stake_from_bonus;

  if v_refund_main >= v_fee then
    v_refund_main := v_refund_main - v_fee;
  else
    v_refund_bonus := greatest(0, v_refund_bonus - (v_fee - v_refund_main));
    v_refund_main  := 0;
  end if;

  update trades set status = 'cancelled', cancel_fee = v_fee,
                    cancelled_at = now(), pnl = -(open_fee + v_fee)
  where id = p_trade_id
  returning * into v_t;

  if v_refund_main > 0 then
    perform apply_balance(v_user, 'main', v_refund_main, 'trade_cancel',
      v_t.id, 'trades', format('Cancelled %s — refund', v_m.title));
  end if;
  if v_refund_bonus > 0 then
    perform apply_balance(v_user, 'bonus', v_refund_bonus, 'trade_cancel',
      v_t.id, 'trades', format('Cancelled %s — bonus refund', v_m.title));
  end if;

  -- Release the open interest so the quoted price returns to where it
  -- was before this stake landed. markets.total_volume and trade_count
  -- stay put: they are lifetime figures, not open positions.
  update market_options
  set volume = greatest(0, volume - v_t.stake)
  where id = v_t.market_option_id;

  perform reprice_market_options(v_t.market_id);

  update users set turnover = greatest(0, turnover - v_t.stake)
  where id = v_user;

  update bonus_history
  set turnover_progress = greatest(0, turnover_progress - v_t.stake),
      is_cleared = (greatest(0, turnover_progress - v_t.stake) >= turnover_required)
  where user_id = v_user and not is_cleared;

  perform notify_user(v_user, 'prediction_refunded', 'Trade cancelled',
    format('Your %s position on "%s" was cancelled. Fee: %s USDG.',
           coalesce(v_label, 'open'), v_m.title, v_fee), '/dashboard/positions');

  return v_t;
end;
$$;

-- ----------------------- RESOLVE MARKET --------------------
-- Admin-only. Settles every open position in one transaction.
-- A null p_winning_option_id voids the market and refunds all stakes
-- to their original wallets.
create or replace function public.resolve_market(
  p_market_id uuid,
  p_winning_option_id uuid default null,
  p_note      text default null
) returns integer
language plpgsql volatile security definer set search_path = public as $$
declare
  v_admin uuid := auth.uid();
  v_m     markets;
  v_t     trades;
  v_label text;
  v_count integer := 0;
  v_void  boolean := p_winning_option_id is null;
  v_payout numeric;
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_m from markets where id = p_market_id for update;
  if not found then
    raise exception 'MARKET_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_m.status in ('resolved', 'cancelled') then
    raise exception 'MARKET_ALREADY_SETTLED' using errcode = 'P0001';
  end if;

  if not v_void then
    select label into v_label from market_options
    where id = p_winning_option_id and market_id = p_market_id;
    if v_label is null then
      raise exception 'OPTION_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;

  for v_t in
    select * from trades where market_id = p_market_id and status = 'open' for update
  loop
    if v_void then
      if v_t.stake_from_main > 0 then
        perform apply_balance(v_t.user_id, 'main', v_t.stake_from_main, 'trade_refund',
          v_t.id, 'trades', format('Market voided — refund: %s', v_m.title));
      end if;
      if v_t.stake_from_bonus > 0 then
        perform apply_balance(v_t.user_id, 'bonus', v_t.stake_from_bonus, 'trade_refund',
          v_t.id, 'trades', format('Market voided — bonus refund: %s', v_m.title));
      end if;

      update trades set status = 'refunded', payout = v_t.stake,
                        pnl = -v_t.open_fee, settled_at = now()
      where id = v_t.id;

      perform notify_user(v_t.user_id, 'prediction_refunded', 'Market voided',
        format('"%s" was voided. Your %s USDG stake has been refunded.',
               v_m.title, v_t.stake), '/dashboard/positions');

    elsif v_t.market_option_id = p_winning_option_id then
      v_payout := v_t.potential_payout;

      perform apply_balance(v_t.user_id, 'main', v_payout, 'trade_payout',
        v_t.id, 'trades', format('Won %s — %s', v_m.title, v_label));

      update trades set status = 'won', payout = v_payout,
                        pnl = v_payout - v_t.stake - v_t.open_fee, settled_at = now()
      where id = v_t.id;

      update users set trades_won = trades_won + 1,
                       total_pnl = total_pnl + (v_payout - v_t.stake - v_t.open_fee)
      where id = v_t.user_id;

      perform notify_user(v_t.user_id, 'prediction_won', 'Prediction won',
        format('You won %s USDG on "%s".', round(v_payout, 2), v_m.title),
        '/dashboard/positions');

    else
      update trades set status = 'lost', payout = 0,
                        pnl = -(v_t.stake + v_t.open_fee), settled_at = now()
      where id = v_t.id;

      update users set trades_lost = trades_lost + 1,
                       total_pnl = total_pnl - (v_t.stake + v_t.open_fee)
      where id = v_t.user_id;

      perform notify_user(v_t.user_id, 'prediction_lost', 'Prediction settled',
        format('"%s" settled as %s. Your position did not win.',
               v_m.title, v_label), '/dashboard/positions');
    end if;

    v_count := v_count + 1;
  end loop;

  update market_options
  set is_winner = case when v_void then null else id = p_winning_option_id end
  where market_id = p_market_id;

  update markets set
    status = case when v_void then 'cancelled' else 'resolved' end,
    winning_option_id = p_winning_option_id,
    resolved_at = now(), resolved_by = v_admin,
    resolution_note = p_note
  where id = p_market_id;

  insert into admin_logs (admin_id, action, entity_type, entity_id, details)
  values (v_admin, 'resolve_market', 'markets', p_market_id,
          jsonb_build_object('winning_option_id', p_winning_option_id,
                             'outcome', coalesce(v_label, 'void'),
                             'settled', v_count, 'note', p_note));

  return v_count;
end;
$$;

-- ------------------- ADMIN: SAVE A MARKET -------------------
-- Market row and its options move together. Doing this client-side
-- would let a market exist with no outcomes if the second call failed,
-- and an open market with nothing to trade is worse than no market.
--
-- p_options is a jsonb array of {label, price}. Once a market has
-- trades its options are frozen — repricing or relabelling underneath
-- an open position would silently rewrite what someone bought.
create or replace function public.admin_save_market(
  p_market  jsonb,
  p_options jsonb,
  p_id      uuid default null
) returns public.markets
language plpgsql volatile security definer set search_path = public as $$
declare
  v_admin  uuid := auth.uid();
  v_m      markets;
  v_status market_status;
  v_count  integer;
  v_trades integer;
  v_opt    jsonb;
  v_i      integer := 0;
  v_labels text[] := '{}';
begin
  if not is_admin() then
    raise exception 'FORBIDDEN' using errcode = 'P0001';
  end if;

  v_count := jsonb_array_length(coalesce(p_options, '[]'::jsonb));
  if v_count < 2 then
    raise exception 'TOO_FEW_OPTIONS' using errcode = 'P0001';
  end if;
  if v_count > 12 then
    raise exception 'TOO_MANY_OPTIONS' using errcode = 'P0001';
  end if;

  v_status := (p_market ->> 'status')::market_status;

  if p_id is null then
    -- Insert as draft first: the open-market guard needs the options to
    -- exist, and they cannot until the row has an id.
    insert into markets (
      slug, title, question, description, sport, league,
      team_a, team_b, team_a_logo, team_b_logo, banner_url,
      min_trade, max_trade, start_time, end_time,
      status, is_trending, is_featured, created_by
    ) values (
      p_market ->> 'slug',
      p_market ->> 'title',
      p_market ->> 'question',
      p_market ->> 'description',
      (p_market ->> 'sport')::sport_type,
      p_market ->> 'league',
      p_market ->> 'team_a',
      p_market ->> 'team_b',
      p_market ->> 'team_a_logo',
      p_market ->> 'team_b_logo',
      p_market ->> 'banner_url',
      (p_market ->> 'min_trade')::numeric,
      (p_market ->> 'max_trade')::numeric,
      (p_market ->> 'start_time')::timestamptz,
      (p_market ->> 'end_time')::timestamptz,
      'draft',
      (p_market ->> 'is_trending')::boolean,
      (p_market ->> 'is_featured')::boolean,
      v_admin
    ) returning * into v_m;
  else
    select * into v_m from markets where id = p_id for update;
    if not found then
      raise exception 'MARKET_NOT_FOUND' using errcode = 'P0002';
    end if;
    if v_m.status in ('resolved', 'cancelled') then
      raise exception 'MARKET_ALREADY_SETTLED' using errcode = 'P0001';
    end if;

    update markets set
      title       = p_market ->> 'title',
      question    = p_market ->> 'question',
      description = p_market ->> 'description',
      sport       = (p_market ->> 'sport')::sport_type,
      league      = p_market ->> 'league',
      team_a      = p_market ->> 'team_a',
      team_b      = p_market ->> 'team_b',
      team_a_logo = p_market ->> 'team_a_logo',
      team_b_logo = p_market ->> 'team_b_logo',
      banner_url  = p_market ->> 'banner_url',
      min_trade   = (p_market ->> 'min_trade')::numeric,
      max_trade   = (p_market ->> 'max_trade')::numeric,
      start_time  = (p_market ->> 'start_time')::timestamptz,
      end_time    = (p_market ->> 'end_time')::timestamptz,
      is_trending = (p_market ->> 'is_trending')::boolean,
      is_featured = (p_market ->> 'is_featured')::boolean
    where id = p_id
    returning * into v_m;
  end if;

  select count(*) into v_trades from trades where market_id = v_m.id;

  if v_trades = 0 then
    for v_opt in select * from jsonb_array_elements(p_options) loop
      insert into market_options (market_id, label, price, sort_order)
      values (v_m.id, v_opt ->> 'label', (v_opt ->> 'price')::numeric, v_i)
      on conflict (market_id, lower(label)) do update
        set price = excluded.price, sort_order = excluded.sort_order,
            is_active = true;

      v_labels := v_labels || lower(v_opt ->> 'label');
      v_i := v_i + 1;
    end loop;

    delete from market_options
    where market_id = v_m.id and lower(label) <> all (v_labels);
  else
    -- Options are frozen, so reject a mismatch instead of ignoring it.
    -- Silently dropping the edit would show the admin a success toast
    -- for a change that never landed.
    select count(*) into v_count from market_options where market_id = v_m.id;
    if v_count <> jsonb_array_length(p_options)
       or exists (
         select 1 from jsonb_array_elements(p_options) o
         where not exists (
           select 1 from market_options mo
           where mo.market_id = v_m.id and lower(mo.label) = lower(o.value ->> 'label')
         )
       ) then
      raise exception 'MARKET_HAS_TRADES' using errcode = 'P0001';
    end if;
  end if;

  if v_status <> v_m.status then
    update markets set status = v_status where id = v_m.id returning * into v_m;
  end if;

  insert into admin_logs (admin_id, action, entity_type, entity_id, details)
  values (v_admin, case when p_id is null then 'create_market' else 'update_market' end,
          'markets', v_m.id, jsonb_build_object('options', p_options, 'status', v_status));

  return v_m;
end;
$$;

-- ------------------------- GUARDS ---------------------------
-- A market that members can trade must have something to trade on.
-- OLD is unassigned on INSERT, so the two cases stay in separate
-- branches rather than one boolean expression.
create or replace function public.guard_market_open()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_check boolean := false;
begin
  if new.status = 'open' then
    if tg_op = 'INSERT' then
      v_check := true;
    elsif old.status <> 'open' then
      v_check := true;
    end if;
  end if;

  if v_check and (select count(*) from market_options
                  where market_id = new.id and is_active) < 2 then
    raise exception 'TOO_FEW_OPTIONS' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists markets_guard_open on public.markets;
create trigger markets_guard_open
  before insert or update of status on public.markets
  for each row execute function public.guard_market_open();

-- Relabelling or repricing an option under an open position would
-- rewrite the terms someone already bought.
create or replace function public.guard_option_frozen()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if exists (select 1 from trades where market_option_id = old.id) then
      raise exception 'MARKET_HAS_TRADES' using errcode = 'P0001';
    end if;
    return old;
  end if;

  -- volume/price move on every trade; only the identity is frozen.
  if new.label = old.label and new.market_id = old.market_id then
    return new;
  end if;

  if exists (select 1 from trades where market_option_id = old.id) then
    raise exception 'MARKET_HAS_TRADES' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists market_options_guard_frozen on public.market_options;
create trigger market_options_guard_frozen
  before update or delete on public.market_options
  for each row execute function public.guard_option_frozen();

-- --------------------------- RLS ----------------------------
-- Options are written through admin_save_market()/resolve_market()
-- only, so the blanket admin write policy is no longer needed.
drop policy if exists market_options_admin_write on public.market_options;

-- Re-asserted because this migration may have created the table itself,
-- in which case 0008 never got the chance to secure it. Without the
-- read policy every market would render with no outcomes at all.
alter table public.market_options enable row level security;

drop policy if exists market_options_select_public on public.market_options;
create policy market_options_select_public on public.market_options
  for select using (
    exists (select 1 from public.markets m
            where m.id = market_id and (m.status <> 'draft' or public.is_admin()))
  );

grant execute on function public.reprice_market_options(uuid) to authenticated;
grant execute on function public.admin_save_market(jsonb, jsonb, uuid) to authenticated;

-- ==========================================================
-- >>> 0013_signup_resilience.sql
-- ==========================================================

-- ============================================================
-- NextGen Predict — 0013 Signup resilience
-- ============================================================
-- handle_new_user() ran every provisioning step in the same transaction as
-- the auth.users INSERT. Any failure there — a referral race, the welcome
-- bonus, the notification insert — rolled the signup back and Supabase
-- answered "Database error saving new user", which the UI could only report
-- as a generic authentication failure.
--
-- The profile row and the wallet are the only things an account genuinely
-- cannot work without. Everything else is now best-effort: a failure is
-- logged as a warning and the account is still created.
-- ============================================================

-- Provisions (or repairs) the profile + wallet for an existing auth user.
-- Idempotent, so it doubles as the self-heal path for accounts whose
-- original trigger run failed.
create or replace function public.ensure_user_profile(
  p_user_id uuid,
  p_email   text,
  p_full_name text default null,
  p_avatar_url text default null,
  p_referral_code text default null
) returns void language plpgsql volatile security definer set search_path = public as $$
declare
  v_referrer   uuid;
  v_ref_code   text := nullif(trim(p_referral_code), '');
  v_welcome    numeric := setting_num('welcome_bonus_amount', 0);
  v_turnover_x numeric := setting_num('bonus_turnover_multiplier', 5);
  v_is_new     integer := 0;
begin
  if v_ref_code is not null then
    select id into v_referrer from users where referral_code = upper(v_ref_code);
  end if;

  insert into users (id, email, full_name, avatar_url, referral_code, referred_by)
  values (
    p_user_id,
    p_email,
    nullif(trim(coalesce(p_full_name, '')), ''),
    p_avatar_url,
    gen_referral_code(),
    v_referrer
  )
  on conflict (id) do nothing;

  get diagnostics v_is_new = row_count;

  insert into wallets (user_id) values (p_user_id) on conflict (user_id) do nothing;

  -- Only a first-time provisioning earns the referral link and the bonus;
  -- a repair run must not hand out a second welcome credit.
  if v_is_new = 0 then return; end if;

  if v_referrer is not null then
    begin
      insert into referrals (referrer_id, referred_id, code_used)
      values (v_referrer, p_user_id, upper(v_ref_code))
      on conflict (referred_id) do nothing;
    exception when others then
      raise warning 'ensure_user_profile: referral link failed for %: %', p_user_id, sqlerrm;
    end;
  end if;

  if v_welcome > 0 then
    begin
      perform apply_balance(p_user_id, 'bonus', v_welcome, 'bonus', null, null, 'Welcome bonus');
      insert into bonus_history (user_id, kind, amount, turnover_required)
      values (p_user_id, 'welcome', v_welcome, v_welcome * v_turnover_x);
      perform notify_user(p_user_id, 'bonus_credited', 'Welcome bonus credited',
        format('You received a %s USDG welcome bonus. Wager %sx to unlock withdrawals.',
               v_welcome, v_turnover_x), '/dashboard/wallet');
    exception when others then
      raise warning 'ensure_user_profile: welcome bonus failed for %: %', p_user_id, sqlerrm;
    end;
  end if;
end;
$$;

grant execute on function public.ensure_user_profile(uuid, text, text, text, text)
  to authenticated, service_role;

-- The trigger is now a thin wrapper. It never aborts the signup: if
-- provisioning fails outright the account still exists and the app repairs
-- the profile on first sign-in.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  begin
    perform public.ensure_user_profile(
      new.id,
      new.email,
      coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'referral_code'
    );
  exception when others then
    raise warning 'handle_new_user: provisioning failed for %: %', new.id, sqlerrm;
  end;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
