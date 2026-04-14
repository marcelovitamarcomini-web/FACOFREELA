create or replace function public.hook_block_duplicate_signup_contacts(event jsonb)
returns jsonb
language plpgsql
as $$
declare
  incoming_email text;
  incoming_phone text;
begin
  incoming_email := nullif(trim(coalesce(event->'user'->>'email', '')), '');
  incoming_phone := coalesce(
    nullif(trim(coalesce(event->'user'->>'phone', '')), ''),
    nullif(trim(coalesce(event->'user'->'user_metadata'->>'phone', '')), '')
  );

  if incoming_email is not null and public.auth_email_exists(incoming_email) then
    return jsonb_build_object(
      'error',
      jsonb_build_object(
        'http_code', 409,
        'message', 'Já existe uma conta com este e-mail.'
      )
    );
  end if;

  if incoming_phone is not null and public.auth_phone_exists(incoming_phone) then
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
