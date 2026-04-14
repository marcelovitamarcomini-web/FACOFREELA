create table if not exists public.payment_checkout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles (id) on delete set null,
  provider text not null default 'mock',
  status text not null default 'open',
  customer_name text not null,
  customer_email text not null,
  plan_tier text not null,
  amount_monthly numeric not null,
  currency text not null default 'BRL',
  payload jsonb,
  expires_at timestamptz not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint payment_checkout_sessions_provider_check check (provider in ('mock')),
  constraint payment_checkout_sessions_status_check check (
    status in ('open', 'approved', 'pending', 'failed', 'expired')
  )
);

create index if not exists payment_checkout_sessions_user_id_idx
  on public.payment_checkout_sessions (user_id);

create index if not exists payment_checkout_sessions_status_idx
  on public.payment_checkout_sessions (status);

create index if not exists payment_checkout_sessions_expires_at_idx
  on public.payment_checkout_sessions (expires_at);

alter table public.payment_checkout_sessions enable row level security;
