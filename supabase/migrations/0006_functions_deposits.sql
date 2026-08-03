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
