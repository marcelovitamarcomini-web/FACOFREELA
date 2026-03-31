alter table public.client_profiles
  add column if not exists cep text;

update public.client_profiles cp
set cep = coalesce(
  nullif(cp.cep, ''),
  nullif(regexp_replace(coalesce(u.raw_user_meta_data ->> 'cep', ''), '\D', '', 'g'), '')
)
from auth.users u
where cp.user_id = u.id;
