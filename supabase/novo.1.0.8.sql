alter table if exists public.freelancer_profiles
  drop column if exists has_cnpj;

update public.payment_checkout_sessions
set
  amount_monthly = 8.9,
  updated_at = timezone('utc', now())
where plan_tier = 'booster'
  and status in ('open', 'pending')
  and amount_monthly = 6.99;
