create or replace function public.auth_email_exists(target_email text)
returns boolean
language sql
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from auth.users u
    where lower(u.email) = lower(trim(target_email))
  );
$$;

grant execute on function public.auth_email_exists(text) to anon, authenticated;
