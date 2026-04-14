import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import type { PaymentCheckout } from '../../shared/contracts';
import { useAppSession } from '../context/AppSessionContext';
import { currencyMonthly } from '../lib/format';
import { api } from '../lib/api';

export function PaymentApprovedPage() {
  const [searchParams] = useSearchParams();
  const { session } = useAppSession();
  const [checkout, setCheckout] = useState<PaymentCheckout | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    const checkoutId = searchParams.get('checkout');
    if (!checkoutId) {
      setStatus('Checkout não informado.');
      return;
    }

    let cancelled = false;
    void api
      .getPaymentCheckout(checkoutId)
      .then((response) => {
        if (!cancelled) {
          setCheckout(response.checkout);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setStatus(error instanceof Error ? error.message : 'Não foi possível carregar o pagamento.');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  return (
    <div className="container max-w-4xl space-y-8 py-10 sm:space-y-10 sm:py-12 lg:py-14">
      <section className="rounded-[36px] border border-emerald-200 bg-[linear-gradient(180deg,#ffffff_0%,#f3fff8_100%)] p-6 shadow-[0_18px_50px_rgba(15,23,42,0.05)] sm:p-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
          Pagamento aprovado
        </p>
        <h1 className="mt-3 text-[2rem] font-semibold leading-[1.03] tracking-[-0.045em] text-slate-950 sm:text-[2.7rem]">
          Plano ativado com sucesso.
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
          Seu cadastro freelancer já pode seguir com o plano selecionado. Se a sessão da conta já
          estiver ativa, você pode ir direto para a área de assinatura para acompanhar o estado real.
        </p>
      </section>

      <section className="glass-panel rounded-[32px] p-6 shadow-soft sm:p-7">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Resumo
        </p>

        {status ? (
          <div className="mt-5 rounded-[24px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {status}
          </div>
        ) : (
          <div className="mt-5 rounded-[28px] border border-slate-200 bg-white px-5 py-5">
            <p className="text-base font-semibold text-slate-950">{checkout?.planName ?? 'Plano freelancer'}</p>
            <p className="mt-2 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
              {checkout ? currencyMonthly(checkout.amountMonthly) : '--'}
              <span className="text-base font-medium text-slate-500">/mês</span>
            </p>
            <p className="mt-3 text-sm text-slate-600">
              Status do checkout: <span className="font-semibold text-emerald-700">{checkout?.status ?? '--'}</span>
            </p>
          </div>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[#0f4fd8] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#1558e8]"
            to={session?.role === 'freelancer' ? '/assinatura' : '/login'}
          >
            {session?.role === 'freelancer' ? 'Abrir assinatura' : 'Entrar na conta'}
          </Link>
          <Link
            className="inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
            to="/"
          >
            Voltar ao início
          </Link>
        </div>
      </section>
    </div>
  );
}
