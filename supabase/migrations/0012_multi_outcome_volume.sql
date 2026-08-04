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
