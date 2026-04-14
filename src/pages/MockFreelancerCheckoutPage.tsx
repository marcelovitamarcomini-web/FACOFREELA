import type { ChangeEvent, FormEvent } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import type { PaymentCheckout } from '../../shared/contracts';
import { useAppSession } from '../context/AppSessionContext';
import { currencyMonthly, shortDateTime } from '../lib/format';
import { api } from '../lib/api';

type CheckoutOutcome = 'approved' | 'pending' | 'failed';

interface CheckoutFormState {
  cardholderName: string;
  documentNumber: string;
  cardNumber: string;
  expiry: string;
  cvv: string;
  agreeRecurring: boolean;
}

type CheckoutFormErrors = Partial<
  Record<'cardholderName' | 'documentNumber' | 'cardNumber' | 'expiry' | 'cvv' | 'agreeRecurring', string>
>;

const inputClassName =
  'mt-2 w-full rounded-[22px] border border-slate-200/90 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-[#0f4fd8]/40 focus:ring-4 focus:ring-[#0f4fd8]/10 disabled:cursor-not-allowed disabled:bg-slate-50';

function resultPath(status: PaymentCheckout['status'], checkoutId: string) {
  const pathname =
    status === 'approved'
      ? '/pagamento/aprovado'
      : status === 'expired'
        ? '/pagamento/expirado'
        : status === 'pending'
          ? '/pagamento/pendente'
          : '/pagamento/recusado';

  return `${pathname}?checkout=${encodeURIComponent(checkoutId)}`;
}

function onlyDigits(value: string) {
  return value.replace(/\D/g, '');
}

function formatCardNumber(value: string) {
  return onlyDigits(value)
    .slice(0, 19)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
    .trim();
}

