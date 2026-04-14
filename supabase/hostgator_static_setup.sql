-- Safe to rerun. This script bootstraps the core tables used by the app
-- and then applies the extra setup required for the static HostGator deploy.

create extension if not exists pgcrypto;

create or replace function public.normalize_profile_email(value text)
returns text
language sql
immutable
as $$
  select nullif(lower(trim(coalesce(value, ''))), '');
$$;

create or replace function public.normalize_profile_phone(value text)
returns text
language sql
immutable
as $$
  select nullif(regexp_replace(coalesce(value, ''), '\D', '', 'g'), '');
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text not null,
  phone text,
  phone_normalized text,
  user_type text,
  avatar_url text,
  bio text,
  city text,
  state text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint profiles_user_type_check check (
    user_type is null or user_type in ('client', 'freelancer', 'admin')
  )
);

create table if not exists public.client_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  cep text,
  company_name text,
  document_number text,
  contact_name text,
  company_description text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.freelancer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  cep text,
  city text,
  state text,
  professional_title text,
  skills text[] not null default '{}'::text[],
  experience_level text,
  portfolio_url text,
  banner_url text,
  hourly_rate numeric,
  availability_status text not null default 'available',
  rating_average numeric not null default 0,
  total_reviews integer not null default 0,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint freelancer_profiles_experience_level_check check (
    experience_level is null or experience_level in ('junior', 'pleno', 'senior', 'especialista')
  ),
  constraint freelancer_profiles_availability_status_check check (
    availability_status in ('available', 'busy', 'unavailable')
  )
);

alter table public.profiles
  add column if not exists full_name text,
  add column if not exists email text,
  add column if not exists phone text,
  add column if not exists phone_normalized text,
  add column if not exists user_type text,
  add column if not exists avatar_url text,
  add column if not exists bio text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.client_profiles
  add column if not exists id uuid default gen_random_uuid(),
  add column if not exists user_id uuid,
  add column if not exists cep text,
  add column if not exists company_name text,
  add column if not exists document_number text,
  add column if not exists contact_name text,
  add column if not exists company_description text,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now());

alter table public.freelancer_profiles
  add column if not exists cep text,
  add column if not exists city text,
  add column if not exists state text,
  add column if not exists professional_title text,
  add column if not exists skills text[] not null default '{}'::text[],
  add column if not exists experience_level text,
  add column if not exists portfolio_url text,
  add column if not exists banner_url text,
  add column if not exists hourly_rate numeric,
  add column if not exists availability_status text not null default 'available',
  add column if not exists rating_average numeric not null default 0,
  add column if not exists total_reviews integer not null default 0,
  add column if not exists created_at timestamptz not null default timezone('utc', now()),
  add column if not exists updated_at timestamptz not null default timezone('utc', now()),
  add column if not exists category text,
  add column if not exists summary text,
  add column if not exists description text,
  add column if not exists years_experience integer,
  add column if not exists linkedin_url text,
  add column if not exists website_url text,
  add column if not exists whatsapp text,
  add column if not exists subscription_tier text not null default 'normal',
  add column if not exists subscription_status text not null default 'active',
  add column if not exists subscription_started_at timestamptz not null default timezone('utc', now()),
  add column if not exists subscription_ends_at timestamptz not null default (timezone('utc', now()) + interval '30 days'),
  add column if not exists profile_views bigint not null default 0;

alter table public.freelancer_profiles
  drop column if exists has_cnpj;

create unique index if not exists profiles_email_key on public.profiles (email);
create unique index if not exists profiles_phone_normalized_key
  on public.profiles (phone_normalized)
  where phone_normalized is not null;
create unique index if not exists client_profiles_user_id_key on public.client_profiles (user_id);
create unique index if not exists freelancer_profiles_user_id_key on public.freelancer_profiles (user_id);

create index if not exists profiles_user_type_idx on public.profiles (user_type);

create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  client_user_id uuid not null references public.profiles (id) on delete cascade,
  freelancer_user_id uuid not null references public.profiles (id) on delete cascade,
  subject text not null,
  status text not null default 'Novo',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint contacts_unique_pair unique (client_user_id, freelancer_user_id)
);

create table if not exists public.contact_messages (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  sender_user_id uuid not null references public.profiles (id) on delete cascade,
  sender_role text not null,
  body text not null,
  created_at timestamptz not null default timezone('utc', now()),
  constraint contact_messages_sender_role_check check (sender_role in ('client', 'freelancer'))
);

create index if not exists contacts_client_user_id_idx on public.contacts (client_user_id);
create index if not exists contacts_freelancer_user_id_idx on public.contacts (freelancer_user_id);
create index if not exists contacts_updated_at_idx on public.contacts (updated_at desc);
create index if not exists contact_messages_contact_id_idx on public.contact_messages (contact_id);
create index if not exists contact_messages_created_at_idx on public.contact_messages (created_at);

create table if not exists public.app_sessions (
  token text primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null,
  expires_at timestamptz not null,
  supabase_access_token text,
  supabase_refresh_token text,
  supabase_access_token_expires_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint app_sessions_role_check check (role in ('client', 'freelancer'))
);

create index if not exists app_sessions_user_id_idx on public.app_sessions (user_id);
create index if not exists app_sessions_expires_at_idx on public.app_sessions (expires_at);

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
create index if not exists payment_checkout_sessions_user_created_at_idx
  on public.payment_checkout_sessions (user_id, created_at desc);

create table if not exists public.contact_reads (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_message_id uuid references public.contact_messages (id) on delete set null,
  last_read_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint contact_reads_unique_pair unique (contact_id, user_id)
);

create index if not exists contact_reads_user_id_idx on public.contact_reads (user_id);
create index if not exists contact_reads_contact_id_idx on public.contact_reads (contact_id);

create or replace function public.sync_profile_contact_fields()
returns trigger
language plpgsql
as $$
begin
  new.email := public.normalize_profile_email(new.email);
  new.phone := nullif(trim(coalesce(new.phone, '')), '');
  new.phone_normalized := public.normalize_profile_phone(new.phone);
  return new;
end;
$$;

drop trigger if exists profiles_sync_contact_fields on public.profiles;

create trigger profiles_sync_contact_fields
before insert or update of email, phone
on public.profiles
for each row
execute function public.sync_profile_contact_fields();

insert into public.profiles (
  id,
  full_name,
  email,
  phone,
  phone_normalized,
  user_type,
  avatar_url,
  bio,
  city,
  state
)
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    u.email
  ),
  public.normalize_profile_email(u.email),
  nullif(trim(coalesce(u.raw_user_meta_data ->> 'phone', '')), ''),
  public.normalize_profile_phone(coalesce(u.phone, u.raw_user_meta_data ->> 'phone')),
  case
    when lower(coalesce(u.raw_user_meta_data ->> 'user_type', u.raw_user_meta_data ->> 'role', '')) in ('client', 'freelancer')
      then lower(coalesce(u.raw_user_meta_data ->> 'user_type', u.raw_user_meta_data ->> 'role', ''))
    else null
  end,
  nullif(u.raw_user_meta_data ->> 'avatar_url', ''),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'bio', ''),
    nullif(u.raw_user_meta_data ->> 'summary', '')
  ),
  nullif(u.raw_user_meta_data ->> 'city', ''),
  nullif(u.raw_user_meta_data ->> 'state', '')
