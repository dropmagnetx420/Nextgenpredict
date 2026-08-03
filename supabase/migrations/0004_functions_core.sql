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
