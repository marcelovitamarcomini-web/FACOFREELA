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

alter table public.profiles
  add column if not exists phone_normalized text;

update public.profiles
set
  email = public.normalize_profile_email(email),
  phone = nullif(trim(coalesce(phone, '')), ''),
  phone_normalized = public.normalize_profile_phone(phone);

do $$
begin
  if exists (
    select 1
    from (
      select normalized_email
      from (
        select u.id as user_id, public.normalize_profile_email(u.email) as normalized_email
        from auth.users u

        union all

        select p.id as user_id, public.normalize_profile_email(p.email) as normalized_email
        from public.profiles p
      ) emails
      where normalized_email is not null
      group by normalized_email
      having count(distinct user_id) > 1
    ) duplicates
  ) then
    raise exception 'Existem e-mails duplicados no sistema. Resolva os legados antes de aplicar a migration 1.0.3.';
  end if;

  if exists (
    select 1
    from (
      select normalized_phone
      from (
        select
          u.id as user_id,
          public.normalize_profile_phone(coalesce(nullif(u.phone, ''), u.raw_user_meta_data ->> 'phone')) as normalized_phone
        from auth.users u

        union all

        select p.id as user_id, public.normalize_profile_phone(p.phone) as normalized_phone
        from public.profiles p
      ) phones
      where normalized_phone is not null
      group by normalized_phone
      having count(distinct user_id) > 1
    ) duplicates
  ) then
    raise exception 'Existem telefones duplicados no sistema. Resolva os legados antes de aplicar a migration 1.0.3.';
  end if;
end;
$$;

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

drop index if exists public.profiles_email_key;
create unique index if not exists profiles_email_key on public.profiles (email);

create unique index if not exists profiles_phone_normalized_key
on public.profiles (phone_normalized)
where phone_normalized is not null;

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
