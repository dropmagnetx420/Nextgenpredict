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
