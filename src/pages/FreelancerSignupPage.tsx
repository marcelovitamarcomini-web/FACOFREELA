import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  categories,
  experienceLevels,
  freelancerPlanCatalog,
  getFreelancerPlanPrice,
  type FreelancerPlanTier,
} from '../../shared/contracts';
import { freelancerSignupSchema } from '../../shared/schemas';
import { FormField } from '../components/FormField';
import { PhoneField } from '../components/PhoneField';
import { useAppSession } from '../context/AppSessionContext';
import { api } from '../lib/api';
import { currencyMonthly } from '../lib/format';
import { composeBrazilPhone } from '../lib/phone';
import { getFieldErrors } from '../lib/validation';

type FreelancerFormState = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  ddd: string;
  phoneNumber: string;
  subscriptionTier: string;
  hasCnpj: string;
  location: string;
  category: string;
  profession: string;
  summary: string;
  description: string;
  experienceLevel: string;
  yearsExperience: string;
  averagePrice: string;
  avatarUrl: string;
  bannerUrl: string;
  portfolioUrl: string;
  linkedinUrl: string;
  websiteUrl: string;
};

const initialState: FreelancerFormState = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  ddd: '',
  phoneNumber: '',
  subscriptionTier: 'normal',
  hasCnpj: '',
  location: '',
  category: '',
  profession: '',
  summary: '',
  description: '',
  experienceLevel: '',
  yearsExperience: '',
  averagePrice: '',
  avatarUrl: '',
  bannerUrl: '',
  portfolioUrl: '',
  linkedinUrl: '',
  websiteUrl: '',
};

const freelancerPlanEntries = Object.entries(freelancerPlanCatalog) as Array<
  [FreelancerPlanTier, (typeof freelancerPlanCatalog)[FreelancerPlanTier]]
>;
const cnpjOptions = ['Sim', 'Não'] as const;

