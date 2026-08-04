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