from auth.users u
where not exists (
  select 1
  from public.profiles p
  where p.id = u.id
);

update public.profiles p
set
  full_name = coalesce(
    nullif(p.full_name, ''),
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    p.email
  ),
  email = coalesce(public.normalize_profile_email(p.email), public.normalize_profile_email(u.email)),
  phone = coalesce(nullif(trim(coalesce(p.phone, '')), ''), nullif(trim(coalesce(u.raw_user_meta_data ->> 'phone', '')), '')),
  phone_normalized = coalesce(
    public.normalize_profile_phone(p.phone),
    public.normalize_profile_phone(coalesce(u.phone, u.raw_user_meta_data ->> 'phone'))
  ),
  city = coalesce(nullif(p.city, ''), nullif(u.raw_user_meta_data ->> 'city', '')),
  state = coalesce(nullif(p.state, ''), nullif(u.raw_user_meta_data ->> 'state', '')),
  bio = coalesce(
    nullif(p.bio, ''),
    nullif(u.raw_user_meta_data ->> 'bio', ''),
    nullif(u.raw_user_meta_data ->> 'summary', '')
  ),
  avatar_url = coalesce(
    nullif(p.avatar_url, ''),
    nullif(u.raw_user_meta_data ->> 'avatar_url', '')
  ),
  user_type = case
    when p.user_type in ('client', 'freelancer') then p.user_type
    when lower(coalesce(u.raw_user_meta_data ->> 'user_type', u.raw_user_meta_data ->> 'role', '')) in ('client', 'freelancer')
      then lower(coalesce(u.raw_user_meta_data ->> 'user_type', u.raw_user_meta_data ->> 'role', ''))
    else p.user_type
  end
from auth.users u
where p.id = u.id;

insert into public.client_profiles (user_id, contact_name, cep)
select
  p.id,
  coalesce(nullif(p.full_name, ''), p.email),
  nullif(regexp_replace(coalesce(u.raw_user_meta_data ->> 'cep', ''), '\D', '', 'g'), '')
from public.profiles p
left join auth.users u on u.id = p.id
where p.user_type = 'client'
on conflict (user_id) do nothing;

update public.client_profiles cp
set cep = coalesce(
  nullif(cp.cep, ''),
  nullif(regexp_replace(coalesce(u.raw_user_meta_data ->> 'cep', ''), '\D', '', 'g'), '')
)
from auth.users u
where cp.user_id = u.id;

insert into public.freelancer_profiles (
  user_id,
  professional_title,
  skills,
  experience_level,
  portfolio_url,
  banner_url,
  availability_status,
  rating_average,
  total_reviews,
  category,
  summary,
  description,
  years_experience,
  linkedin_url,
  website_url,
  whatsapp,
  subscription_tier,
  subscription_status,
  profile_views
)
select
  p.id,
  nullif(u.raw_user_meta_data ->> 'profession', ''),
  case
    when nullif(u.raw_user_meta_data ->> 'profession', '') is not null
      then array_remove(array[
        nullif(u.raw_user_meta_data ->> 'profession', ''),
        nullif(u.raw_user_meta_data ->> 'category', ''),
        'Atendimento direto'
      ], null)
    else array['Atendimento direto']
  end,
  case lower(coalesce(u.raw_user_meta_data ->> 'experience_level', ''))
    when 'junior' then 'junior'
    when 'pleno' then 'pleno'
    when 'senior' then 'senior'
    when 'especialista' then 'especialista'
    else 'pleno'
  end,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'portfolio_url', ''),
    nullif(u.raw_user_meta_data ->> 'website_url', ''),
    'https://www.linkedin.com/'
  ),
  nullif(u.raw_user_meta_data ->> 'banner_url', ''),
  'available',
  0,
  0,
  nullif(u.raw_user_meta_data ->> 'category', ''),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'summary', ''),
    nullif(u.raw_user_meta_data ->> 'bio', ''),
    'Perfil profissional em configuracao.'
  ),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'description', ''),
    nullif(u.raw_user_meta_data ->> 'summary', ''),
    nullif(u.raw_user_meta_data ->> 'bio', ''),
    'Perfil profissional em configuracao.'
  ),
  case
    when coalesce(u.raw_user_meta_data ->> 'years_experience', '') ~ '^\d+$'
      then (u.raw_user_meta_data ->> 'years_experience')::integer
    else 5
  end,
  nullif(u.raw_user_meta_data ->> 'linkedin_url', ''),
  coalesce(
    nullif(u.raw_user_meta_data ->> 'website_url', ''),
    nullif(u.raw_user_meta_data ->> 'portfolio_url', '')
  ),
  regexp_replace(coalesce(u.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g'),
  case lower(coalesce(u.raw_user_meta_data ->> 'subscription_tier', u.raw_user_meta_data ->> 'subscriptionTier', ''))
    when 'booster' then 'booster'
    else 'normal'
  end,
  'active',
  0
from public.profiles p
left join auth.users u on u.id = p.id
where p.user_type = 'freelancer'
on conflict (user_id) do nothing;

update public.freelancer_profiles fp
set
  professional_title = coalesce(
    nullif(fp.professional_title, ''),
    nullif(u.raw_user_meta_data ->> 'profession', '')
  ),
  category = coalesce(nullif(fp.category, ''), nullif(u.raw_user_meta_data ->> 'category', '')),
  summary = coalesce(
    nullif(fp.summary, ''),
    nullif(u.raw_user_meta_data ->> 'summary', ''),
    nullif(u.raw_user_meta_data ->> 'bio', '')
  ),
  description = coalesce(
    nullif(fp.description, ''),
    nullif(u.raw_user_meta_data ->> 'description', ''),
    nullif(u.raw_user_meta_data ->> 'summary', ''),
    nullif(u.raw_user_meta_data ->> 'bio', '')
  ),
  years_experience = coalesce(
    fp.years_experience,
    case
      when coalesce(u.raw_user_meta_data ->> 'years_experience', '') ~ '^\d+$'
        then (u.raw_user_meta_data ->> 'years_experience')::integer
      else null
    end,
    5
  ),
  linkedin_url = coalesce(nullif(fp.linkedin_url, ''), nullif(u.raw_user_meta_data ->> 'linkedin_url', '')),
  website_url = coalesce(
    nullif(fp.website_url, ''),
    nullif(u.raw_user_meta_data ->> 'website_url', ''),
    nullif(u.raw_user_meta_data ->> 'portfolio_url', '')
  ),
  whatsapp = coalesce(
    nullif(fp.whatsapp, ''),
    regexp_replace(coalesce(u.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g')
  ),
  subscription_tier = coalesce(
    nullif(fp.subscription_tier, ''),
    case lower(coalesce(u.raw_user_meta_data ->> 'subscription_tier', u.raw_user_meta_data ->> 'subscriptionTier', ''))
      when 'booster' then 'booster'
      else 'normal'
    end
  ),
  subscription_status = coalesce(nullif(fp.subscription_status, ''), 'active'),
  profile_views = coalesce(fp.profile_views, 0)
from auth.users u
where fp.user_id = u.id;

alter table public.profiles enable row level security;
alter table public.client_profiles enable row level security;
alter table public.freelancer_profiles enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_messages enable row level security;
alter table public.app_sessions enable row level security;
alter table public.payment_checkout_sessions enable row level security;
alter table public.contact_reads enable row level security;

drop policy if exists profiles_public_and_peer_read on public.profiles;
create policy profiles_public_and_peer_read
on public.profiles
for select
using (
  user_type = 'freelancer'
  or auth.uid() = id
  or exists (
    select 1
    from public.contacts c
    where (
      c.client_user_id = auth.uid()
      and c.freelancer_user_id = profiles.id
    ) or (
      c.freelancer_user_id = auth.uid()
      and c.client_user_id = profiles.id
    )
  )
);

drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

drop policy if exists client_profiles_select_own on public.client_profiles;
create policy client_profiles_select_own
on public.client_profiles
for select
to authenticated
using (auth.uid() = user_id);

drop policy if exists client_profiles_insert_own on public.client_profiles;
create policy client_profiles_insert_own
on public.client_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists client_profiles_update_own on public.client_profiles;
create policy client_profiles_update_own
on public.client_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists freelancer_profiles_public_read on public.freelancer_profiles;
create policy freelancer_profiles_public_read
on public.freelancer_profiles
for select
using (true);

drop policy if exists freelancer_profiles_insert_own on public.freelancer_profiles;
create policy freelancer_profiles_insert_own
on public.freelancer_profiles
for insert
to authenticated
with check (auth.uid() = user_id);

drop policy if exists freelancer_profiles_update_own on public.freelancer_profiles;
create policy freelancer_profiles_update_own
on public.freelancer_profiles
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

drop policy if exists contacts_select_participants on public.contacts;
create policy contacts_select_participants
on public.contacts
for select
to authenticated
using (auth.uid() = client_user_id or auth.uid() = freelancer_user_id);

drop policy if exists contacts_insert_client on public.contacts;
create policy contacts_insert_client
on public.contacts
for insert
to authenticated
with check (
  auth.uid() = client_user_id
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.user_type = 'client'
  )
  and exists (
    select 1
    from public.profiles p
    where p.id = freelancer_user_id
      and p.user_type = 'freelancer'
  )
);

drop policy if exists contacts_update_participants on public.contacts;
create policy contacts_update_participants
on public.contacts
for update
to authenticated
using (auth.uid() = client_user_id or auth.uid() = freelancer_user_id)
with check (auth.uid() = client_user_id or auth.uid() = freelancer_user_id);

drop policy if exists contact_messages_select_participants on public.contact_messages;
create policy contact_messages_select_participants
on public.contact_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.contacts c
    where c.id = contact_messages.contact_id
      and (c.client_user_id = auth.uid() or c.freelancer_user_id = auth.uid())
  )
);

drop policy if exists contact_messages_insert_participants on public.contact_messages;
create policy contact_messages_insert_participants
on public.contact_messages
for insert
to authenticated
with check (
  auth.uid() = sender_user_id
  and exists (
    select 1
    from public.contacts c
    where c.id = contact_messages.contact_id
      and (c.client_user_id = auth.uid() or c.freelancer_user_id = auth.uid())
  )
  and exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.user_type = contact_messages.sender_role
  )
);

