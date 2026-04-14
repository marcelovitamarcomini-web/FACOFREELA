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
          and public.normalize_profile_phone(
            coalesce(nullif(u.phone, ''), u.raw_user_meta_data ->> 'phone')
          ) = np.digits
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

  if incoming_email is not null
    and public.auth_email_exists_excluding(incoming_email, incoming_user_id)
  then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 409,
        'message', 'Já existe uma conta com este e-mail.'
      )
    );
  end if;

  if incoming_phone is not null
    and public.auth_phone_exists_excluding(incoming_phone, incoming_user_id)
  then
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
