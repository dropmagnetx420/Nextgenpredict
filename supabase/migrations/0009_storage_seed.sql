-- ============================================================
-- NextGen Predict — 0009 Storage Buckets + Default Settings
-- ============================================================

-- ------------------------ BUCKETS --------------------------
-- kyc-documents: PRIVATE. Users write only into their own <uid>/ folder.
-- deposit-receipts: PRIVATE. Same ownership rule.
-- public-assets: PUBLIC. Market banners, partner logos, promo images.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('kyc-documents', 'kyc-documents', false, 5242880,
   array['image/jpeg','image/png','image/webp','application/pdf']),
  ('deposit-receipts', 'deposit-receipts', false, 5242880,
   array['image/jpeg','image/png','image/webp','application/pdf']),
  ('public-assets', 'public-assets', true, 5242880,
   array['image/jpeg','image/png','image/webp','image/svg+xml','image/gif'])
on conflict (id) do nothing;

-- Storage RLS policies live in 0010. They need table-owner rights on
-- storage.objects, which the SQL Editor role may not hold.

-- -------------------- DEFAULT SETTINGS ---------------------
insert into public.site_settings (key, value) values
  -- Branding
  ('site_name',            '"NextGen Predict"'),
  ('site_tagline',         '"Predict the game. Own the outcome."'),
  ('support_email',        '"support@nextgenpredict.com"'),
  -- Trading fees (the 0.3–1 USDG band, charged on open AND cancel)
  ('trade_fee_percent',    '0.5'),
  ('trade_fee_min',        '0.3'),
  ('trade_fee_max',        '1.0'),
  ('market_liquidity_anchor', '500'),
  -- Wallet limits
  ('min_deposit',          '10'),
  ('min_withdrawal',       '20'),
  ('withdraw_fee',         '0.5'),
  -- Bonuses
  ('welcome_bonus_amount', '5'),
  ('deposit_bonus_percent','10'),
  ('deposit_bonus_cap',    '100'),
  ('bonus_turnover_multiplier', '5'),
  -- Referrals
  ('referral_commission_percent', '10'),
  ('referral_min_deposit', '10'),
  ('referral_signup_bonus','2'),
  -- Socials (admin-editable from the panel)
  ('social_twitter',       '"https://twitter.com/nextgenpredict"'),
  ('social_telegram',      '"https://t.me/nextgenpredict"'),
  ('social_discord',       '"https://discord.gg/nextgenpredict"'),
  -- Feature flags
  ('deposits_enabled',     'true'),
  ('withdrawals_enabled',  'true'),
  ('trading_enabled',      'true'),
  ('maintenance_mode',     'false')
on conflict (key) do nothing;

-- ---------------- SAMPLE DEPOSIT ADDRESSES -----------------
-- Replace these with real custody addresses before going live.
-- The deposit page shows one at random per visit.
insert into public.deposit_addresses (network, asset, address, label) values
  ('robinhood', 'USDG', '0x7A1f4bC2e9D3a5F8c6B0E4d2A9f1C3b5D7e8F0a2', 'RH-USDG-01'),
  ('robinhood', 'USDG', '0x3E9d2A7f1C5b8D4e6F0a2B9c7D1e5F3a8C6b4D2e', 'RH-USDG-02'),
  ('robinhood', 'USDG', '0xB5c7D1e3F9a2C4b6D8e0F2a4C6b8D0e2F4a6C8b0', 'RH-USDG-03'),
  ('robinhood', 'USDG', '0xF2a4C6b8D0e2F4a6C8b0D2e4F6a8C0b2D4e6F8a0', 'RH-USDG-04'),
  ('robinhood', 'USDG', '0xD4e6F8a0C2b4D6e8F0a2C4b6D8e0F2a4C6b8D0e2', 'RH-USDG-05'),
  ('robinhood', 'ETH',  '0xA1b2C3d4E5f6A7b8C9d0E1f2A3b4C5d6E7f8A9b0', 'RH-ETH-01'),
  ('robinhood', 'ETH',  '0xC3d4E5f6A7b8C9d0E1f2A3b4C5d6E7f8A9b0C1d2', 'RH-ETH-02'),
  ('robinhood', 'ETH',  '0xE5f6A7b8C9d0E1f2A3b4C5d6E7f8A9b0C1d2E3f4', 'RH-ETH-03'),
  ('ethereum',  'USDC', '0x1F2a3B4c5D6e7F8a9B0c1D2e3F4a5B6c7D8e9F0a', 'ETH-USDC-01'),
  ('ethereum',  'USDC', '0x3B4c5D6e7F8a9B0c1D2e3F4a5B6c7D8e9F0a1B2c', 'ETH-USDC-02'),
  ('ethereum',  'USDC', '0x5D6e7F8a9B0c1D2e3F4a5B6c7D8e9F0a1B2c3D4e', 'ETH-USDC-03'),
  ('ethereum',  'USDT', '0x7F8a9B0c1D2e3F4a5B6c7D8e9F0a1B2c3D4e5F6a', 'ETH-USDT-01'),
  ('ethereum',  'USDT', '0x9B0c1D2e3F4a5B6c7D8e9F0a1B2c3D4e5F6a7B8c', 'ETH-USDT-02'),
  ('ethereum',  'ETH',  '0x0c1D2e3F4a5B6c7D8e9F0a1B2c3D4e5F6a7B8c9D', 'ETH-ETH-01'),
  ('ethereum',  'ETH',  '0x2e3F4a5B6c7D8e9F0a1B2c3D4e5F6a7B8c9D0e1F', 'ETH-ETH-02')
on conflict (address) do nothing;

-- ------------------- SAMPLE PROMO BANNERS ------------------
-- No unique key on title, so guard on emptiness to stay re-runnable.
insert into public.promo_banners
  (title, subtitle, cta_label, cta_link, promo_bonus_percent, promo_bonus_cap,
   max_joiners, sort_order)
select * from (values
  ('Launch Week: 100% Deposit Bonus',
   'Double your first deposit up to 250 USDG. Limited to the first 500 traders.',
   'Claim bonus', '/dashboard/deposit', 100, 250, 500, 1),
  ('Refer & Earn 10% Forever',
   'Earn commission on every trade your invitees make. No cap.',
   'Get your link', '/dashboard/referrals', null, null, null, 2)
) as v
where not exists (select 1 from public.promo_banners);

-- ---------------------- SAMPLE PARTNERS --------------------
insert into public.partners (name, website, sort_order)
select * from (values
  ('ChainGuard Custody', 'https://example.com', 1),
  ('Oracle Feeds',       'https://example.com', 2),
  ('SportsData IO',      'https://example.com', 3),
  ('Robinhood Chain',    'https://example.com', 4)
) as v
where not exists (select 1 from public.partners);
