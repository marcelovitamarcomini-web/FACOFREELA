import type {
  FreelancerPlanTier,
  PaymentCheckout,
  PaymentCheckoutContext,
  PaymentCheckoutStatus,
  PaymentProvider,
} from '../../shared/contracts.js';
import { freelancerPlanCatalog } from '../../shared/contracts.js';
import { getSupabaseServerReadClient } from './supabase.js';

type PaymentCheckoutRow = {
  id: string;
  user_id: string | null;
  provider: PaymentProvider;
  status: PaymentCheckoutStatus;
  customer_name: string;
  customer_email: string;
  plan_tier: FreelancerPlanTier;
  amount_monthly: number;
  currency: 'BRL';
  payload: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  expires_at: string;
};

const supabase = getSupabaseServerReadClient();

function requireSupabase() {
  if (!supabase) {
    throw new Error('Infraestrutura do Supabase indisponivel para o checkout.');
  }

  return supabase;
}

function normalizeCheckoutEmail(value: string): string {
  return value.trim().toLowerCase();
}

function parseCheckoutContext(
  payload: Record<string, unknown> | null,
): PaymentCheckoutContext | null {
  if (!payload) {
    return null;
  }

  const cnpjActive = typeof payload.cnpj_active === 'boolean' ? payload.cnpj_active : null;
  const changeType =
    payload.change_type === 'activation' ||
    payload.change_type === 'upgrade' ||
    payload.change_type === 'renewal'
      ? payload.change_type
      : null;
  const source =
    payload.source === 'signup' ||
    payload.source === 'subscription_page' ||
    payload.source === 'dashboard' ||
    payload.source === 'retry'
      ? payload.source
      : null;

  if (cnpjActive === null && !changeType && !source) {
    return null;
  }

  return {
    cnpjActive: cnpjActive ?? false,
    changeType: changeType ?? 'activation',
    source: source ?? 'signup',
  };
}

function mapCheckout(row: PaymentCheckoutRow): PaymentCheckout {
  return {
    id: row.id,
    provider: row.provider,
    status: row.status,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    planTier: row.plan_tier,
    planName: freelancerPlanCatalog[row.plan_tier].name,
    amountMonthly: row.amount_monthly,
    currency: row.currency,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    expiresAt: row.expires_at,
    context: parseCheckoutContext(row.payload),
  };
}

function resolveStatus(row: PaymentCheckoutRow) {
  if (row.status === 'open' && Date.parse(row.expires_at) <= Date.now()) {
    return 'expired' as const;
  }

  return row.status;
}

export async function createPaymentCheckoutSession(input: {
  amountMonthly: number;
  customerEmail: string;
  customerName: string;
  expiresAt: string;
  payload?: Record<string, unknown>;
  planTier: FreelancerPlanTier;
  provider: PaymentProvider;
  userId?: string;
}) {
  const { data, error } = await requireSupabase()
    .from('payment_checkout_sessions')
    .insert({
      user_id: input.userId ?? null,
      provider: input.provider,
      status: 'open',
      customer_name: input.customerName,
      customer_email: normalizeCheckoutEmail(input.customerEmail),
      plan_tier: input.planTier,
      amount_monthly: input.amountMonthly,
      currency: 'BRL',
      payload: input.payload ?? null,
      expires_at: input.expiresAt,
      updated_at: new Date().toISOString(),
    })
    .select(
      'id,user_id,provider,status,customer_name,customer_email,plan_tier,amount_monthly,currency,payload,created_at,updated_at,expires_at',
    )
    .single<PaymentCheckoutRow>();

  if (error || !data) {
    if (error?.code === '23505') {
      throw new Error('Ja existe um checkout em andamento para esta conta.');
    }

    throw new Error(error?.message || 'Nao foi possivel criar a sessao de checkout.');
  }

  return mapCheckout(data);
}

export async function findInProgressCheckoutByUserId(userId: string): Promise<{
  checkout: PaymentCheckout;
  payload: Record<string, unknown> | null;
  userId: string | null;
} | null> {
  const { data, error } = await requireSupabase()
    .from('payment_checkout_sessions')
    .select(
      'id,user_id,provider,status,customer_name,customer_email,plan_tier,amount_monthly,currency,payload,created_at,updated_at,expires_at',
    )
    .eq('user_id', userId)
    .in('status', ['open', 'pending'])
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle<PaymentCheckoutRow>();

  if (error || !data) {
    return null;
  }

  return {
    checkout: mapCheckout(data),
    payload: data.payload,
    userId: data.user_id,
  };
}

export async function findPaymentCheckoutSession(id: string): Promise<{
  checkout: PaymentCheckout;
  payload: Record<string, unknown> | null;
  userId: string | null;
} | null> {
  const { data, error } = await requireSupabase()
    .from('payment_checkout_sessions')
    .select(
      'id,user_id,provider,status,customer_name,customer_email,plan_tier,amount_monthly,currency,payload,created_at,updated_at,expires_at',
    )
    .eq('id', id)
    .maybeSingle<PaymentCheckoutRow>();

  if (error || !data) {
    return null;
  }

  const nextStatus = resolveStatus(data);
  const row =
    nextStatus !== data.status
      ? await updatePaymentCheckoutStatus(id, nextStatus)
      : {
          checkout: mapCheckout(data),
          payload: data.payload,
          userId: data.user_id,
        };

  return row;
}

export async function updatePaymentCheckoutStatus(
  id: string,
  status: PaymentCheckoutStatus,
): Promise<{
  checkout: PaymentCheckout;
  payload: Record<string, unknown> | null;
  userId: string | null;
}> {
  const { data, error } = await requireSupabase()
    .from('payment_checkout_sessions')
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select(
      'id,user_id,provider,status,customer_name,customer_email,plan_tier,amount_monthly,currency,payload,created_at,updated_at,expires_at',
    )
    .single<PaymentCheckoutRow>();

  if (error || !data) {
    throw new Error(error?.message || 'Nao foi possivel atualizar a sessao de checkout.');
  }

  return {
    checkout: mapCheckout(data),
    payload: data.payload,
    userId: data.user_id,
  };
}
