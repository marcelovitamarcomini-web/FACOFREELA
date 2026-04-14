import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom';

import { loginSchema } from '../../shared/schemas';
import { FormField } from '../components/FormField';
import { InstitutionalSupportNote } from '../components/InstitutionalSupportNote';
import { useAppSession } from '../context/AppSessionContext';
import { api } from '../lib/api';
import { passwordSupportMailto } from '../lib/institutional';
import { getFieldErrors } from '../lib/validation';

type LoginState = {
  email: string;
  password: string;
};

type LoginLocationState = {
  from?: Location;
  email?: string;
  registrationMessage?: string;
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAppSession();
  const locationState = (location.state as LoginLocationState | null) ?? null;
  const [form, setForm] = useState<LoginState>({
    email: locationState?.email ?? '',
    password: '',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(locationState?.registrationMessage ?? null);
  const [statusTone, setStatusTone] = useState<'error' | 'success'>(
    locationState?.registrationMessage ? 'success' : 'error',
  );
  const [loading, setLoading] = useState(false);

  const redirectTarget = locationState?.from ?? null;

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);
    setStatusTone('error');

    const parsed = loginSchema.safeParse(form);
    if (!parsed.success) {
      setErrors(getFieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const response = await api.login(parsed.data);
      setSession(response.user);
      navigate(
        redirectTarget ??
          (response.user.role === 'freelancer' ? '/dashboard/freelancer' : '/dashboard/cliente'),
      );
    } catch (submitError) {
      setStatus(submitError instanceof Error ? submitError.message : 'Não foi possível entrar.');
      setStatusTone('error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container grid gap-8 py-10 sm:gap-10 sm:py-12 xl:grid-cols-[0.92fr_1.08fr] xl:items-start xl:py-16">
      <section className="space-y-6">
        <span className="inline-flex rounded-full border border-slate-200 bg-white/88 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Acesso
        </span>
        <h1 className="text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.05em] text-slate-950 sm:text-[3rem] xl:text-[3.4rem]">
          Entre na sua conta para acompanhar pedidos, perfis e serviços com facilidade.
        </h1>
        <p className="max-w-xl text-[1.02rem] leading-7 text-slate-500">
          Aqui você encontra tudo em um lugar só: perfis salvos, pedidos em andamento e acesso ao
          que foi liberado para a sua conta.
        </p>

        <div className="rounded-[34px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,249,255,0.96)_100%)] p-5 shadow-[0_20px_55px_rgba(15,23,42,0.05)] sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0071e3]">
              Jump freelancer
            </p>
            <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Direto
            </span>
          </div>

          <h2 className="mt-4 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
            Quer começar a divulgar seus serviços?
          </h2>
          <p className="mt-3 text-sm leading-7 text-slate-600">
            Se você presta serviço na rua, na obra, no escritório, no estúdio ou online, pode ir
            direto para o cadastro freelancer, escolher o plano e ativar seu perfil profissional.
          </p>

          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-[44px] items-center rounded-full bg-[#0071e3] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0077ed]"
              to="/cadastro/freelancer"
            >
              Ir para cadastro freelancer
            </Link>
            <Link
              className="inline-flex min-h-[44px] items-center rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              to="/cadastro/cliente"
            >
              Criar conta de cliente
            </Link>
          </div>
        </div>

        <div className="glass-panel tech-panel rounded-[30px] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Estado de sessão
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            O acesso usa a autenticação da plataforma para liberar dashboards, perfis e permissões
            conforme o tipo correto de usuário.
          </p>
        </div>
      </section>

      <section className="glass-panel tech-panel rounded-[34px] p-5 sm:p-6 lg:p-8">
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <FormField
            error={errors.email}
            label="E-mail"
            name="email"
            onChange={handleChange}
            type="email"
            value={form.email}
          />
          <FormField
            error={errors.password}
            label="Senha"
            name="password"
            onChange={handleChange}
            type="password"
            value={form.password}
          />

          {status ? (
            <div
              className={`rounded-2xl px-4 py-3 text-sm ${
                statusTone === 'success'
                  ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border border-rose-200 bg-rose-50 text-rose-700'
              }`}
            >
              {status}
            </div>
          ) : null}

          <button
            className="rounded-full bg-[#0071e3] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 flex flex-col gap-3 text-sm sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <a
            className="inline-flex min-h-[44px] items-center rounded-full px-3 font-semibold text-[#0071e3] transition hover:bg-[#0071e3]/6 hover:text-[#0077ed]"
            href={passwordSupportMailto}
          >
            Esqueci minha senha
          </a>
          <div className="flex flex-col gap-2 text-slate-500 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
            <span>Não tem conta?</span>
            <Link className="inline-flex min-h-[44px] items-center rounded-full px-3 font-semibold text-[#0071e3] transition hover:bg-[#0071e3]/6" to="/cadastro/cliente">
              Criar conta
            </Link>
            <Link
              className="inline-flex min-h-[44px] items-center rounded-full bg-[#0071e3]/8 px-4 py-2 font-semibold text-[#0071e3] transition hover:bg-[#0071e3]/12"
              to="/cadastro/freelancer"
            >
              Virar freelancer
            </Link>
          </div>
        </div>

        <div className="mt-8 rounded-[28px] border border-slate-200/80 bg-white/92 p-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Autenticação da plataforma
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            O acesso da plataforma depende da sua conta autenticada. Se o projeto exigir
            confirmação de e-mail, conclua essa etapa antes do primeiro login.
          </p>
        </div>

        <InstitutionalSupportNote className="mt-4" compact />
      </section>
    </div>
  );
}



