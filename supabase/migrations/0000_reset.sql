-- ============================================================
-- NextGen Predict — 0000 RESET (optional, DESTRUCTIVE)
-- ============================================================
-- Run this ONLY to wipe a half-migrated database and start clean.
-- It DELETES ALL APPLICATION DATA in the tables listed below.
--
-- Do NOT run this on a database that has real users or trades.
-- It does not touch auth.users, so existing accounts survive — but
-- their profile/wallet rows are removed, so delete them from
-- Authentication → Users afterwards if you want a truly clean slate.
--
-- After this completes, run 0001 through 0012 in order.
-- ============================================================

-- Trigger on auth.users must go first; it depends on handle_new_user().
drop trigger if exists on_auth_user_created on auth.users;

-- ------------------------- TABLES --------------------------
-- CASCADE clears dependent FKs, indexes, policies and triggers.
drop table if exists public.admin_logs        cascade;
drop table if exists public.rate_limits       cascade;
drop table if exists public.partners          cascade;
drop table if exists public.promo_banners     cascade;
drop table if exists public.deposit_addresses cascade;
drop table if exists public.site_settings     cascade;
drop table if exists public.referrals         cascade;
drop table if exists public.bonus_history     cascade;
drop table if exists public.notifications     cascade;
drop table if exists public.kyc_requests      cascade;
drop table if exists public.withdraw_requests cascade;
drop table if exists public.deposit_requests  cascade;
drop table if exists public.transactions      cascade;
drop table if exists public.trades            cascade;
drop table if exists public.market_options    cascade;
drop table if exists public.markets           cascade;
drop table if exists public.wallets           cascade;
drop table if exists public.users             cascade;

-- ------------------------ FUNCTIONS ------------------------
-- Names are unique in this schema, so the arg-less form is safe.
drop function if exists public.admin_adjust_balance      cascade;
drop function if exists public.admin_save_market         cascade;
drop function if exists public.apply_balance             cascade;
drop function if exists public.approve_deposit           cascade;
drop function if exists public.auto_close_expired_markets cascade;
drop function if exists public.broadcast_announcement    cascade;
drop function if exists public.calc_trade_fee            cascade;
drop function if exists public.cancel_trade              cascade;
drop function if exists public.check_rate_limit          cascade;
drop function if exists public.create_deposit_request    cascade;
drop function if exists public.create_withdraw_request   cascade;
drop function if exists public.credit_turnover           cascade;
drop function if exists public.derive_yes_price          cascade;
drop function if exists public.gen_referral_code         cascade;
drop function if exists public.grant_bonus               cascade;
drop function if exists public.guard_market_open         cascade;
drop function if exists public.guard_notification_columns cascade;
drop function if exists public.guard_option_frozen       cascade;
drop function if exists public.guard_user_columns        cascade;
drop function if exists public.handle_new_user           cascade;
drop function if exists public.is_admin                  cascade;
drop function if exists public.notify_user               cascade;
drop function if exists public.pay_referral_commission   cascade;
drop function if exists public.pending_turnover          cascade;
drop function if exists public.place_trade               cascade;
drop function if exists public.random_deposit_address    cascade;
drop function if exists public.reject_deposit            cascade;
drop function if exists public.reprice_market_options    cascade;
drop function if exists public.resolve_market            cascade;
drop function if exists public.revenue_summary           cascade;
drop function if exists public.review_kyc                cascade;
drop function if exists public.review_withdrawal         cascade;
drop function if exists public.set_user_role             cascade;
drop function if exists public.set_user_status           cascade;
drop function if exists public.setting_bool              cascade;
drop function if exists public.setting_num               cascade;
drop function if exists public.submit_kyc                cascade;
drop function if exists public.touch_updated_at          cascade;

-- ------------------------- ENUMS ---------------------------
drop type if exists notification_type cascade;
drop type if exists tx_type           cascade;
drop type if exists wallet_kind       cascade;
drop type if exists asset_symbol      cascade;
drop type if exists chain_network     cascade;
drop type if exists request_status    cascade;
drop type if exists trade_status      cascade;
drop type if exists trade_side        cascade;
drop type if exists market_outcome    cascade;
drop type if exists market_status     cascade;
drop type if exists sport_type        cascade;
drop type if exists kyc_doc_type      cascade;
drop type if exists kyc_status        cascade;
drop type if exists user_status       cascade;
drop type if exists user_role         cascade;

-- ------------------- STORAGE POLICIES ----------------------
-- Harmless if they were never created, or if you lack ownership.
drop policy if exists kyc_owner_insert          on storage.objects;
drop policy if exists kyc_owner_select          on storage.objects;
drop policy if exists kyc_owner_update          on storage.objects;
drop policy if exists receipts_owner_insert     on storage.objects;
drop policy if exists receipts_owner_select     on storage.objects;
drop policy if exists public_assets_read        on storage.objects;
drop policy if exists public_assets_admin_write on storage.objects;
