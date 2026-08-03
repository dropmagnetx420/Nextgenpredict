-- ============================================================
-- NextGen Predict — 0001 Extensions, Enums, Core Tables
-- ============================================================

create extension if not exists "pgcrypto";
create extension if not exists "citext";

-- ------------------------- ENUMS ---------------------------
create type user_role       as enum ('user', 'admin');
create type user_status     as enum ('active', 'suspended', 'banned');
create type kyc_status      as enum ('none', 'pending', 'approved', 'rejected');
create type kyc_doc_type    as enum ('national_id', 'passport', 'driving_license');
create type sport_type      as enum ('football', 'cricket', 'basketball', 'tennis', 'esports');
create type market_status   as enum ('draft', 'open', 'closed', 'resolved', 'cancelled');
create type market_outcome  as enum ('yes', 'no', 'invalid');
create type trade_side      as enum ('yes', 'no');
create type trade_status    as enum ('open', 'cancelled', 'won', 'lost', 'refunded');
create type request_status  as enum ('pending', 'approved', 'rejected');
create type chain_network   as enum ('robinhood', 'ethereum');
create type asset_symbol    as enum ('ETH', 'USDG', 'USDC', 'USDT');
create type wallet_kind     as enum ('main', 'bonus');
create type tx_type as enum (
  'deposit', 'withdrawal', 'trade_open', 'trade_cancel', 'trade_payout',
  'trade_refund', 'fee', 'bonus', 'referral_commission', 'admin_adjustment'
);
create type notification_type as enum (
  'deposit_approved', 'deposit_rejected', 'withdrawal_approved', 'withdrawal_rejected',
  'prediction_won', 'prediction_lost', 'prediction_refunded', 'kyc_approved',
  'kyc_rejected', 'bonus_credited', 'referral_earning', 'announcement'
);

-- ------------------------- USERS ---------------------------
-- Mirrors auth.users. Populated by a trigger on signup.
create table public.users (
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

create index users_referral_code_idx on public.users (referral_code);
create index users_referred_by_idx   on public.users (referred_by);
create index users_role_idx          on public.users (role) where role = 'admin';
create index users_created_at_idx    on public.users (created_at desc);

-- ------------------------ WALLETS --------------------------
-- One row per user. Balances are in USD-equivalent units.
create table public.wallets (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.users(id) on delete cascade,
  available       numeric(20,6) not null default 0 check (available >= 0),
  bonus           numeric(20,6) not null default 0 check (bonus >= 0),
  locked          numeric(20,6) not null default 0 check (locked >= 0),
  total_deposited numeric(20,6) not null default 0,
  total_withdrawn numeric(20,6) not null default 0,
  updated_at      timestamptz not null default now()
);

create index wallets_user_id_idx on public.wallets (user_id);

-- ------------------------ MARKETS --------------------------
create table public.markets (
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

create index markets_status_idx     on public.markets (status);
create index markets_sport_idx      on public.markets (sport);
create index markets_end_time_idx   on public.markets (end_time);
create index markets_trending_idx   on public.markets (is_trending) where is_trending;
create index markets_featured_idx   on public.markets (is_featured) where is_featured;
create index markets_open_list_idx  on public.markets (status, end_time desc) where status = 'open';

-- Optional richer outcome set (multi-option markets / future proofing)
create table public.market_options (
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

create index market_options_market_id_idx on public.market_options (market_id);
