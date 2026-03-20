import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useLocation, useNavigate, type Location } from 'react-router-dom';

import { loginSchema } from '../../shared/schemas';
import { FormField } from '../components/FormField';
import { useAppSession } from '../context/AppSessionContext';
import { api } from '../lib/api';
import { getFieldErrors } from '../lib/validation';

type LoginState = {
  email: string;
  password: string;
};

type LoginLocationState = {
  from?: Location;
};

const initialState: LoginState = {
  email: '',
  password: '',
};

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { setSession } = useAppSession();
  const [form, setForm] = useState(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const redirectTarget =
    (location.state as LoginLocationState | null)?.from ??
    null;

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

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
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container grid gap-10 py-14 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-6">
        <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
          Acesso
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-950">
          Acesse sua conta para destravar preços, contatos e monitoramento operacional.
        </h1>
        <p className="text-base leading-7 text-slate-600">
          Clientes liberam valores médios e criam contatos reais no sistema. Freelancers acompanham
          leads, assinatura e sinais de interesse no painel profissional.
        </p>

        <div className="glass-panel tech-panel rounded-[30px] p-6 shadow-soft">
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-cyan-700">
            Estado de sessão
          </p>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            O login agora usa cookie HTTP-only, o que permite proteger dashboards e liberar dados
            sensíveis do perfil apenas para o tipo correto de usuário.
          </p>
        </div>
      </section>

      <section className="glass-panel tech-panel rounded-[32px] p-6 shadow-soft lg:p-8">
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
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {status}
            </div>
          ) : null}

          <button
            className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
            disabled={loading}
            type="submit"
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-sm">
          <button className="font-semibold text-cyan-700" type="button">
            Esqueci minha senha
          </button>
          <div className="text-slate-500">
            Não tem conta?{' '}
            <Link className="font-semibold text-cyan-700" to="/cadastro/cliente">
              Criar conta
            </Link>
          </div>
        </div>

        <div className="mt-8 rounded-[28px] border border-slate-200 bg-white p-5">
          <p className="font-mono text-sm font-semibold uppercase tracking-[0.18em] text-slate-700">
            Contas de demonstração
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Cliente: <span className="font-medium text-slate-700">marina@cliente.com</span> / senha{' '}
            <span className="font-medium text-slate-700">123456</span>
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-500">
            Freelancer: <span className="font-medium text-slate-700">aline@facofreela.com</span> / senha{' '}
            <span className="font-medium text-slate-700">123456</span>
          </p>
        </div>
      </section>
    </div>
  );
}
