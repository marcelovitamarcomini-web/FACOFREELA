create index if not exists payment_checkout_sessions_user_created_at_idx
  on public.payment_checkout_sessions (user_id, created_at desc);

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

grant execute on function public.get_freelancer_plan_price(text) to anon, authenticated;
grant execute on function public.build_payment_checkout_response(public.payment_checkout_sessions) to authenticated;
grant execute on function public.sync_expired_payment_checkout_sessions(uuid) to authenticated;
grant execute on function public.sync_expired_freelancer_subscriptions(uuid) to authenticated;
grant execute on function public.get_freelancer_subscription_workspace() to authenticated;
grant execute on function public.start_own_freelancer_subscription_checkout(text, boolean, text) to authenticated;
grant execute on function public.get_own_payment_checkout_session(uuid) to authenticated;
grant execute on function public.complete_own_mock_payment_checkout(uuid, text) to authenticated;
