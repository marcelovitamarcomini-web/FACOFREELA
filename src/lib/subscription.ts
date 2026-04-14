import type {
  FreelancerPlanTier,
  FreelancerSubscriptionWorkspace,
  PaymentCheckout,
  PaymentCheckoutStatus,
  SubscriptionStatus,
  UserRole,
} from '../../shared/contracts';

export type StatusTone = 'brand' | 'emerald' | 'amber' | 'rose' | 'slate';

export interface SubscriptionPlanAction {
  kind: 'login' | 'blocked' | 'current' | 'continue' | 'start' | 'unavailable';
  label: string;
  disabled: boolean;
  helper?: string;
}

export const cnpjContextDescription =
  'CNPJ ativo entra como contexto comercial do checkout e fica pronto para regras futuras sem criar um fluxo paralelo agora.';

export function getSubscriptionStatusLabel(status: SubscriptionStatus) {
  switch (status) {
    case 'active':
      return 'Ativa';
    case 'pending':
      return 'Pendente';
    case 'expired':
      return 'Expirada';
    case 'canceled':
      return 'Cancelada';
    case 'past_due':
      return 'Em atraso';
    default:
      return 'Ativa';
  }
}

export function getSubscriptionStatusTone(status: SubscriptionStatus): StatusTone {
  switch (status) {
    case 'active':
      return 'emerald';
    case 'pending':
    case 'past_due':
      return 'amber';
    case 'expired':
    case 'canceled':
      return 'rose';
    default:
      return 'slate';
  }
}

export function getCheckoutStatusLabel(status: PaymentCheckoutStatus) {
  switch (status) {
    case 'open':
      return 'Aguardando pagamento';
    case 'approved':
      return 'Aprovado';
    case 'pending':
      return 'Pendente';
    case 'failed':
      return 'Falhou';
    case 'expired':
      return 'Expirado';
    default:
      return 'Checkout';
  }
}

export function getCheckoutStatusTone(status: PaymentCheckoutStatus): StatusTone {
  switch (status) {
    case 'approved':
      return 'emerald';
    case 'open':
    case 'pending':
      return 'amber';
    case 'failed':
    case 'expired':
      return 'rose';
    default:
      return 'slate';
  }
}

export function isCheckoutInProgress(checkout?: PaymentCheckout | null) {
  return checkout?.status === 'open' || checkout?.status === 'pending';
}

export function resolveSubscriptionPlanAction(input: {
  authenticated: boolean;
  planTier: FreelancerPlanTier;
  role?: UserRole;
  workspace?: FreelancerSubscriptionWorkspace | null;
}): SubscriptionPlanAction {
  if (!input.authenticated) {
    return {
      kind: 'login',
      label: 'Entrar para assinar',
      disabled: false,
      helper: 'O login valida a conta antes do checkout.',
    };
  }

  if (input.role === 'client') {
    return {
      kind: 'blocked',
      label: 'Plano indisponível',
      disabled: true,
      helper: 'Assinaturas mensais são liberadas apenas para contas freelancer.',
    };
  }

  const workspace = input.workspace;
  if (!workspace) {
    return {
      kind: 'start',
      label: input.planTier === 'booster' ? 'Assinar Booster' : 'Assinar Normal',
      disabled: false,
    };
  }

  const { activeCheckout, latestCheckout, subscription } = workspace;

  if (subscription.status === 'active' && subscription.tier === input.planTier) {
    return {
      kind: 'current',
      label: 'Plano atual',
      disabled: true,
      helper: 'Esta assinatura já está ativa na sua conta.',
    };
  }

  if (activeCheckout && isCheckoutInProgress(activeCheckout)) {
    if (activeCheckout.planTier === input.planTier) {
      return {
        kind: 'continue',
        label: activeCheckout.status === 'pending' ? 'Pagamento pendente' : 'Continuar checkout',
        disabled: false,
        helper: 'Existe uma tentativa em andamento para este plano.',
      };
    }

    return {
      kind: 'unavailable',
      label: 'Plano indisponível',
      disabled: true,
      helper: 'Conclua ou aguarde o checkout atual antes de trocar de plano.',
    };
  }

  if (subscription.status === 'active' && subscription.tier === 'booster' && input.planTier === 'normal') {
    return {
      kind: 'unavailable',
      label: 'Plano indisponível',
      disabled: true,
      helper: 'O downgrade será liberado junto da integração recorrente completa.',
    };
  }

  if (latestCheckout?.planTier === input.planTier && latestCheckout.status === 'failed') {
    return {
      kind: 'start',
      label: subscription.status === 'active' ? 'Tentar upgrade novamente' : 'Gerar novo checkout',
      disabled: false,
      helper: 'A tentativa anterior falhou e pode ser refeita agora.',
    };
  }

  if (latestCheckout?.planTier === input.planTier && latestCheckout.status === 'expired') {
    return {
      kind: 'start',
      label: 'Gerar novo checkout',
      disabled: false,
      helper: 'A sessão anterior expirou antes da aprovação.',
    };
  }

  if (subscription.status === 'active' && subscription.tier === 'normal' && input.planTier === 'booster') {
    return {
      kind: 'start',
      label: 'Fazer upgrade',
      disabled: false,
      helper: 'O Booster entra no fluxo mensal assim que o checkout for aprovado.',
    };
  }

  if (
    (subscription.status === 'expired' || subscription.status === 'canceled') &&
    subscription.tier === input.planTier
  ) {
    return {
      kind: 'start',
      label: 'Reativar plano',
      disabled: false,
      helper: 'Uma nova sessão reativa a assinatura mensal deste plano.',
    };
  }

  return {
    kind: 'start',
    label: input.planTier === 'booster' ? 'Assinar Booster' : 'Assinar Normal',
    disabled: false,
    helper: 'A cobrança é mensal e a ativação só acontece após aprovação.',
  };
}
