-- ============================================================
-- NextGen Predict — 0002 Trades, Money Movement, User Activity
-- ============================================================

-- ------------------------- TRADES --------------------------
-- A prediction position. `stake` is split across main/bonus wallet
-- so cancellations refund each source exactly.
create table public.trades (
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

create index trades_user_id_idx       on public.trades (user_id, created_at desc);
create index trades_market_id_idx     on public.trades (market_id);
create index trades_status_idx        on public.trades (status);
create index trades_open_by_market_idx on public.trades (market_id, status) where status = 'open';

-- ----------------------- TRANSACTIONS ----------------------
-- Immutable ledger. Every balance change writes exactly one row.
create table public.transactions (
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

create index transactions_user_id_idx   on public.transactions (user_id, created_at desc);
create index transactions_type_idx      on public.transactions (type);
create index transactions_reference_idx on public.transactions (reference_id);
create index transactions_created_idx   on public.transactions (created_at desc);

-- --------------------- DEPOSIT REQUESTS --------------------
create table public.deposit_requests (
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

create index deposit_requests_user_idx   on public.deposit_requests (user_id, created_at desc);
create index deposit_requests_status_idx on public.deposit_requests (status, created_at desc);

-- -------------------- WITHDRAW REQUESTS --------------------
create table public.withdraw_requests (
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

create index withdraw_requests_user_idx   on public.withdraw_requests (user_id, created_at desc);
create index withdraw_requests_status_idx on public.withdraw_requests (status, created_at desc);

-- ------------------------ KYC REQUESTS ---------------------
create table public.kyc_requests (
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

create index kyc_requests_user_idx   on public.kyc_requests (user_id, created_at desc);
create index kyc_requests_status_idx on public.kyc_requests (status, created_at desc);
-- Only one in-flight KYC application per user.
create unique index kyc_one_pending_per_user
  on public.kyc_requests (user_id) where status = 'pending';

-- ----------------------- NOTIFICATIONS ---------------------
create table public.notifications (
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

create index notifications_user_idx    on public.notifications (user_id, created_at desc);
create index notifications_unread_idx  on public.notifications (user_id, is_read) where not is_read;
create index notifications_broadcast_idx on public.notifications (created_at desc) where user_id is null;

-- ----------------------- BONUS HISTORY ---------------------
create table public.bonus_history (
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

create index bonus_history_user_idx   on public.bonus_history (user_id, created_at desc);
create index bonus_history_active_idx on public.bonus_history (user_id) where not is_cleared;

-- ------------------------ REFERRALS ------------------------
create table public.referrals (
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

create index referrals_referrer_idx on public.referrals (referrer_id, created_at desc);
