import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { clientSignupSchema } from '../../shared/schemas';
import { FormField } from '../components/FormField';
import { PhoneField } from '../components/PhoneField';
import { useAppSession } from '../context/AppSessionContext';
import { api } from '../lib/api';
import { composeBrazilPhone } from '../lib/phone';
import { getFieldErrors } from '../lib/validation';

type ClientFormState = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  ddd: string;
  phoneNumber: string;
  location: string;
};

const initialState: ClientFormState = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  ddd: '',
  phoneNumber: '',
  location: '',
};

export function ClientSignupPage() {
  const navigate = useNavigate();
  const { setSession } = useAppSession();
  const [form, setForm] = useState<ClientFormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const parsed = clientSignupSchema.safeParse({
      ...form,
      phone: composeBrazilPhone(form.ddd, form.phoneNumber),
    });
    if (!parsed.success) {
      setErrors(getFieldErrors(parsed.error));
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const response = await api.registerClient(parsed.data);
      setSession(response.user);
      navigate('/dashboard/cliente');
    } catch (submitError) {
      setStatus(submitError instanceof Error ? submitError.message : 'Não foi possível criar a conta.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container grid gap-10 py-14 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="space-y-6">
        <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-700">
          Acesso do cliente // Cadastro
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-950">
          Crie sua conta para liberar preço, contato e histórico dentro da plataforma.
        </h1>
        <p className="text-base leading-7 text-slate-600">
          O cadastro de cliente é gratuito e já ativa uma sessão protegida. Depois do login, sua conta passa a enxergar valores médios, usar o fluxo de mensagem real e acompanhar interações pelo dashboard.
        </p>

        <div className="glass-panel tech-panel rounded-[30px] p-6 shadow-soft">
          <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-cyan-700">O que é liberado</p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <li>Preço médio dos freelancers e filtro de orçamento.</li>
            <li>Envio de contato pelo backend com histórico persistido.</li>
            <li>Painel com favoritos, notificações e mensagens recentes.</li>
          </ul>
        </div>
      </section>

      <section className="glass-panel tech-panel rounded-[32px] p-6 shadow-soft lg:p-8">
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              error={errors.name}
              label="Nome completo"
              name="name"
              onChange={handleChange}
              placeholder="Seu nome completo"
              value={form.name}
            />
            <FormField
              error={errors.email}
              label="E-mail"
              name="email"
              onChange={handleChange}
              placeholder="voce@email.com"
              type="email"
              value={form.email}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              error={errors.password}
              label="Senha"
              name="password"
              onChange={handleChange}
              placeholder="Mínimo de 6 caracteres"
              type="password"
              value={form.password}
            />
            <FormField
              error={errors.confirmPassword}
              label="Confirmar senha"
              name="confirmPassword"
              onChange={handleChange}
              placeholder="Repita a senha"
              type="password"
              value={form.confirmPassword}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <PhoneField
              dddValue={form.ddd}
              error={errors.phone}
              hint="Telefone protegido para validação da conta e histórico de contato."
              label="Telefone de segurança"
              numberValue={form.phoneNumber}
              onDddChange={(value) => setForm((current) => ({ ...current, ddd: value }))}
              onNumberChange={(value) =>
                setForm((current) => ({
                  ...current,
                  phoneNumber: value,
                }))
              }
            />
            <FormField
              error={errors.location}
              label="Localização"
              name="location"
              onChange={handleChange}
              placeholder="Cidade, estado"
              value={form.location}
            />
          </div>

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
            {loading ? 'Criando conta...' : 'Criar conta gratuita'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-500">
          Já tem conta?{' '}
          <Link className="font-semibold text-cyan-700" to="/login">
            Fazer login
          </Link>
        </p>
      </section>
    </div>
  );
}
