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
