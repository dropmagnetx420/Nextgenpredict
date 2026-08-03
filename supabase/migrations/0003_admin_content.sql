-- ============================================================
-- NextGen Predict — 0003 Admin, Settings, Content Tables
-- ============================================================

-- ----------------------- SITE SETTINGS ---------------------
-- Single-row-per-key settings consumed by server components.
create table public.site_settings (
  key        text primary key,
  value      jsonb not null,
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

-- --------------------- DEPOSIT ADDRESSES -------------------
-- Admin seeds 10–15 wallet addresses per network+asset. Each user's
-- deposit page shows a random one (rotate_deposit_address()).
create table public.deposit_addresses (
  id          uuid primary key default gen_random_uuid(),
  network     chain_network not null,
  asset       asset_symbol not null,
  address     text not null unique,
  label       text,
  is_active   boolean not null default true,
  total_received numeric(20,6) not null default 0,
  created_at  timestamptz not null default now()
);

create index deposit_addresses_active_idx
  on public.deposit_addresses (network, asset) where is_active;

-- ---------------------- PROMO BANNERS ----------------------
-- Multiple simultaneously. `limit_reached` is managed automatically
-- when a promo bonus offer is attached (joining-user cap).
create table public.promo_banners (
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
create table public.partners (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  logo_url   text,
  website    text,
  is_active  boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

-- ----------------------- ADMIN LOGS ------------------------
create table public.admin_logs (
  id          uuid primary key default gen_random_uuid(),
  admin_id    uuid references public.users(id) on delete set null,
  action      text not null,
  entity_type text,
  entity_id   uuid,
  details     jsonb not null default '{}'::jsonb,
  ip          text,
  created_at  timestamptz not null default now()
);

create index admin_logs_admin_idx  on public.admin_logs (admin_id, created_at desc);
create index admin_logs_action_idx on public.admin_logs (action);

-- ----------------------- RATE LIMITS -----------------------
-- Lightweight sliding-window limiter for auth & trade endpoints.
create table public.rate_limits (
  key        text primary key,
  count      integer not null default 0,
  reset_at   timestamptz not null default now()
);
