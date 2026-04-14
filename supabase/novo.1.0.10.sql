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
