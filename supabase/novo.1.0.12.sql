alter table public.payment_checkout_sessions
  drop constraint if exists payment_checkout_sessions_provider_check;

alter table public.payment_checkout_sessions
  add constraint payment_checkout_sessions_provider_check
  check (provider in ('mock', 'mercadopago'));

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
    'checkoutUrl',
      case
        when checkout_row.payload is not null
          and nullif(trim(checkout_row.payload ->> 'checkout_url'), '') is not null
          then checkout_row.payload ->> 'checkout_url'
        else null
      end,
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

grant execute on function public.build_payment_checkout_response(public.payment_checkout_sessions) to authenticated;
