import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';

import type {
  FreelancerPlanTier,
  FreelancerSubscriptionWorkspace,
} from '../../shared/contracts';
import { freelancerPlanCatalog } from '../../shared/contracts';
import { useAppSession } from '../context/AppSessionContext';
import { api } from '../lib/api';
import { currencyMonthly, shortDate, shortDateTime } from '../lib/format';
import {
  cnpjContextDescription,
  getCheckoutStatusLabel,
  getCheckoutStatusTone,
  getSubscriptionStatusLabel,
  getSubscriptionStatusTone,
  resolveSubscriptionPlanAction,
  type StatusTone,
} from '../lib/subscription';

const planEntries = Object.entries(freelancerPlanCatalog) as Array<
  [FreelancerPlanTier, (typeof freelancerPlanCatalog)[FreelancerPlanTier]]
>;

const toneClasses: Record<StatusTone, string> = {
  brand: 'border-[#cfe0ff] bg-[#edf5ff] text-[#0f4fd8]',
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  amber: 'border-amber-200 bg-amber-50 text-amber-700',
  rose: 'border-rose-200 bg-rose-50 text-rose-700',
  slate: 'border-slate-200 bg-slate-50 text-slate-600',
};

export function SubscriptionPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { loading: sessionLoading, session } = useAppSession();
  const [workspace, setWorkspace] = useState<FreelancerSubscriptionWorkspace | null>(null);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [actionTier, setActionTier] = useState<FreelancerPlanTier | null>(null);
  const [feedback, setFeedback] = useState<{
    tone: 'error' | 'info' | 'success';
    text: string;
  } | null>(null);
  const [cnpjActive, setCnpjActive] = useState(false);

  const selectedTier = searchParams.get('plan') === 'booster' ? 'booster' : 'normal';

  function selectTier(tier: FreelancerPlanTier) {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('plan', tier);
    setSearchParams(nextParams, { replace: true });
  }

  async function loadWorkspace() {
    if (session?.role !== 'freelancer') {
      setWorkspace(null);
      setWorkspaceError(null);
      setWorkspaceLoading(false);
      return;
    }

    setWorkspaceLoading(true);
    setWorkspaceError(null);

    try {
      const data = await api.getFreelancerSubscriptionWorkspace();
      setWorkspace(data);

      const checkoutContext =
        data.activeCheckout?.context ?? data.latestCheckout?.context ?? null;
      if (typeof checkoutContext?.cnpjActive === 'boolean') {
        setCnpjActive(checkoutContext.cnpjActive);
      }
    } catch (error) {
      setWorkspaceError(
        error instanceof Error ? error.message : 'Não foi possível carregar a assinatura.',
      );
      setWorkspace(null);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  useEffect(() => {
    void loadWorkspace();
  }, [session?.id, session?.role]);

  useEffect(() => {
    if (!searchParams.get('plan')) {
      selectTier('booster');
    }
  }, [searchParams]);

  const subscription = workspace?.subscription ?? null;
  const activeCheckout = workspace?.activeCheckout ?? null;
  const latestCheckout = workspace?.latestCheckout ?? null;
  const subscriptionTone = subscription ? getSubscriptionStatusTone(subscription.status) : 'slate';
  const latestCheckoutTone = latestCheckout ? getCheckoutStatusTone(latestCheckout.status) : 'slate';

  const heroFacts = useMemo(
    () => [
      {
        label: 'Cobrança mensal',
        value: 'A ativação só acontece depois da aprovação do checkout.',
      },
      {
        label: 'Estado real',
        value: 'Plano, status e tentativa de pagamento seguem os dados do Supabase.',
      },
      {
        label: 'Pronto para evoluir',
        value: 'O fluxo já fica preparado para conectar o provedor recorrente depois.',
      },
    ],
    [],
  );

  async function handlePlanAction(planTier: FreelancerPlanTier) {
    if (sessionLoading) {
      return;
    }

    setFeedback(null);

    const action = resolveSubscriptionPlanAction({
      authenticated: Boolean(session),
      planTier,
      role: session?.role,
      workspace,
    });

    if (action.kind === 'login') {
      navigate('/login', {
        state: {
          from: {
            pathname: '/assinatura',
            search: `?plan=${planTier}`,
          },
        },
      });
      return;
    }

    if (action.kind === 'blocked' || action.kind === 'current' || action.kind === 'unavailable') {
      if (action.helper) {
        setFeedback({
          tone: action.kind === 'current' ? 'info' : 'error',
          text: action.helper,
        });
      }
      return;
    }

    if (action.kind === 'continue' && activeCheckout) {
      navigate(`/checkout/freelancer/${activeCheckout.id}`);
      return;
    }

    setActionTier(planTier);

    try {
      const response = await api.startFreelancerSubscriptionCheckout({
        planTier,
        cnpjActive,
        source: 'subscription_page',
      });

      navigate(response.checkoutPath);
    } catch (error) {
      setFeedback({
        tone: 'error',
        text: error instanceof Error ? error.message : 'Não foi possível iniciar o checkout.',
      });
      await loadWorkspace();
    } finally {
      setActionTier(null);
    }
  }

  return (
    <div className="container space-y-8 py-10 sm:space-y-10 sm:py-12 lg:py-14">
      <section className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,#061937_0%,#0b2f6c_48%,#0f4fd8_100%)] px-6 py-8 text-white shadow-[0_28px_70px_rgba(15,79,216,0.24)] sm:px-8 sm:py-10">
        <div className="absolute inset-y-0 right-[-6rem] w-72 rounded-full bg-sky-300/20 blur-[120px]" />
        <div className="absolute left-1/3 top-0 h-48 w-48 rounded-full bg-white/8 blur-[90px]" />

        <div className="relative grid gap-8 xl:grid-cols-[1.08fr_0.92fr] xl:items-end">
          <div className="space-y-6">
            <span className="inline-flex rounded-full border border-white/16 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/80">
              Assinatura mensal freelancer
            </span>

            <div className="space-y-4">
              <h1 className="max-w-4xl text-[2.25rem] font-semibold leading-[0.98] tracking-[-0.05em] sm:text-[3rem] xl:text-[3.5rem]">
                Publique, mantenha e evolua seu perfil com um fluxo de assinatura real.
              </h1>
              <p className="max-w-3xl text-sm leading-7 text-slate-200 sm:text-base">
                A área de planos deixa claro o que muda entre Normal e Booster, mostra o estado da
                sua assinatura e inicia o checkout mensal sem esconder a lógica real do produto.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {heroFacts.map((item) => (
                <div
                  key={item.label}
                  className="rounded-[24px] border border-white/12 bg-white/10 px-4 py-4 backdrop-blur-sm"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-brand-100">
                    {item.label}
                  </p>
                  <p className="mt-2 text-sm leading-6 text-white/90">{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[30px] border border-white/12 bg-white/10 p-6 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-brand-100">
                {session
                  ? session.role === 'freelancer'
                    ? 'Conta freelancer conectada'
                    : 'Conta cliente conectada'
                  : 'Acesso público'}
              </p>
              {subscription ? (
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClasses[subscriptionTone]}`}
                >
                  {getSubscriptionStatusLabel(subscription.status)}
                </span>
              ) : null}
            </div>

            <h2 className="mt-4 text-2xl font-semibold tracking-[-0.04em] text-white">
              {subscription
                ? `${subscription.name} em ${getSubscriptionStatusLabel(subscription.status).toLowerCase()}`
                : 'Planos prontos para ativação mensal'}
            </h2>

            <p className="mt-3 text-sm leading-7 text-slate-200">
              {subscription
                ? `Seu plano atual é ${subscription.name}. A renovação prevista vai até ${shortDate(subscription.endsAt)}.`
                : 'Escolha o plano, siga para o checkout e deixe a ativação refletir no painel assim que houver aprovação.'}
            </p>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row">
              {sessionLoading ? (
                <span className="inline-flex min-h-[44px] items-center rounded-full border border-white/16 bg-white/8 px-5 py-3 text-sm font-semibold text-white/80">
                  Validando sessão...
                </span>
              ) : !session ? (
                <>
                  <Link
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                    to="/login"
                  >
                    Entrar para assinar
                  </Link>
                  <Link
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/16 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
                    to="/cadastro/freelancer"
                  >
                    Criar conta freelancer
                  </Link>
                </>
              ) : session.role === 'client' ? (
                <>
                  <Link
                    className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                    to="/freelancers"
                  >
                    Explorar freelancers
                  </Link>
                  <span className="inline-flex min-h-[44px] items-center rounded-full border border-white/16 bg-white/8 px-5 py-3 text-sm font-semibold text-white/80">
                    Plano indisponível para conta cliente
                  </span>
                </>
              ) : (
                <button
                  className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                  onClick={() => void handlePlanAction(selectedTier)}
                  type="button"
                >
                  {workspaceLoading
                    ? 'Atualizando estado...'
                    : selectedTier === 'booster'
                      ? 'Seguir com Booster'
                      : 'Seguir com Normal'}
                </button>
              )}
            </div>
          </div>
        </div>
      </section>

      {feedback ? (
        <div
          className={`rounded-[28px] px-5 py-4 text-sm ${
            feedback.tone === 'success'
              ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
              : feedback.tone === 'info'
                ? 'border border-brand-100 bg-brand-50 text-brand-700'
                : 'border border-rose-200 bg-rose-50 text-rose-700'
          }`}
        >
          {feedback.text}
        </div>
      ) : null}

      {workspaceError ? (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {workspaceError}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.14fr_0.86fr]">
        <div className="grid gap-6 lg:grid-cols-2">
          {planEntries.map(([tier, plan]) => {
            const action = resolveSubscriptionPlanAction({
              authenticated: Boolean(session),
              planTier: tier,
              role: session?.role,
              workspace,
            });
            const isBooster = tier === 'booster';
            const isSelected = selectedTier === tier;
            const isCurrent = subscription?.tier === tier && subscription.status === 'active';
            const isPendingTarget = activeCheckout?.planTier === tier;

            return (
              <article
                key={tier}
                className={`relative overflow-hidden rounded-[32px] border p-6 shadow-[0_18px_44px_rgba(15,23,42,0.05)] transition ${
                  isBooster
                    ? 'border-[#0f4fd8]/18 bg-[linear-gradient(180deg,#ffffff_0%,#f3f8ff_100%)]'
                    : 'border-slate-200 bg-white/94'
                } ${
                  isSelected
                    ? 'ring-4 ring-[#0f4fd8]/10'
                    : 'hover:border-slate-300 hover:shadow-[0_22px_54px_rgba(15,23,42,0.07)]'
                }`}
              >
                {isBooster ? (
                  <div className="absolute right-0 top-0 h-28 w-28 rounded-full bg-[radial-gradient(circle,rgba(15,79,216,0.14)_0%,rgba(15,79,216,0)_72%)]" />
                ) : null}

                <div className="relative flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {isBooster ? 'Plano premium' : 'Plano base'}
                    </p>
                    <h2 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                      {plan.name}
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{plan.summary}</p>
                  </div>

                  <div className="flex flex-col items-end gap-2">
                    {isBooster ? (
                      <span className="rounded-full border border-[#cfe0ff] bg-[#edf5ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0f4fd8]">
                        Destaque
                      </span>
                    ) : null}
                    {isCurrent ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">
                        Atual
                      </span>
                    ) : null}
                    {isPendingTarget ? (
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
                        Em andamento
                      </span>
                    ) : null}
                  </div>
                </div>

                <button
                  className={`mt-5 inline-flex min-h-[40px] items-center rounded-full border px-4 text-[11px] font-semibold uppercase tracking-[0.16em] transition ${
                    isSelected
                      ? 'border-[#0f4fd8]/18 bg-[#edf5ff] text-[#0f4fd8]'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-950'
                  }`}
                  onClick={() => selectTier(tier)}
                  type="button"
                >
                  {isSelected ? 'Plano em foco' : 'Ler este plano'}
                </button>

                <div className="mt-6 rounded-[28px] border border-slate-200/80 bg-white/90 px-5 py-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Valor mensal
                  </p>
                  <p className="mt-3 text-[2.45rem] font-semibold tracking-[-0.06em] text-slate-950">
                    {currencyMonthly(plan.priceMonthly)}
                    <span className="ml-1 text-base font-medium text-slate-500">/mês</span>
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-500">
                    Cobrança recorrente mensal com ativação só após pagamento aprovado.
                  </p>
                </div>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li
                      key={feature}
                      className="rounded-[22px] border border-slate-200/80 bg-white/88 px-4 py-3 text-sm leading-6 text-slate-600"
                    >
                      {feature}
                    </li>
                  ))}
                </ul>

                {isBooster ? (
                  <div className="mt-6 rounded-[24px] border border-[#cfe0ff] bg-[#edf5ff] px-4 py-4 text-sm leading-6 text-slate-700">
                    <p className="font-semibold text-[#0f4fd8]">Cenário com CNPJ ativo</p>
                    <p className="mt-2">{cnpjContextDescription}</p>
                  </div>
                ) : (
                  <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                    Entrada mais enxuta para colocar o perfil no ar e operar com clareza desde o
                    primeiro mês.
                  </div>
                )}

                <div className="mt-6 space-y-3">
                  <button
                    className={`w-full rounded-full px-6 py-3 text-sm font-semibold transition ${
                      action.disabled
                        ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400'
                        : isBooster
                          ? 'bg-[#0f4fd8] text-white shadow-[0_14px_32px_rgba(15,79,216,0.2)] hover:bg-[#1558e8]'
                          : 'bg-slate-950 text-white hover:bg-slate-800'
                    }`}
                    disabled={action.disabled || actionTier === tier || workspaceLoading || sessionLoading}
                    onClick={() => void handlePlanAction(tier)}
                    type="button"
                  >
                    {actionTier === tier ? 'Processando...' : action.label}
                  </button>

                  {action.helper ? (
                    <p className="text-sm leading-6 text-slate-500">{action.helper}</p>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>

        <aside className="space-y-6">
          <article className="glass-panel rounded-[32px] p-6 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Status atual
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                  {subscription ? subscription.name : 'Sem assinatura ativa'}
                </h3>
              </div>
              {subscription ? (
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClasses[subscriptionTone]}`}
                >
                  {getSubscriptionStatusLabel(subscription.status)}
                </span>
              ) : null}
            </div>

            {sessionLoading || workspaceLoading ? (
              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Sincronizando assinatura com o Supabase...
              </div>
            ) : subscription ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Plano em vigor
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{subscription.name}</p>
                  <p className="mt-2 text-sm text-slate-600">
                    {currencyMonthly(subscription.priceMonthly)}/mês
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Início
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {shortDate(subscription.startedAt)}
                    </p>
                  </div>
                  <div className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                      Próximo marco
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      {shortDate(subscription.endsAt)}
                    </p>
                  </div>
                </div>

                <div className="rounded-[24px] border border-brand-100 bg-brand-50 px-4 py-4 text-sm leading-6 text-brand-700">
                  O front só muda o plano visível depois de persistir o estado correto no banco.
                </div>
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                Entre como freelancer para ver o plano atual, o histórico do checkout e a próxima
                renovação.
              </div>
            )}
          </article>

          <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_14px_42px_rgba(15,23,42,0.05)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Checkout
                </p>
                <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                  {latestCheckout ? latestCheckout.planName : 'Nenhuma tentativa recente'}
                </h3>
              </div>
              {latestCheckout ? (
                <span
                  className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${toneClasses[latestCheckoutTone]}`}
                >
                  {getCheckoutStatusLabel(latestCheckout.status)}
                </span>
              ) : null}
            </div>

            {latestCheckout ? (
              <div className="mt-5 space-y-3">
                <div className="rounded-[24px] border border-slate-200/80 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-950">
                    {currencyMonthly(latestCheckout.amountMonthly)}/mês
                  </p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    Criado em {shortDateTime(latestCheckout.createdAt)} e válido até{' '}
                    {shortDateTime(latestCheckout.expiresAt)}.
                  </p>
                </div>

                {latestCheckout.context ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Fluxo
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        {latestCheckout.context.changeType === 'upgrade'
                          ? 'Upgrade'
                          : latestCheckout.context.changeType === 'renewal'
                            ? 'Renovação'
                            : 'Ativação'}
                      </p>
                    </div>
                    <div className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                        Contexto
                      </p>
                      <p className="mt-2 text-sm font-semibold text-slate-950">
                        {latestCheckout.context.cnpjActive ? 'CNPJ ativo' : 'Pessoa física'}
                      </p>
                    </div>
                  </div>
                ) : null}

                {activeCheckout ? (
                  <Link
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-full bg-[#0f4fd8] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1558e8]"
                    to={`/checkout/freelancer/${activeCheckout.id}`}
                  >
                    Continuar checkout
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
                Quando uma tentativa de pagamento for criada, ela aparece aqui com o status real do
                checkout e o contexto usado na assinatura.
              </div>
            )}
          </article>

          <article className="rounded-[32px] border border-[#cfe0ff] bg-[linear-gradient(180deg,#f8fbff_0%,#edf5ff_100%)] p-6 shadow-[0_18px_50px_rgba(15,79,216,0.08)]">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0f4fd8]">
              Contexto comercial
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              CNPJ ativo no checkout
            </h3>
            <p className="mt-3 text-sm leading-7 text-slate-600">{cnpjContextDescription}</p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {[
                { label: 'Pessoa física', value: false },
                { label: 'CNPJ ativo', value: true },
              ].map((option) => {
                const selected = cnpjActive === option.value;

                return (
                  <button
                    key={option.label}
                    className={`rounded-[24px] border px-4 py-4 text-left transition ${
                      selected
                        ? 'border-[#0f4fd8]/24 bg-white text-slate-950 shadow-[0_12px_30px_rgba(15,79,216,0.08)]'
                        : 'border-white/80 bg-white/70 text-slate-600 hover:border-[#cfe0ff] hover:bg-white'
                    }`}
                    onClick={() => setCnpjActive(option.value)}
                    type="button"
                  >
                    <p className="text-sm font-semibold">{option.label}</p>
                    <p className="mt-2 text-sm leading-6">
                      {option.value
                        ? 'Leva o contexto comercial para a tentativa atual sem alterar a modelagem central.'
                        : 'Mantém o checkout no cenário padrão da conta freelancer.'}
                    </p>
                  </button>
                );
              })}
            </div>
          </article>
        </aside>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_14px_42px_rgba(15,23,42,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Resumo rápido
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
            O que muda entre Normal e Booster
          </h2>

          <div className="mt-5 space-y-3">
            <div className="rounded-[24px] border border-slate-200/80 bg-slate-50 px-4 py-4">
              <p className="text-sm font-semibold text-slate-950">Plano Normal</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                Base para publicar o perfil, manter o painel operacional e receber o primeiro fluxo
                mensal com clareza.
              </p>
            </div>

            <div className="rounded-[24px] border border-[#cfe0ff] bg-[#edf5ff] px-4 py-4">
              <p className="text-sm font-semibold text-slate-950">Plano Booster</p>
              <p className="mt-2 text-sm leading-6 text-slate-700">
                Camada premium para reforçar a presença comercial, ganhar identificação visual e
                deixar a conta pronta para novas evoluções de destaque.
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200/80 bg-white px-4 py-4 text-sm leading-6 text-slate-600">
              Se você já está no Normal, o upgrade para Booster abre um novo checkout mensal sem
              trocar o estado visual antes da persistência real no banco.
            </div>
          </div>
        </article>

        <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_14px_42px_rgba(15,23,42,0.05)]">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Dúvidas rápidas
          </p>
          <div className="mt-5 grid gap-3">
            {[
              {
                question: 'Quando o plano fica ativo?',
                answer: 'Só depois de um checkout aprovado. Antes disso, a interface mostra o status real da tentativa.',
              },
              {
                question: 'Cliente pode contratar plano?',
                answer: 'Não. A assinatura mensal é exclusiva para contas freelancer e o bloqueio acontece com mensagem clara.',
              },
              {
                question: 'Posso tentar de novo se falhar?',
                answer: 'Sim. A tentativa fica rastreada no checkout e você pode gerar uma nova sessão sem duplicar ativação.',
              },
              {
                question: 'O cenário com CNPJ ativo já está considerado?',
                answer: 'Sim. O contexto entra no checkout desta fase e deixa o fluxo pronto para regras futuras sem mudar a base central agora.',
              },
            ].map((item) => (
              <div key={item.question} className="rounded-[24px] border border-slate-200/80 bg-slate-50 px-4 py-4">
                <p className="text-sm font-semibold text-slate-950">{item.question}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}
