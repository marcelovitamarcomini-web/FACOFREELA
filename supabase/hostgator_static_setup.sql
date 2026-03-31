-- Safe to rerun. This script bootstraps the core tables used by the app
-- and then applies the extra setup required for the static HostGator deploy.

create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text,
  email text not null,
  phone text,
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
  add column if not exists has_cnpj boolean not null default false,
  add column if not exists subscription_tier text not null default 'normal',
  add column if not exists subscription_status text not null default 'active',
  add column if not exists subscription_started_at timestamptz not null default timezone('utc', now()),
  add column if not exists subscription_ends_at timestamptz not null default (timezone('utc', now()) + interval '30 days'),
  add column if not exists profile_views bigint not null default 0;

create unique index if not exists profiles_email_key on public.profiles (email);
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
select
  u.id,
  coalesce(
    nullif(u.raw_user_meta_data ->> 'full_name', ''),
    nullif(u.raw_user_meta_data ->> 'name', ''),
    u.email
  ),
  u.email,
  nullif(u.raw_user_meta_data ->> 'phone', ''),
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
  email = coalesce(nullif(p.email, ''), u.email),
  phone = coalesce(nullif(p.phone, ''), nullif(u.raw_user_meta_data ->> 'phone', '')),
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
  has_cnpj,
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
  case
    when lower(coalesce(u.raw_user_meta_data ->> 'has_cnpj', u.raw_user_meta_data ->> 'hasCnpj', '')) in ('true', 'sim')
      then true
    else false
  end,
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
  has_cnpj = coalesce(
    fp.has_cnpj,
    case
      when lower(coalesce(u.raw_user_meta_data ->> 'has_cnpj', u.raw_user_meta_data ->> 'hasCnpj', '')) in ('true', 'sim')
        then true
      when lower(coalesce(u.raw_user_meta_data ->> 'has_cnpj', u.raw_user_meta_data ->> 'hasCnpj', '')) in ('false', 'nao', 'não')
        then false
      else null
    end,
    false
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

grant execute on function public.increment_freelancer_profile_views(uuid) to anon, authenticated;

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