function formatExpiry(value: string) {
  const digits = onlyDigits(value).slice(0, 4);
  if (digits.length <= 2) {
    return digits;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function formatDocumentNumber(value: string) {
  const digits = onlyDigits(value).slice(0, 14);

  if (digits.length <= 11) {
    if (digits.length <= 3) {
      return digits;
    }

    if (digits.length <= 6) {
      return `${digits.slice(0, 3)}.${digits.slice(3)}`;
    }

    if (digits.length <= 9) {
      return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
    }

    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9)}`;
  }

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 5) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }

  if (digits.length <= 8) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5)}`;
  }

  if (digits.length <= 12) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12)}`;
}

function maskCardPreview(value: string) {
  const digits = onlyDigits(value);
  if (!digits) {
    return '0000 0000 0000 0000';
  }

  return digits
    .padEnd(16, '0')
    .slice(0, 16)
    .replace(/(\d{4})(?=\d)/g, '$1 ')
    .trim();
}

function inferCardBrand(value: string) {
  const digits = onlyDigits(value);

  if (/^4/.test(digits)) {
    return 'Visa';
  }

  if (/^(5[1-5]|2[2-7])/.test(digits)) {
    return 'Mastercard';
  }

  if (/^3[47]/.test(digits)) {
    return 'Amex';
  }

  if (/^(4011|4312|4389|4514|4576|5041|5066|509|6277|6362|6363|650|6516|6550)/.test(digits)) {
    return 'Elo';
  }

  return 'Cartao';
}

function isValidCardNumber(value: string) {
  const digits = onlyDigits(value);
  if (digits.length < 13 || digits.length > 19) {
    return false;
  }

  let sum = 0;
  let shouldDouble = false;

  for (let index = digits.length - 1; index >= 0; index -= 1) {
    let current = Number(digits[index]);

    if (shouldDouble) {
      current *= 2;
      if (current > 9) {
        current -= 9;
      }
    }

    sum += current;
    shouldDouble = !shouldDouble;
  }

  return sum % 10 === 0;
}

function isValidExpiry(value: string) {
  const digits = onlyDigits(value);
  if (digits.length !== 4) {
    return false;
  }

  const month = Number(digits.slice(0, 2));
  const year = Number(`20${digits.slice(2)}`);

  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return false;
  }

  const now = new Date();
  const expiryDate = new Date(year, month, 0, 23, 59, 59, 999);

  return expiryDate.getTime() >= now.getTime();
}

function validateCheckoutForm(form: CheckoutFormState) {
  const errors: CheckoutFormErrors = {};

  if (form.cardholderName.trim().split(/\s+/).filter(Boolean).length < 2) {
    errors.cardholderName = 'Informe o nome como aparece no cartao.';
  }

  const documentDigits = onlyDigits(form.documentNumber);
  if (documentDigits.length !== 11 && documentDigits.length !== 14) {
    errors.documentNumber = 'Informe um CPF ou CNPJ valido.';
  }

  if (!isValidCardNumber(form.cardNumber)) {
    errors.cardNumber = 'Confira o numero do cartao.';
  }

  if (!isValidExpiry(form.expiry)) {
    errors.expiry = 'Confira a validade do cartao.';
  }

  const cvvDigits = onlyDigits(form.cvv);
  if (cvvDigits.length < 3 || cvvDigits.length > 4) {
    errors.cvv = 'Informe um CVV valido.';
  }

  if (!form.agreeRecurring) {
    errors.agreeRecurring = 'Confirme a cobranca mensal para continuar.';
  }

  return errors;
}

function getChangeTypeLabel(checkout?: PaymentCheckout | null) {
  switch (checkout?.context?.changeType) {
    case 'upgrade':
      return 'Upgrade';
    case 'renewal':
      return 'Renovacao';
    default:
      return 'Ativacao';
  }
}

function getPrimaryActionLabel(checkout?: PaymentCheckout | null) {
  switch (checkout?.context?.changeType) {
    case 'upgrade':
      return 'Pagar e concluir upgrade';
    case 'renewal':
      return 'Pagar e renovar plano';
    default:
      return 'Pagar e ativar plano';
  }
}

export function MockFreelancerCheckoutPage() {
  const navigate = useNavigate();
  const { checkoutId = '' } = useParams();
  const { session } = useAppSession();
  const [checkout, setCheckout] = useState<PaymentCheckout | null>(null);
  const [loading, setLoading] = useState(true);
  const [submittingAction, setSubmittingAction] = useState<CheckoutOutcome | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [formErrors, setFormErrors] = useState<CheckoutFormErrors>({});
  const [form, setForm] = useState<CheckoutFormState>({
    cardholderName: '',
    documentNumber: '',
    cardNumber: '',
    expiry: '',
    cvv: '',
    agreeRecurring: false,
  });

  useEffect(() => {
    let cancelled = false;

    async function loadCheckout() {
      if (!checkoutId) {
        setStatus('Checkout invalido.');
        setLoading(false);
        return;
      }

      try {
        const response = await api.getPaymentCheckout(checkoutId);
        if (cancelled) {
          return;
        }

        setCheckout(response.checkout);
        if (response.checkout.status !== 'open') {
          navigate(resultPath(response.checkout.status, checkoutId), { replace: true });
          return;
        }
      } catch (error) {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : 'Nao foi possivel carregar o checkout.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadCheckout();

    return () => {
      cancelled = true;
    };
  }, [checkoutId, navigate]);

  useEffect(() => {
    if (!checkout) {
      return;
    }

    setForm((current) => ({
      ...current,
      cardholderName: current.cardholderName || checkout.customerName,
    }));
  }, [checkout]);

  const cardBrand = useMemo(() => inferCardBrand(form.cardNumber), [form.cardNumber]);
  const primaryActionLabel = useMemo(() => getPrimaryActionLabel(checkout), [checkout]);
  const checkoutPhaseLabel = useMemo(() => getChangeTypeLabel(checkout), [checkout]);

  function updateField<K extends keyof CheckoutFormState>(field: K, value: CheckoutFormState[K]) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));

    setFormErrors((current) => {
      const next = { ...current };
      delete next[field as keyof CheckoutFormErrors];
      return next;
    });
  }

  function handleInputChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;

    switch (name) {
      case 'cardholderName':
        updateField('cardholderName', value);
        break;
      case 'documentNumber':
        updateField('documentNumber', formatDocumentNumber(value));
        break;
      case 'cardNumber':
        updateField('cardNumber', formatCardNumber(value));
        break;
      case 'expiry':
        updateField('expiry', formatExpiry(value));
        break;
      case 'cvv':
        updateField('cvv', onlyDigits(value).slice(0, 4));
        break;
      default:
        break;
    }
  }

  async function handleOutcome(outcome: CheckoutOutcome) {
    if (!checkoutId || !checkout) {
      return;
    }

    const validationErrors = validateCheckoutForm(form);
    if (Object.keys(validationErrors).length > 0) {
      setFormErrors(validationErrors);
      setStatus('Revise os dados do cartao antes de continuar.');
      return;
    }

    setSubmittingAction(outcome);
    setStatus(null);

    try {
      const response = await api.completeFreelancerMockCheckout(checkoutId, outcome);
      navigate(response.redirectPath, { replace: true });
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Nao foi possivel concluir o checkout.');
      setSubmittingAction(null);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void handleOutcome('approved');
  }

  if (loading) {
    return (
      <div className="container py-10 sm:py-12 lg:py-14">
        <div className="glass-panel rounded-[30px] px-6 py-8 text-sm text-slate-500 shadow-soft">
          Carregando checkout...
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-6xl space-y-8 py-10 sm:space-y-10 sm:py-12 lg:py-14">
      <section className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(135deg,#07162f_0%,#0b2f6c_48%,#0f4fd8_100%)] px-6 py-8 text-white shadow-[0_24px_70px_rgba(15,79,216,0.24)] sm:px-8 sm:py-10">
        <div className="absolute inset-y-0 right-[-5rem] w-72 rounded-full bg-sky-300/20 blur-[120px]" />
        <div className="absolute left-8 top-6 h-32 w-32 rounded-full bg-white/10 blur-[90px]" />

        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="flex flex-wrap items-center gap-3">
              <span className="inline-flex rounded-full border border-white/14 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/84">
                Checkout mensal
              </span>
              <span className="inline-flex rounded-full border border-white/14 bg-white/10 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/84">
                Ambiente de teste
              </span>
            </div>

            <h1 className="mt-4 text-[2rem] font-semibold leading-[1.02] tracking-[-0.05em] text-white sm:text-[2.8rem]">
              Agora voce vai ver o checkout como experiencia de pagamento, com cartao, resumo e validacao visual.
            </h1>

            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-200 sm:text-base">
              O formulario abaixo simula a etapa do gateway com cara de produto real. A aprovacao,
              pendencia ou recusa continuam persistindo no Supabase para manter o fluxo fiel ao
              sistema.
            </p>
          </div>

          {session?.role === 'freelancer' ? (
            <Link
              className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-white/16 bg-white/10 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/14"
              to="/assinatura"
            >
              Voltar para assinatura
            </Link>
          ) : null}
        </div>
      </section>

      {status ? (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {status}
        </div>
      ) : null}

      <section className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
        <article className="glass-panel rounded-[34px] p-6 shadow-soft sm:p-7">
          <div className="flex flex-wrap items-center gap-3">
            <span className="inline-flex rounded-full border border-[#cfe0ff] bg-[#edf5ff] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0f4fd8]">
              Cartao de credito
            </span>
            <span className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Cobranca recorrente mensal
            </span>
          </div>

          <div className="mt-5 rounded-[30px] bg-[linear-gradient(135deg,#081225_0%,#0d2f6a_55%,#1f79ff_100%)] p-6 text-white shadow-[0_22px_60px_rgba(15,79,216,0.22)]">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/72">
                  Pagamento seguro
                </p>
                <p className="mt-2 text-sm text-white/78">Faço Freela</p>
              </div>
              <span className="rounded-full border border-white/14 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/88">
                {cardBrand}
              </span>
            </div>

            <p className="mt-10 text-[1.8rem] font-semibold tracking-[0.28em] text-white sm:text-[2rem]">
              {maskCardPreview(form.cardNumber)}
            </p>

            <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                  Titular
                </p>
                <p className="mt-2 text-sm font-semibold text-white/92">
                  {form.cardholderName.trim() || 'NOME NO CARTAO'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-white/60">
                  Validade
                </p>
                <p className="mt-2 text-sm font-semibold text-white/92">{form.expiry || 'MM/AA'}</p>
              </div>
            </div>
          </div>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit}>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Nome no cartao</span>
                <input
                  autoComplete="cc-name"
                  className={inputClassName}
                  disabled={submittingAction !== null}
                  name="cardholderName"
                  onChange={handleInputChange}
                  placeholder="Como aparece no cartao"
                  type="text"
                  value={form.cardholderName}
                />
                {formErrors.cardholderName ? (
                  <p className="mt-2 text-sm text-rose-600">{formErrors.cardholderName}</p>
                ) : null}
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">CPF ou CNPJ do pagador</span>
                <input
                  className={inputClassName}
                  disabled={submittingAction !== null}
                  inputMode="numeric"
                  name="documentNumber"
                  onChange={handleInputChange}
                  placeholder="000.000.000-00"
                  type="text"
                  value={form.documentNumber}
                />
                {formErrors.documentNumber ? (
                  <p className="mt-2 text-sm text-rose-600">{formErrors.documentNumber}</p>
                ) : null}
              </label>
            </div>

            <label className="block">
              <span className="text-sm font-semibold text-slate-700">Numero do cartao</span>
              <input
                autoComplete="cc-number"
                className={inputClassName}
                disabled={submittingAction !== null}
                inputMode="numeric"
                name="cardNumber"
                onChange={handleInputChange}
                placeholder="0000 0000 0000 0000"
                type="text"
                value={form.cardNumber}
              />
              {formErrors.cardNumber ? (
                <p className="mt-2 text-sm text-rose-600">{formErrors.cardNumber}</p>
              ) : null}
            </label>

            <div className="grid gap-4 sm:grid-cols-[0.9fr_0.6fr_1fr]">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Validade</span>
                <input
                  autoComplete="cc-exp"
                  className={inputClassName}
                  disabled={submittingAction !== null}
                  inputMode="numeric"
                  name="expiry"
                  onChange={handleInputChange}
                  placeholder="MM/AA"
                  type="text"
                  value={form.expiry}
                />
                {formErrors.expiry ? (
                  <p className="mt-2 text-sm text-rose-600">{formErrors.expiry}</p>
                ) : null}
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">CVV</span>
                <input
                  autoComplete="cc-csc"
                  className={inputClassName}
                  disabled={submittingAction !== null}
                  inputMode="numeric"
                  name="cvv"
                  onChange={handleInputChange}
                  placeholder="123"
                  type="password"
                  value={form.cvv}
                />
                {formErrors.cvv ? (
                  <p className="mt-2 text-sm text-rose-600">{formErrors.cvv}</p>
                ) : null}
              </label>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Cobranca
                </p>
                <p className="mt-2 text-sm font-semibold text-slate-950">Mensal recorrente</p>
                <p className="mt-1 text-sm leading-6 text-slate-600">
                  {checkout ? currencyMonthly(checkout.amountMonthly) : '--'} por mes.
                </p>
              </div>
            </div>

            <div className="rounded-[26px] border border-[#cfe0ff] bg-[linear-gradient(180deg,#f8fbff_0%,#edf5ff_100%)] px-5 py-4">
              <div className="flex gap-3">
                <input
                  checked={form.agreeRecurring}
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-[#0f4fd8] focus:ring-[#0f4fd8]"
                  disabled={submittingAction !== null}
                  onChange={(event) => updateField('agreeRecurring', event.target.checked)}
                  type="checkbox"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    Entendo que a cobranca deste plano e mensal.
                  </p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    A ativacao visual do plano so acontece depois da aprovacao da tentativa atual.
                  </p>
                  {formErrors.agreeRecurring ? (
                    <p className="mt-2 text-sm text-rose-600">{formErrors.agreeRecurring}</p>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-full bg-[#0f4fd8] px-6 py-3 text-sm font-semibold text-white shadow-[0_18px_36px_rgba(15,79,216,0.2)] transition hover:bg-[#1558e8] disabled:cursor-not-allowed disabled:bg-slate-300"
                disabled={submittingAction !== null || !checkout}
                type="submit"
              >
                {submittingAction === 'approved' ? 'Processando pagamento...' : primaryActionLabel}
              </button>

              <Link
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                to="/assinatura"
              >
                Revisar planos
              </Link>
            </div>
          </form>

          <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
            Nesta fase, os dados do cartao validam a UX do checkout e a navegacao da etapa de
            pagamento. O retorno ainda e mock, mas o resultado final segue real no Supabase.
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_14px_42px_rgba(15,23,42,0.05)] sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Resumo da assinatura
            </p>

            <div className="mt-5 rounded-[28px] border border-slate-200 bg-slate-50 px-5 py-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-500">Plano</p>
                  <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                    {checkout?.planName ?? '--'}
                  </p>
                </div>
                <span className="rounded-full border border-[#cfe0ff] bg-[#edf5ff] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0f4fd8]">
                  {checkoutPhaseLabel}
                </span>
              </div>

              <p className="mt-5 text-[2.7rem] font-semibold tracking-[-0.06em] text-slate-950">
                {checkout ? currencyMonthly(checkout.amountMonthly) : '--'}
                <span className="ml-1 text-base font-medium text-slate-500">/mes</span>
              </p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-white bg-white px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Checkout criado
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {checkout ? shortDateTime(checkout.createdAt) : '--'}
                  </p>
                </div>

                <div className="rounded-[22px] border border-white bg-white px-4 py-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Validade da sessao
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">
                    {checkout ? shortDateTime(checkout.expiresAt) : '--'}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Conta
                </p>
                <p className="mt-2 text-base font-semibold text-slate-950">
                  {checkout?.customerName ?? '--'}
                </p>
                <p className="mt-1 text-sm text-slate-600">{checkout?.customerEmail ?? '--'}</p>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-white px-5 py-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                  Status atual
                </p>
                <p className="mt-2 text-base font-semibold capitalize text-slate-950">
                  {checkout?.status ?? '--'}
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Fluxo pronto para provedor recorrente.
                </p>
              </div>
            </div>

            {checkout?.context ? (
              <div className="mt-4 rounded-[24px] border border-[#cfe0ff] bg-[#edf5ff] px-5 py-4 text-sm leading-6 text-slate-700">
                <p className="font-semibold text-[#0f4fd8]">Contexto do checkout</p>
                <p className="mt-2">
                  Tipo: {checkoutPhaseLabel}. Origem: {checkout.context.source.replace('_', ' ')}.
                </p>
                <p className="mt-1">
                  Perfil comercial: {checkout.context.cnpjActive ? 'CNPJ ativo' : 'Pessoa fisica'}.
                </p>
              </div>
            ) : null}
          </article>

          <article className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-[0_14px_42px_rgba(15,23,42,0.05)] sm:p-7">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              Simular retorno do gateway
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
              Teste outros estados sem sair do checkout.
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Se quiser validar o produto inteiro, use os botoes abaixo para reproduzir pendencia ou
              recusa depois de preencher o formulario.
            </p>

            <div className="mt-5 space-y-3">
              <button
                className="w-full rounded-full border border-amber-200 bg-amber-50 px-6 py-3 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submittingAction !== null || !checkout}
                onClick={() => void handleOutcome('pending')}
                type="button"
              >
                {submittingAction === 'pending' ? 'Processando...' : 'Marcar pagamento como pendente'}
              </button>

              <button
                className="w-full rounded-full border border-rose-200 bg-rose-50 px-6 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={submittingAction !== null || !checkout}
                onClick={() => void handleOutcome('failed')}
                type="button"
              >
                {submittingAction === 'failed' ? 'Processando...' : 'Simular pagamento recusado'}
              </button>
            </div>

            <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">
              No provedor real, esta tela enviaria o cartao para tokenizacao e voltaria com o
              resultado final. Aqui a aparencia e a experiencia de checkout ja ficam prontas para
              essa troca futura.
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
