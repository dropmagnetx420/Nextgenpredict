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