drop policy if exists contact_reads_select_own on public.contact_reads;
create policy contact_reads_select_own
on public.contact_reads
for select
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.contacts c
    where c.id = contact_reads.contact_id
      and (c.client_user_id = auth.uid() or c.freelancer_user_id = auth.uid())
  )
);

drop policy if exists contact_reads_insert_own on public.contact_reads;
create policy contact_reads_insert_own
on public.contact_reads
for insert
to authenticated
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.contacts c
    where c.id = contact_reads.contact_id
      and (c.client_user_id = auth.uid() or c.freelancer_user_id = auth.uid())
  )
);

drop policy if exists contact_reads_update_own on public.contact_reads;
create policy contact_reads_update_own
on public.contact_reads
for update
to authenticated
using (
  auth.uid() = user_id
  and exists (
    select 1
    from public.contacts c
    where c.id = contact_reads.contact_id
      and (c.client_user_id = auth.uid() or c.freelancer_user_id = auth.uid())
  )
)
with check (
  auth.uid() = user_id
  and exists (
    select 1
    from public.contacts c
    where c.id = contact_reads.contact_id
      and (c.client_user_id = auth.uid() or c.freelancer_user_id = auth.uid())
  )
);

create or replace function public.handle_contact_message_touch()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.contacts
  set
    status = case
      when new.sender_role = 'freelancer' then 'Respondido'
      else 'Novo'
    end,
    updated_at = new.created_at
  where id = new.contact_id;

  return new;
end;
$$;

drop trigger if exists contact_messages_touch_contact on public.contact_messages;
create trigger contact_messages_touch_contact
after insert on public.contact_messages
for each row execute function public.handle_contact_message_touch();

create or replace function public.increment_freelancer_profile_views(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.freelancer_profiles
  set profile_views = coalesce(profile_views, 0) + 1
  where user_id = target_user_id;
end;
$$;

create or replace function public.get_freelancer_plan_price(target_plan_tier text)
returns numeric
language sql
immutable
as $$
  select case target_plan_tier
    when 'normal' then 6.5
    when 'booster' then 8.9
    else null
  end;
$$;

create or replace function public.build_payment_checkout_response(
  checkout_row public.payment_checkout_sessions
)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'id', checkout_row.id,
    'provider', checkout_row.provider,
    'status', checkout_row.status,
    'customerName', checkout_row.customer_name,
    'customerEmail', checkout_row.customer_email,
    'planTier', checkout_row.plan_tier,
    'planName', case checkout_row.plan_tier
      when 'booster' then 'Plano Freelancer Booster'
      else 'Plano Freelancer Normal'
    end,
    'amountMonthly', checkout_row.amount_monthly,
    'currency', checkout_row.currency,
    'createdAt', checkout_row.created_at,
    'updatedAt', checkout_row.updated_at,
    'expiresAt', checkout_row.expires_at,
    'context',
      nullif(
        jsonb_strip_nulls(
          jsonb_build_object(
            'cnpjActive',
              case
                when checkout_row.payload is not null
                  and jsonb_typeof(checkout_row.payload -> 'cnpj_active') = 'boolean'
                  then (checkout_row.payload ->> 'cnpj_active')::boolean
                else null
              end,
            'changeType',
              case
                when checkout_row.payload is not null
                  and checkout_row.payload ->> 'change_type' in ('activation', 'upgrade', 'renewal')
                  then checkout_row.payload ->> 'change_type'
                else null
              end,
            'source',
              case
                when checkout_row.payload is not null
                  and checkout_row.payload ->> 'source' in ('signup', 'subscription_page', 'dashboard', 'retry')
                  then checkout_row.payload ->> 'source'
                else null
              end
          )
        ),
        '{}'::jsonb
      )
  );
$$;

