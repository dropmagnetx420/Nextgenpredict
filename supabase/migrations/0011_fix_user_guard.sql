-- Let trusted server-side roles change protected user columns.
--
-- guard_user_columns() only exempted is_admin(), which resolves through
-- auth.uid(). Connections that carry no end-user JWT — the service-role key
-- used by the app's bootstrap promotion, and the SQL Editor — therefore hit
-- the guard and could never grant the first admin, leaving /admin
-- unreachable. Both connections can already bypass RLS entirely, so this
-- exempts them explicitly. anon and authenticated are still blocked.

create or replace function public.guard_user_columns()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if current_user in ('postgres', 'supabase_admin', 'service_role')
     or coalesce(
          nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
          ''
        ) = 'service_role'
     or public.is_admin() then
    return new;
  end if;

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
