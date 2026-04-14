create or replace function public.auth_phone_exists(target_phone text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  with normalized_phone as (
    select nullif(regexp_replace(coalesce(target_phone, ''), '\D', '', 'g'), '') as digits
  )
  select coalesce(
    (
      select exists (
        select 1
        from auth.users u
        cross join normalized_phone np
        where np.digits is not null
          and nullif(regexp_replace(coalesce(u.raw_user_meta_data ->> 'phone', ''), '\D', '', 'g'), '') = np.digits
      )
      or exists (
        select 1
        from public.profiles p
        cross join normalized_phone np
        where np.digits is not null
          and nullif(regexp_replace(coalesce(p.phone, ''), '\D', '', 'g'), '') = np.digits
      )
    ),
    false
  );
$$;

grant execute on function public.auth_phone_exists(text) to anon, authenticated;