create or replace function public.sync_expired_payment_checkout_sessions(target_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.payment_checkout_sessions
  set
    status = 'expired',
    updated_at = timezone('utc', now())
  where status = 'open'
    and expires_at <= timezone('utc', now())
    and (target_user_id is null or user_id = target_user_id);

  update public.freelancer_profiles fp
  set
    subscription_status = 'expired',
    updated_at = timezone('utc', now())
  where fp.subscription_status = 'pending'
    and (target_user_id is null or fp.user_id = target_user_id)
    and exists (
      select 1
      from public.payment_checkout_sessions pcs
      where pcs.user_id = fp.user_id
        and pcs.status = 'expired'
        and pcs.created_at = (
          select max(latest.created_at)
          from public.payment_checkout_sessions latest
          where latest.user_id = fp.user_id
        )
    );
end;
$$;

create or replace function public.sync_expired_freelancer_subscriptions(target_user_id uuid default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.freelancer_profiles
  set
    subscription_status = 'expired',
    updated_at = timezone('utc', now())
  where subscription_status = 'active'
    and subscription_ends_at <= timezone('utc', now())
    and (target_user_id is null or user_id = target_user_id);
end;
$$;

create or replace function public.get_freelancer_subscription_workspace()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_profile public.profiles%rowtype;
  current_freelancer public.freelancer_profiles%rowtype;
  active_checkout public.payment_checkout_sessions%rowtype;
  latest_checkout public.payment_checkout_sessions%rowtype;
  resolved_tier text;
  resolved_status text;
begin
  if current_user_id is null then
    raise exception 'Faça login para continuar.';
  end if;

  perform public.sync_expired_payment_checkout_sessions(current_user_id);
  perform public.sync_expired_freelancer_subscriptions(current_user_id);

  select *
  into current_profile
  from public.profiles
  where id = current_user_id;

  if not found then
    raise exception 'Conta não encontrada.';
  end if;

  if current_profile.user_type <> 'freelancer' then
    raise exception 'Apenas freelancers podem acessar a assinatura.';
  end if;

  select *
  into current_freelancer
  from public.freelancer_profiles
  where user_id = current_user_id;

  if not found then
    raise exception 'Perfil freelancer não encontrado.';
  end if;

  resolved_tier := case
    when current_freelancer.subscription_tier = 'booster' then 'booster'
    else 'normal'
  end;

  resolved_status := case
    when current_freelancer.subscription_status in ('pending', 'active', 'past_due', 'expired', 'canceled')
      then current_freelancer.subscription_status
    else 'active'
  end;

  select *
  into active_checkout
  from public.payment_checkout_sessions
  where user_id = current_user_id
    and status in ('open', 'pending')
  order by created_at desc
  limit 1;

  select *
  into latest_checkout
  from public.payment_checkout_sessions
  where user_id = current_user_id
  order by created_at desc
  limit 1;

  return jsonb_build_object(
    'profile',
      jsonb_build_object(
        'name', coalesce(nullif(current_profile.full_name, ''), current_profile.email),
        'profession', coalesce(nullif(current_freelancer.professional_title, ''), 'Freelancer'),
        'subscriptionTier', resolved_tier
      ),
    'subscription',
      jsonb_build_object(
        'tier', resolved_tier,
        'name', case resolved_tier
          when 'booster' then 'Plano Freelancer Booster'
          else 'Plano Freelancer Normal'
        end,
        'priceMonthly', public.get_freelancer_plan_price(resolved_tier),
        'status', resolved_status,
        'startedAt', current_freelancer.subscription_started_at,
        'endsAt', current_freelancer.subscription_ends_at
      ),
    'activeCheckout',
      case
        when active_checkout.id is null then null
        else public.build_payment_checkout_response(active_checkout)
      end,
    'latestCheckout',
      case
        when latest_checkout.id is null then null
        else public.build_payment_checkout_response(latest_checkout)
      end
  );
end;
$$;

create or replace function public.start_own_freelancer_subscription_checkout(
  target_plan_tier text,
  cnpj_active boolean default false,
  source text default 'subscription_page'
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_profile public.profiles%rowtype;
  current_freelancer public.freelancer_profiles%rowtype;
  existing_checkout public.payment_checkout_sessions%rowtype;
  checkout_row public.payment_checkout_sessions%rowtype;
  resolved_tier text;
  resolved_status text;
  resolved_source text;
  change_type text;
  plan_price numeric;
begin
  if current_user_id is null then
    raise exception 'Faça login para continuar.';
  end if;

  perform public.sync_expired_payment_checkout_sessions(current_user_id);
  perform public.sync_expired_freelancer_subscriptions(current_user_id);

  select *
  into current_profile
  from public.profiles
  where id = current_user_id;

  if not found then
    raise exception 'Conta não encontrada.';
  end if;

  if current_profile.user_type <> 'freelancer' then
    raise exception 'Apenas freelancers podem contratar um plano.';
  end if;

  select *
  into current_freelancer
  from public.freelancer_profiles
  where user_id = current_user_id;

  if not found then
    raise exception 'Perfil freelancer não encontrado.';
  end if;

  resolved_tier := case
    when target_plan_tier = 'booster' then 'booster'
    when target_plan_tier = 'normal' then 'normal'
    else null
  end;

  if resolved_tier is null then
    raise exception 'Selecione um plano válido.';
  end if;

  resolved_status := case
    when current_freelancer.subscription_status in ('pending', 'active', 'past_due', 'expired', 'canceled')
      then current_freelancer.subscription_status
    else 'active'
  end;

  select *
  into existing_checkout
  from public.payment_checkout_sessions
  where user_id = current_user_id
    and status in ('open', 'pending')
  order by created_at desc
  limit 1;

  if existing_checkout.id is not null then
    if existing_checkout.plan_tier = resolved_tier then
      return jsonb_build_object(
        'checkout', public.build_payment_checkout_response(existing_checkout),
        'checkoutPath', '/checkout/freelancer/' || existing_checkout.id::text
      );
    end if;

    raise exception 'Já existe um checkout em andamento para outro plano.';
  end if;

  if resolved_status = 'active'
    and coalesce(current_freelancer.subscription_tier, 'normal') = resolved_tier then
    raise exception 'Seu plano atual já está ativo.';
  end if;

  if resolved_status = 'active'
    and coalesce(current_freelancer.subscription_tier, 'normal') = 'booster'
    and resolved_tier = 'normal' then
    raise exception 'O downgrade para o plano normal será liberado na próxima fase da assinatura.';
  end if;

  resolved_source := case
    when source in ('signup', 'subscription_page', 'dashboard', 'retry') then source
    else 'subscription_page'
  end;

  change_type := case
    when resolved_status = 'active'
      and coalesce(current_freelancer.subscription_tier, 'normal') <> resolved_tier then 'upgrade'
    when resolved_status = 'active' then 'renewal'
    else 'activation'
  end;

  plan_price := public.get_freelancer_plan_price(resolved_tier);

  if plan_price is null then
    raise exception 'Não foi possível calcular o valor do plano.';
  end if;

  insert into public.payment_checkout_sessions (
    user_id,
    provider,
    status,
    customer_name,
    customer_email,
    plan_tier,
    amount_monthly,
    currency,
    payload,
    expires_at,
    updated_at
  )
  values (
    current_user_id,
    'mock',
    'open',
    coalesce(nullif(current_profile.full_name, ''), current_profile.email),
    current_profile.email,
    resolved_tier,
    plan_price,
    'BRL',
    jsonb_strip_nulls(
      jsonb_build_object(
        'source', resolved_source,
        'cnpj_active', coalesce(cnpj_active, false),
        'change_type', change_type,
        'origin_tier', coalesce(current_freelancer.subscription_tier, 'normal'),
        'origin_status', resolved_status
      )
    ),
    timezone('utc', now()) + interval '30 minutes',
    timezone('utc', now())
  )
  returning *
  into checkout_row;

  if resolved_status <> 'active' then
    update public.freelancer_profiles
    set
      subscription_tier = resolved_tier,
      subscription_status = 'pending',
      updated_at = timezone('utc', now())
    where user_id = current_user_id;
  end if;

  return jsonb_build_object(
    'checkout', public.build_payment_checkout_response(checkout_row),
    'checkoutPath', '/checkout/freelancer/' || checkout_row.id::text
  );
end;
$$;

create or replace function public.get_own_payment_checkout_session(target_checkout_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  checkout_row public.payment_checkout_sessions%rowtype;
begin
  if current_user_id is null then
    raise exception 'Faça login para continuar.';
  end if;

  perform public.sync_expired_payment_checkout_sessions(current_user_id);

  select *
  into checkout_row
  from public.payment_checkout_sessions
  where id = target_checkout_id
    and user_id = current_user_id;

  if not found then
    raise exception 'Checkout não encontrado.';
  end if;

  return jsonb_build_object(
    'checkout', public.build_payment_checkout_response(checkout_row)
  );
end;
$$;

create or replace function public.complete_own_mock_payment_checkout(
  target_checkout_id uuid,
  outcome text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  current_freelancer public.freelancer_profiles%rowtype;
  checkout_row public.payment_checkout_sessions%rowtype;
  resolved_outcome text;
  redirect_path text;
  now_utc timestamptz := timezone('utc', now());
begin
  if current_user_id is null then
    raise exception 'Faça login para continuar.';
  end if;

  perform public.sync_expired_payment_checkout_sessions(current_user_id);
  perform public.sync_expired_freelancer_subscriptions(current_user_id);

  select *
  into current_freelancer
  from public.freelancer_profiles
  where user_id = current_user_id;

  if not found then
    raise exception 'Perfil freelancer não encontrado.';
  end if;

  select *
  into checkout_row
  from public.payment_checkout_sessions
  where id = target_checkout_id
    and user_id = current_user_id;

  if not found then
    raise exception 'Checkout não encontrado.';
  end if;

  resolved_outcome := case
    when outcome in ('approved', 'pending', 'failed') then outcome
    else null
  end;

  if resolved_outcome is null then
    raise exception 'Resultado de pagamento inválido.';
  end if;

  if checkout_row.status = 'approved' then
    return jsonb_build_object(
      'checkout', public.build_payment_checkout_response(checkout_row),
      'redirectPath', '/pagamento/aprovado?checkout=' || checkout_row.id::text
    );
  end if;

  if checkout_row.status = 'expired' then
    return jsonb_build_object(
      'checkout', public.build_payment_checkout_response(checkout_row),
      'redirectPath', '/pagamento/expirado?checkout=' || checkout_row.id::text
    );
  end if;

  if checkout_row.status <> 'open' then
    return jsonb_build_object(
      'checkout', public.build_payment_checkout_response(checkout_row),
      'redirectPath',
        case checkout_row.status
          when 'pending' then '/pagamento/pendente?checkout=' || checkout_row.id::text
          when 'failed' then '/pagamento/recusado?checkout=' || checkout_row.id::text
          else '/pagamento/expirado?checkout=' || checkout_row.id::text
        end
    );
  end if;

  if checkout_row.expires_at <= now_utc then
    update public.payment_checkout_sessions
    set
      status = 'expired',
      updated_at = now_utc
    where id = checkout_row.id
    returning *
    into checkout_row;

    if current_freelancer.subscription_status = 'pending' then
      update public.freelancer_profiles
      set
        subscription_status = 'expired',
        updated_at = now_utc
      where user_id = current_user_id;
    end if;

    return jsonb_build_object(
      'checkout', public.build_payment_checkout_response(checkout_row),
      'redirectPath', '/pagamento/expirado?checkout=' || checkout_row.id::text
    );
  end if;

  update public.payment_checkout_sessions
  set
    status = resolved_outcome,
    updated_at = now_utc
  where id = checkout_row.id
  returning *
  into checkout_row;

  if resolved_outcome = 'approved' then
    update public.freelancer_profiles
    set
      subscription_tier = checkout_row.plan_tier,
      subscription_status = 'active',
      subscription_started_at = now_utc,
      subscription_ends_at = now_utc + interval '30 days',
      updated_at = now_utc
    where user_id = current_user_id;

    redirect_path := '/pagamento/aprovado?checkout=' || checkout_row.id::text;
  elsif resolved_outcome = 'pending' then
    if current_freelancer.subscription_status <> 'active' then
      update public.freelancer_profiles
      set
        subscription_tier = checkout_row.plan_tier,
        subscription_status = 'pending',
        updated_at = now_utc
      where user_id = current_user_id;
    end if;

    redirect_path := '/pagamento/pendente?checkout=' || checkout_row.id::text;
  else
    redirect_path := '/pagamento/recusado?checkout=' || checkout_row.id::text;
  end if;

  return jsonb_build_object(
    'checkout', public.build_payment_checkout_response(checkout_row),
    'redirectPath', redirect_path
  );
end;
$$;

create or replace function public.auth_email_exists(target_email text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  with normalized_email as (
    select public.normalize_profile_email(target_email) as email
  )
  select coalesce(
    (
      select exists (
        select 1
        from auth.users u
        cross join normalized_email ne
        where ne.email is not null
          and public.normalize_profile_email(u.email) = ne.email
      )
      or exists (
        select 1
        from public.profiles p
        cross join normalized_email ne
        where ne.email is not null
          and p.email = ne.email
      )
    ),
    false
  );
$$;

create or replace function public.auth_phone_exists(target_phone text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  with normalized_phone as (
    select public.normalize_profile_phone(target_phone) as digits
  )
  select coalesce(
    (
      select exists (
        select 1
        from auth.users u
        cross join normalized_phone np
        where np.digits is not null
          and public.normalize_profile_phone(coalesce(nullif(u.phone, ''), u.raw_user_meta_data ->> 'phone')) = np.digits
      )
      or exists (
        select 1
        from public.profiles p
        cross join normalized_phone np
        where np.digits is not null
          and p.phone_normalized = np.digits
      )
    ),
    false
  );
$$;

grant execute on function public.auth_email_exists(text) to anon, authenticated, supabase_auth_admin;
grant execute on function public.auth_phone_exists(text) to anon, authenticated, supabase_auth_admin;

create or replace function public.auth_email_exists_excluding(
  target_email text,
  exclude_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  with normalized_email as (
    select public.normalize_profile_email(target_email) as email
  )
  select coalesce(
    (
      select exists (
        select 1
        from auth.users u
        cross join normalized_email ne
        where ne.email is not null
          and (exclude_user_id is null or u.id <> exclude_user_id)
          and public.normalize_profile_email(u.email) = ne.email
      )
      or exists (
        select 1
        from public.profiles p
        cross join normalized_email ne
        where ne.email is not null
          and (exclude_user_id is null or p.id <> exclude_user_id)
          and p.email = ne.email
      )
    ),
    false
  );
$$;

create or replace function public.auth_phone_exists_excluding(
  target_phone text,
  exclude_user_id uuid
)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  with normalized_phone as (
    select public.normalize_profile_phone(target_phone) as digits
  )
  select coalesce(
    (
      select exists (
        select 1
        from auth.users u
        cross join normalized_phone np
        where np.digits is not null
          and (exclude_user_id is null or u.id <> exclude_user_id)
          and public.normalize_profile_phone(coalesce(nullif(u.phone, ''), u.raw_user_meta_data ->> 'phone')) = np.digits
      )
      or exists (
        select 1
        from public.profiles p
        cross join normalized_phone np
        where np.digits is not null
          and (exclude_user_id is null or p.id <> exclude_user_id)
          and p.phone_normalized = np.digits
      )
    ),
    false
  );
$$;

grant execute on function public.auth_email_exists_excluding(text, uuid) to anon, authenticated, supabase_auth_admin;
grant execute on function public.auth_phone_exists_excluding(text, uuid) to anon, authenticated, supabase_auth_admin;

create or replace function public.hook_block_duplicate_signup_contacts(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  incoming_email text;
  incoming_phone text;
  incoming_user_id uuid;
begin
  incoming_email := nullif(trim(coalesce(event->'user'->>'email', '')), '');
  incoming_phone := coalesce(
    nullif(trim(coalesce(event->'user'->>'phone', '')), ''),
    nullif(trim(coalesce(event->'user'->'user_metadata'->>'phone', '')), '')
  );

  begin
    incoming_user_id := nullif(trim(coalesce(event->'user'->>'id', '')), '')::uuid;
  exception
    when invalid_text_representation then
      incoming_user_id := null;
  end;

  if incoming_email is not null and public.auth_email_exists_excluding(incoming_email, incoming_user_id) then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 409,
        'message', 'Já existe uma conta com este e-mail.'
      )
    );
  end if;

  if incoming_phone is not null and public.auth_phone_exists_excluding(incoming_phone, incoming_user_id) then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 409,
        'message', 'Já existe uma conta com este telefone.'
      )
    );
  end if;

  return '{}'::jsonb;
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_block_duplicate_signup_contacts(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_block_duplicate_signup_contacts(jsonb) from anon, authenticated, public;
grant execute on function public.increment_freelancer_profile_views(uuid) to anon, authenticated;
grant execute on function public.get_freelancer_plan_price(text) to anon, authenticated;
grant execute on function public.build_payment_checkout_response(public.payment_checkout_sessions) to authenticated;
grant execute on function public.sync_expired_payment_checkout_sessions(uuid) to authenticated;
grant execute on function public.sync_expired_freelancer_subscriptions(uuid) to authenticated;
grant execute on function public.get_freelancer_subscription_workspace() to authenticated;
grant execute on function public.start_own_freelancer_subscription_checkout(text, boolean, text) to authenticated;
grant execute on function public.get_own_payment_checkout_session(uuid) to authenticated;
grant execute on function public.complete_own_mock_payment_checkout(uuid, text) to authenticated;

insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do update set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('banners', 'banners', true)
on conflict (id) do update set public = excluded.public;

drop policy if exists storage_public_read_avatars on storage.objects;
create policy storage_public_read_avatars
on storage.objects
for select
using (bucket_id = 'avatars');

drop policy if exists storage_public_read_banners on storage.objects;
create policy storage_public_read_banners
on storage.objects
for select
using (bucket_id = 'banners');

drop policy if exists storage_insert_profile_assets on storage.objects;
create policy storage_insert_profile_assets
on storage.objects
for insert
to authenticated
with check (
  bucket_id in ('avatars', 'banners')
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists storage_update_profile_assets on storage.objects;
create policy storage_update_profile_assets
on storage.objects
for update
to authenticated
using (
  bucket_id in ('avatars', 'banners')
  and (storage.foldername(name))[1] = auth.uid()::text
)
with check (
  bucket_id in ('avatars', 'banners')
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists storage_delete_profile_assets on storage.objects;
create policy storage_delete_profile_assets
on storage.objects
for delete
to authenticated
using (
  bucket_id in ('avatars', 'banners')
  and (storage.foldername(name))[1] = auth.uid()::text
);

-- Security hardening 1.0.10
create extension if not exists pgcrypto;

update public.profiles
set
  email = public.normalize_profile_email(email),
  phone = nullif(trim(coalesce(phone, '')), ''),
  phone_normalized = public.normalize_profile_phone(phone),
  updated_at = timezone('utc', now());

update public.client_profiles
set
  cep = nullif(regexp_replace(coalesce(cep, ''), '\D', '', 'g'), ''),
  updated_at = timezone('utc', now())
where cep is not null;

update public.freelancer_profiles
set
  cep = nullif(regexp_replace(coalesce(cep, ''), '\D', '', 'g'), ''),
  whatsapp = nullif(regexp_replace(coalesce(whatsapp, ''), '\D', '', 'g'), ''),
  updated_at = timezone('utc', now());

update public.payment_checkout_sessions
set
  customer_email = public.normalize_profile_email(customer_email),
  customer_name = nullif(trim(coalesce(customer_name, '')), ''),
  updated_at = timezone('utc', now());

with duplicate_open_checkouts as (
  select
    id,
    row_number() over (partition by user_id order by created_at desc, id desc) as rn
  from public.payment_checkout_sessions
  where user_id is not null
    and status in ('open', 'pending')
)
update public.payment_checkout_sessions pcs
set
  status = 'expired',
  updated_at = timezone('utc', now())
from duplicate_open_checkouts doc
where pcs.id = doc.id
  and doc.rn > 1;

alter table public.profiles
  drop constraint if exists profiles_email_normalized_check;
alter table public.profiles
  add constraint profiles_email_normalized_check
  check (email = public.normalize_profile_email(email));

alter table public.profiles
  drop constraint if exists profiles_phone_normalized_consistency_check;
alter table public.profiles
  add constraint profiles_phone_normalized_consistency_check
  check (phone_normalized is not distinct from public.normalize_profile_phone(phone));

alter table public.client_profiles
  drop constraint if exists client_profiles_cep_digits_check;
alter table public.client_profiles
  add constraint client_profiles_cep_digits_check
  check (cep is null or cep ~ '^\d{8}$');

alter table public.freelancer_profiles
  drop constraint if exists freelancer_profiles_subscription_tier_check;
alter table public.freelancer_profiles
  add constraint freelancer_profiles_subscription_tier_check
  check (subscription_tier in ('normal', 'booster'));

alter table public.freelancer_profiles
  drop constraint if exists freelancer_profiles_subscription_status_check;
alter table public.freelancer_profiles
  add constraint freelancer_profiles_subscription_status_check
  check (subscription_status in ('pending', 'active', 'past_due', 'expired', 'canceled'));

alter table public.freelancer_profiles
  drop constraint if exists freelancer_profiles_profile_views_nonnegative_check;
alter table public.freelancer_profiles
  add constraint freelancer_profiles_profile_views_nonnegative_check
  check (profile_views >= 0);

alter table public.freelancer_profiles
  drop constraint if exists freelancer_profiles_years_experience_nonnegative_check;
alter table public.freelancer_profiles
  add constraint freelancer_profiles_years_experience_nonnegative_check
  check (years_experience is null or years_experience >= 0);

alter table public.freelancer_profiles
  drop constraint if exists freelancer_profiles_cep_digits_check;
alter table public.freelancer_profiles
  add constraint freelancer_profiles_cep_digits_check
  check (cep is null or cep ~ '^\d{8}$');

alter table public.freelancer_profiles
  drop constraint if exists freelancer_profiles_whatsapp_digits_check;
alter table public.freelancer_profiles
  add constraint freelancer_profiles_whatsapp_digits_check
  check (whatsapp is null or whatsapp = regexp_replace(whatsapp, '\D', '', 'g'));

alter table public.payment_checkout_sessions
  drop constraint if exists payment_checkout_sessions_plan_tier_check;
alter table public.payment_checkout_sessions
  add constraint payment_checkout_sessions_plan_tier_check
  check (plan_tier in ('normal', 'booster'));

alter table public.payment_checkout_sessions
  drop constraint if exists payment_checkout_sessions_amount_positive_check;
alter table public.payment_checkout_sessions
  add constraint payment_checkout_sessions_amount_positive_check
  check (amount_monthly > 0);

alter table public.payment_checkout_sessions
  drop constraint if exists payment_checkout_sessions_currency_check;
alter table public.payment_checkout_sessions
  add constraint payment_checkout_sessions_currency_check
  check (currency = 'BRL');

alter table public.payment_checkout_sessions
  drop constraint if exists payment_checkout_sessions_customer_email_normalized_check;
alter table public.payment_checkout_sessions
  add constraint payment_checkout_sessions_customer_email_normalized_check
  check (customer_email = public.normalize_profile_email(customer_email));

alter table public.payment_checkout_sessions
  drop constraint if exists payment_checkout_sessions_customer_name_present_check;
alter table public.payment_checkout_sessions
  add constraint payment_checkout_sessions_customer_name_present_check
  check (char_length(trim(customer_name)) between 1 and 120);

alter table public.payment_checkout_sessions
  drop constraint if exists payment_checkout_sessions_expiration_window_check;
alter table public.payment_checkout_sessions
  add constraint payment_checkout_sessions_expiration_window_check
  check (expires_at > created_at);

alter table public.app_sessions
  drop constraint if exists app_sessions_token_format_check;
alter table public.app_sessions
  add constraint app_sessions_token_format_check
  check (token ~ '^[0-9a-f]{64}$');

create unique index if not exists payment_checkout_sessions_one_active_per_user_idx
  on public.payment_checkout_sessions (user_id)
  where user_id is not null
    and status in ('open', 'pending');

create or replace function public.set_row_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := timezone('utc', now());
  return new;
end;
$$;

create or replace function public.prepare_payment_checkout_session()
returns trigger
language plpgsql
as $$
begin
  new.customer_name := nullif(trim(coalesce(new.customer_name, '')), '');
  new.customer_email := public.normalize_profile_email(new.customer_email);
  new.currency := upper(trim(coalesce(new.currency, 'BRL')));

  if new.customer_name is null then
    raise exception 'Nome do checkout obrigatorio.';
  end if;

  if new.customer_email is null then
    raise exception 'E-mail do checkout obrigatorio.';
  end if;

  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row
execute function public.set_row_updated_at();

drop trigger if exists client_profiles_set_updated_at on public.client_profiles;
create trigger client_profiles_set_updated_at
before update on public.client_profiles
for each row
execute function public.set_row_updated_at();

drop trigger if exists freelancer_profiles_set_updated_at on public.freelancer_profiles;
create trigger freelancer_profiles_set_updated_at
before update on public.freelancer_profiles
for each row
execute function public.set_row_updated_at();

drop trigger if exists contacts_set_updated_at on public.contacts;
create trigger contacts_set_updated_at
before update on public.contacts
for each row
execute function public.set_row_updated_at();

drop trigger if exists contact_reads_set_updated_at on public.contact_reads;
create trigger contact_reads_set_updated_at
before update on public.contact_reads
for each row
execute function public.set_row_updated_at();

drop trigger if exists app_sessions_set_updated_at on public.app_sessions;
create trigger app_sessions_set_updated_at
before update on public.app_sessions
for each row
execute function public.set_row_updated_at();

drop trigger if exists payment_checkout_sessions_set_updated_at on public.payment_checkout_sessions;
create trigger payment_checkout_sessions_set_updated_at
before update on public.payment_checkout_sessions
for each row
execute function public.set_row_updated_at();

drop trigger if exists payment_checkout_sessions_prepare_fields on public.payment_checkout_sessions;
create trigger payment_checkout_sessions_prepare_fields
before insert or update of customer_name, customer_email, currency
on public.payment_checkout_sessions
for each row
execute function public.prepare_payment_checkout_session();

create or replace function public.ensure_profile_integrity(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  source_user auth.users%rowtype;
  resolved_role text;
  resolved_email text;
  resolved_name text;
  resolved_phone text;
  resolved_city text;
  resolved_state text;
  resolved_bio text;
  resolved_avatar text;
  resolved_cep text;
begin
  select *
  into source_user
  from auth.users
  where id = target_user_id;

  if not found then
    return;
  end if;

  resolved_role := case
    when lower(coalesce(source_user.raw_user_meta_data ->> 'user_type', source_user.raw_user_meta_data ->> 'role', '')) in ('client', 'freelancer')
      then lower(coalesce(source_user.raw_user_meta_data ->> 'user_type', source_user.raw_user_meta_data ->> 'role', ''))
    else null
  end;
  resolved_email := public.normalize_profile_email(source_user.email);
  resolved_name := coalesce(
    nullif(source_user.raw_user_meta_data ->> 'full_name', ''),
    nullif(source_user.raw_user_meta_data ->> 'name', ''),
    resolved_email
  );
  resolved_phone := nullif(trim(coalesce(source_user.phone, source_user.raw_user_meta_data ->> 'phone', '')), '');
  resolved_city := nullif(source_user.raw_user_meta_data ->> 'city', '');
  resolved_state := nullif(source_user.raw_user_meta_data ->> 'state', '');
  resolved_bio := coalesce(
    nullif(source_user.raw_user_meta_data ->> 'bio', ''),
    nullif(source_user.raw_user_meta_data ->> 'summary', '')
  );
  resolved_avatar := nullif(source_user.raw_user_meta_data ->> 'avatar_url', '');
  resolved_cep := nullif(regexp_replace(coalesce(source_user.raw_user_meta_data ->> 'cep', ''), '\D', '', 'g'), '');

  insert into public.profiles (
    id,
    full_name,
    email,
    phone,
    user_type,
    avatar_url,
    bio,
    city,
    state
  )
  values (
    source_user.id,
    resolved_name,
    resolved_email,
    resolved_phone,
    resolved_role,
    resolved_avatar,
    resolved_bio,
    resolved_city,
    resolved_state
  )
  on conflict (id) do update
  set
    full_name = coalesce(nullif(public.profiles.full_name, ''), excluded.full_name),
    email = coalesce(public.normalize_profile_email(public.profiles.email), excluded.email),
    phone = coalesce(nullif(trim(coalesce(public.profiles.phone, '')), ''), excluded.phone),
    user_type = coalesce(public.profiles.user_type, excluded.user_type),
    avatar_url = coalesce(nullif(public.profiles.avatar_url, ''), excluded.avatar_url),
    bio = coalesce(nullif(public.profiles.bio, ''), excluded.bio),
    city = coalesce(nullif(public.profiles.city, ''), excluded.city),
    state = coalesce(nullif(public.profiles.state, ''), excluded.state);

  if resolved_role = 'client' then
    insert into public.client_profiles (
      user_id,
      contact_name,
      cep
    )
    values (
      source_user.id,
      resolved_name,
      resolved_cep
    )
    on conflict (user_id) do update
    set
      contact_name = coalesce(nullif(public.client_profiles.contact_name, ''), excluded.contact_name),
      cep = coalesce(nullif(public.client_profiles.cep, ''), excluded.cep);
  elsif resolved_role = 'freelancer' then
    insert into public.freelancer_profiles (
      user_id,
      cep,
      city,
      state,
      professional_title,
      skills,
      experience_level,
      portfolio_url,
      banner_url,
      availability_status,
      rating_average,
      total_reviews,
      category,
      summary,
      description,
      years_experience,
      linkedin_url,
      website_url,
      whatsapp,
      subscription_tier,
      subscription_status,
      profile_views
    )
    values (
      source_user.id,
      resolved_cep,
      resolved_city,
      resolved_state,
      coalesce(nullif(source_user.raw_user_meta_data ->> 'profession', ''), 'Freelancer'),
      array['Atendimento direto'],
      'pleno',
      coalesce(
        nullif(source_user.raw_user_meta_data ->> 'portfolio_url', ''),
        nullif(source_user.raw_user_meta_data ->> 'website_url', ''),
        'https://www.linkedin.com/'
      ),
      nullif(source_user.raw_user_meta_data ->> 'banner_url', ''),
      'available',
      0,
      0,
      nullif(source_user.raw_user_meta_data ->> 'category', ''),
      coalesce(resolved_bio, 'Perfil profissional em configuracao.'),
      coalesce(
        nullif(source_user.raw_user_meta_data ->> 'description', ''),
        resolved_bio,
        'Perfil profissional em configuracao.'
      ),
      case
        when coalesce(source_user.raw_user_meta_data ->> 'years_experience', '') ~ '^\d+$'
          then (source_user.raw_user_meta_data ->> 'years_experience')::integer
        else 5
      end,
      nullif(source_user.raw_user_meta_data ->> 'linkedin_url', ''),
      coalesce(
        nullif(source_user.raw_user_meta_data ->> 'website_url', ''),
        nullif(source_user.raw_user_meta_data ->> 'portfolio_url', '')
      ),
      public.normalize_profile_phone(resolved_phone),
      case lower(coalesce(source_user.raw_user_meta_data ->> 'subscription_tier', source_user.raw_user_meta_data ->> 'subscriptionTier', ''))
        when 'booster' then 'booster'
        else 'normal'
      end,
      case lower(coalesce(source_user.raw_user_meta_data ->> 'subscription_status', 'active'))
        when 'pending' then 'pending'
        when 'past_due' then 'past_due'
        when 'expired' then 'expired'
        when 'canceled' then 'canceled'
        else 'active'
      end,
      0
    )
    on conflict (user_id) do update
    set
      cep = coalesce(nullif(public.freelancer_profiles.cep, ''), excluded.cep),
      city = coalesce(nullif(public.freelancer_profiles.city, ''), excluded.city),
      state = coalesce(nullif(public.freelancer_profiles.state, ''), excluded.state),
      professional_title = coalesce(nullif(public.freelancer_profiles.professional_title, ''), excluded.professional_title),
      summary = coalesce(nullif(public.freelancer_profiles.summary, ''), excluded.summary),
      description = coalesce(nullif(public.freelancer_profiles.description, ''), excluded.description),
      linkedin_url = coalesce(nullif(public.freelancer_profiles.linkedin_url, ''), excluded.linkedin_url),
      website_url = coalesce(nullif(public.freelancer_profiles.website_url, ''), excluded.website_url),
      whatsapp = coalesce(nullif(public.freelancer_profiles.whatsapp, ''), excluded.whatsapp),
      subscription_tier = coalesce(nullif(public.freelancer_profiles.subscription_tier, ''), excluded.subscription_tier),
      subscription_status = coalesce(nullif(public.freelancer_profiles.subscription_status, ''), excluded.subscription_status);
  end if;
end;
$$;

create or replace function public.handle_auth_user_profile_sync()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  perform public.ensure_profile_integrity(new.id);
  return new;
end;
$$;

drop trigger if exists on_auth_user_profile_sync on auth.users;
create trigger on_auth_user_profile_sync
after insert or update of email, phone, raw_user_meta_data
on auth.users
for each row
execute function public.handle_auth_user_profile_sync();

select public.ensure_profile_integrity(id)
from auth.users;

drop policy if exists profiles_public_and_peer_read on public.profiles;
create policy profiles_public_and_peer_read
on public.profiles
for select
to authenticated
using (
  user_type = 'freelancer'
  or auth.uid() = id
  or exists (
    select 1
    from public.contacts c
    where (
      c.client_user_id = auth.uid()
      and c.freelancer_user_id = profiles.id
    ) or (
      c.freelancer_user_id = auth.uid()
      and c.client_user_id = profiles.id
    )
  )
);

drop policy if exists freelancer_profiles_public_read on public.freelancer_profiles;
create policy freelancer_profiles_public_read
on public.freelancer_profiles
for select
to authenticated
using (true);

revoke all on table public.app_sessions from anon, authenticated, public;
revoke all on table public.payment_checkout_sessions from anon, authenticated, public;

revoke execute on function public.auth_email_exists(text) from anon, authenticated, public;
revoke execute on function public.auth_phone_exists(text) from anon, authenticated, public;
revoke execute on function public.auth_email_exists_excluding(text, uuid) from anon, authenticated, public;
revoke execute on function public.auth_phone_exists_excluding(text, uuid) from anon, authenticated, public;
revoke execute on function public.build_payment_checkout_response(public.payment_checkout_sessions) from anon, authenticated, public;
revoke execute on function public.sync_expired_payment_checkout_sessions(uuid) from anon, authenticated, public;
revoke execute on function public.sync_expired_freelancer_subscriptions(uuid) from anon, authenticated, public;
revoke execute on function public.set_row_updated_at() from anon, authenticated, public;
revoke execute on function public.prepare_payment_checkout_session() from anon, authenticated, public;
revoke execute on function public.ensure_profile_integrity(uuid) from anon, authenticated, public;
revoke execute on function public.handle_auth_user_profile_sync() from anon, authenticated, public;
revoke execute on function public.handle_contact_message_touch() from anon, authenticated, public;

grant execute on function public.auth_email_exists(text) to service_role, supabase_auth_admin;
grant execute on function public.auth_phone_exists(text) to service_role, supabase_auth_admin;
grant execute on function public.auth_email_exists_excluding(text, uuid) to service_role, supabase_auth_admin;
grant execute on function public.auth_phone_exists_excluding(text, uuid) to service_role, supabase_auth_admin;
grant execute on function public.build_payment_checkout_response(public.payment_checkout_sessions) to service_role;
grant execute on function public.sync_expired_payment_checkout_sessions(uuid) to service_role;
grant execute on function public.sync_expired_freelancer_subscriptions(uuid) to service_role;
