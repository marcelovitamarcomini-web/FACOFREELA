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

alter table public.app_sessions enable row level security;

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

alter table public.contact_reads enable row level security;

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