export function FreelancerSignupPage() {
  const navigate = useNavigate();
  const { setSession } = useAppSession();
  const [form, setForm] = useState<FreelancerFormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const hasCnpj = form.hasCnpj === 'Sim';
  const boosterBonusPrice = getFreelancerPlanPrice('booster', true);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const parsed = freelancerSignupSchema.safeParse({
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
      const response = await api.registerFreelancer(parsed.data);
      setSession(response.user);
      navigate('/dashboard/freelancer');
    } catch (submitError) {
      setStatus(submitError instanceof Error ? submitError.message : 'Não foi possível concluir o cadastro.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container grid gap-10 py-14 lg:grid-cols-[0.85fr_1.15fr]">
      <section className="space-y-6">
        <span className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-700">
          Perfil freelancer // Cadastro
        </span>
        <h1 className="text-4xl font-extrabold tracking-tight text-slate-950">
          Publique seu perfil profissional e entre na camada de busca com painel próprio.
        </h1>
        <p className="text-base leading-7 text-slate-600">
          O cadastro cria a conta, ativa a sessão e publica um perfil pronto para descoberta. Os contatos passam a entrar pelo backend protegido, sem depender de canal aberto no perfil público.
        </p>

        <div className="space-y-4 rounded-[32px] border border-slate-800/50 bg-[linear-gradient(180deg,#020617_0%,#0f172a_100%)] p-7 text-white shadow-soft">
          <div>
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-cyan-200">
              Planos freelancer
            </p>
            <h2 className="mt-3 text-2xl font-bold">
              Escolha o ponto de entrada ideal para publicar seu perfil.
            </h2>
          </div>

          <div className="grid gap-4">
            {freelancerPlanEntries.map(([tier, plan]) => {
              const displayPrice = getFreelancerPlanPrice(tier, hasCnpj);
              const hasCnpjBonus = hasCnpj && tier === 'booster';

              return (
                <div
                  key={tier}
                  className={`rounded-[26px] border p-5 ${
                    tier === 'booster'
                      ? 'border-cyan-300/30 bg-cyan-400/10'
                      : 'border-white/10 bg-white/5'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-white">{plan.name}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-300">{plan.summary}</p>
                    </div>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-cyan-100">
                      {tier === 'booster' ? 'Booster' : 'Normal'}
                    </span>
                  </div>

                  <p className="mt-4 text-3xl font-extrabold">
                    {currencyMonthly(displayPrice)}
                    <span className="text-base font-medium text-slate-300">/mês</span>
                  </p>

                  {tier === 'booster' ? (
                    <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-100">
                      {hasCnpjBonus
                        ? 'Bônus CNPJ aplicado'
                        : `Com CNPJ ativo: ${currencyMonthly(boosterBonusPrice)}/mês`}
                    </p>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      <section className="glass-panel tech-panel rounded-[32px] p-6 shadow-soft lg:p-8">
        <form className="grid gap-5" onSubmit={handleSubmit}>
          <div className="grid gap-5 sm:grid-cols-2">
            <FormField error={errors.name} label="Nome completo" name="name" onChange={handleChange} value={form.name} />
            <FormField error={errors.email} label="E-mail" name="email" onChange={handleChange} type="email" value={form.email} />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField error={errors.password} label="Senha" name="password" onChange={handleChange} type="password" value={form.password} />
            <FormField
              error={errors.confirmPassword}
              label="Confirmar senha"
              name="confirmPassword"
              onChange={handleChange}
              type="password"
              value={form.confirmPassword}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <PhoneField
              dddValue={form.ddd}
              error={errors.phone}
              hint="Telefone protegido para segurança da conta e continuidade do atendimento."
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
            <FormField error={errors.location} label="Localização" name="location" onChange={handleChange} value={form.location} />
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Conta profissional</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Informe se este perfil atende com CNPJ ativo.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {cnpjOptions.map((option) => {
                const isSelected = form.hasCnpj === option;

                return (
                  <button
                    key={option}
                    className={`rounded-[24px] border px-4 py-4 text-left transition ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/8 shadow-soft'
                        : 'border-slate-200/90 bg-white/80 hover:border-cyan-300'
                    }`}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        hasCnpj: option,
                      }))
                    }
                    type="button"
                  >
                    <p className="text-sm font-semibold text-slate-950">{option}</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {option === 'Sim'
                        ? 'Conta configurada para operar como pessoa jurídica.'
                        : 'Conta cadastrada sem CNPJ neste momento.'}
                    </p>
                  </button>
                );
              })}
            </div>

            {errors.hasCnpj ? <p className="text-sm text-rose-600">{errors.hasCnpj}</p> : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            <FormField
              error={errors.category}
              label="Categoria principal"
              name="category"
              onChange={handleChange}
              options={[...categories]}
              value={form.category}
            />
            <FormField
              error={errors.profession}
              label="Profissão"
              name="profession"
              onChange={handleChange}
              placeholder="Ex: UX Designer"
              value={form.profession}
            />
          </div>

          <FormField
            error={errors.summary}
            label="Resumo profissional"
            name="summary"
            onChange={handleChange}
            placeholder="Apresente seu diferencial em uma frase curta."
            value={form.summary}
          />

          <FormField
            error={errors.description}
            label="Descrição profissional"
            name="description"
            onChange={handleChange}
            placeholder="Explique serviços, experiência e tipo de projeto que você atende."
            textarea
            value={form.description}
          />

          <div className="grid gap-5 sm:grid-cols-3">
            <FormField
              error={errors.experienceLevel}
              label="Nível de experiência"
              name="experienceLevel"
              onChange={handleChange}
              options={[...experienceLevels]}
              value={form.experienceLevel}
            />
            <FormField error={errors.yearsExperience} label="Anos de experiência" min="0" name="yearsExperience" onChange={handleChange} type="number" value={form.yearsExperience} />
            <FormField
              error={errors.averagePrice}
              label="Preço médio"
              min="1"
              name="averagePrice"
              onChange={handleChange}
              placeholder="Ex: 1500"
              type="number"
              value={form.averagePrice}
            />
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Selecione seu plano</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                O plano define sua assinatura mensal logo na ativação do perfil.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
              {freelancerPlanEntries.map(([tier, plan]) => {
                const isSelected = form.subscriptionTier === tier;
                const displayPrice = getFreelancerPlanPrice(tier, hasCnpj);
                const hasCnpjBonus = hasCnpj && tier === 'booster';

                return (
                  <button
                    key={tier}
                    className={`rounded-[28px] border p-5 text-left transition ${
                      isSelected
                        ? 'border-cyan-400 bg-cyan-500/8 shadow-soft'
                        : 'border-slate-200/90 bg-white/80 hover:border-cyan-300'
                    }`}
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        subscriptionTier: tier,
                      }))
                    }
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-base font-bold text-slate-950">{plan.name}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{plan.summary}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          isSelected
                            ? 'bg-slate-950 text-white'
                            : 'border border-slate-200 bg-white text-slate-600'
                        }`}
                      >
                        {isSelected ? 'Selecionado' : tier === 'booster' ? 'Booster' : 'Normal'}
                      </span>
                    </div>

                    <p className="mt-4 text-3xl font-extrabold text-slate-950">
                      {currencyMonthly(displayPrice)}
                      <span className="text-sm font-medium text-slate-500">/mês</span>
                    </p>

                    {tier === 'booster' ? (
                      <p className="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-cyan-700">
                        {hasCnpjBonus
                          ? 'Bônus CNPJ aplicado'
                          : `Com CNPJ ativo: ${currencyMonthly(boosterBonusPrice)}/mês`}
                      </p>
                    ) : null}

                    <ul className="mt-4 space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="text-sm leading-6 text-slate-600">
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </button>
                );
              })}
            </div>

            {errors.subscriptionTier ? (
              <p className="text-sm text-rose-600">{errors.subscriptionTier}</p>
            ) : null}
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <FormField
              error={errors.avatarUrl}
              label="Foto profissional"
              name="avatarUrl"
              onChange={handleChange}
              optional
              placeholder="https://"
              value={form.avatarUrl}
            />
            <FormField
              error={errors.bannerUrl}
              label="Banner do perfil"
              name="bannerUrl"
              onChange={handleChange}
              optional
              placeholder="https://"
              value={form.bannerUrl}
            />
            <FormField
              error={errors.portfolioUrl}
              label="Portfólio"
              name="portfolioUrl"
              onChange={handleChange}
              optional
              placeholder="https://"
              value={form.portfolioUrl}
            />
          </div>

          <div className="grid gap-5 sm:grid-cols-3">
            <FormField
              error={errors.linkedinUrl}
              label="LinkedIn"
              name="linkedinUrl"
              onChange={handleChange}
              optional
              placeholder="https://"
              value={form.linkedinUrl}
            />
            <FormField
              error={errors.websiteUrl}
              label="Site pessoal"
              name="websiteUrl"
              onChange={handleChange}
              optional
              placeholder="https://"
              value={form.websiteUrl}
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
            {loading ? 'Criando perfil...' : 'Criar perfil e ativar plano'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-500">
          Já possui conta?{' '}
          <Link className="font-semibold text-cyan-700" to="/login">
            Fazer login
          </Link>
        </p>
      </section>
    </div>
  );
}



