import { useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import {
  categories,
  freelancerPlanCatalog,
  getFreelancerPlanPrice,
  type FreelancerPlanTier,
} from '../../shared/contracts';
import { freelancerSignupSchema } from '../../shared/schemas';
import { FormField } from '../components/FormField';
import { InstitutionalSupportNote } from '../components/InstitutionalSupportNote';
import { PhoneField } from '../components/PhoneField';
import { useAppSession } from '../context/AppSessionContext';
import { useCepLookup } from '../hooks/useCepLookup';
import { api } from '../lib/api';
import { BRAZIL_STATES, OTHER_BRAZIL_CITY_OPTION } from '../lib/brazil-states';
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
  category: string;
  profession: string;
  summary: string;
  description: string;
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
  category: '',
  profession: '',
  summary: '',
  description: '',
  linkedinUrl: '',
  websiteUrl: '',
};

const freelancerPlanEntries = Object.entries(freelancerPlanCatalog) as Array<
  [FreelancerPlanTier, (typeof freelancerPlanCatalog)[FreelancerPlanTier]]
>;
const cnpjOptions = ['Sim', 'Não'] as const;
const compactCategoryKeys = new Set([
  'conserto em casa',
  'obra e reforma',
  'frete e guincho',
  'instalacao e manutencao',
]);

function buildFreelancerLocation(city: string, state: string) {
  return [city.trim(), state.trim()].filter(Boolean).join(', ');
}

function normalizeCategoryKey(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

function buildCompactFreelancerDescription(form: FreelancerFormState, city: string, state: string) {
  const location = buildFreelancerLocation(city, state);
  return `${form.profession.trim()} na categoria ${form.category.trim()} com base principal em ${location}. ${form.summary.trim()}`;
}

export function FreelancerSignupPage() {
  const navigate = useNavigate();
  const { setSession } = useAppSession();
  const [form, setForm] = useState<FreelancerFormState>(initialState);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const {
    value: cepLocation,
    handleCepInput,
    resolveCep,
    validateResolvedLocation,
    handleManualStateChange,
    handleManualCitySelect,
    handleCustomCityInput,
    loading: cepLoading,
    feedback: cepFeedback,
    showManualLocationFields,
    cityOptions,
    cityOptionsLoading,
    cityOptionsError,
    useCustomCityInput,
    manualCitySelectValue,
  } = useCepLookup();
  const hasCnpj = form.hasCnpj === 'Sim';
  const boosterBonusPrice = getFreelancerPlanPrice('booster', true);
  const usesCompactDescription = compactCategoryKeys.has(normalizeCategoryKey(form.category));

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[name];

      if (name === 'category' && compactCategoryKeys.has(normalizeCategoryKey(value))) {
        delete nextErrors.description;
      }

      return nextErrors;
    });
  }

  function clearLocationErrors(fields: Array<'cep' | 'state' | 'city'> = ['cep', 'state', 'city']) {
    setErrors((current) => {
      if (!fields.some((field) => current[field])) {
        return current;
      }

      const nextErrors = { ...current };
      for (const field of fields) {
        delete nextErrors[field];
      }

      return nextErrors;
    });
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus(null);

    const nextErrors: Record<string, string> = {};
    const cepValidation = validateResolvedLocation();

    if (cepLoading) {
      nextErrors.cep = 'Aguarde a consulta do CEP terminar.';
    } else if (showManualLocationFields && cityOptionsLoading) {
      nextErrors.city = 'Aguarde a lista de cidades terminar de carregar.';
    } else if (!cepValidation.ok) {
      nextErrors[cepValidation.field] = cepValidation.message;
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    if (!cepValidation.ok) {
      return;
    }

    const parsed = freelancerSignupSchema.safeParse({
      ...form,
      description: usesCompactDescription
        ? buildCompactFreelancerDescription(
            form,
            cepValidation.value.city,
            cepValidation.value.state,
          )
        : form.description,
      experienceLevel: 'Pleno',
      yearsExperience: 0,
      cep: cepValidation.value.cep,
      city: cepLocation.city,
      state: cepLocation.state,
      location: buildFreelancerLocation(cepValidation.value.city, cepValidation.value.state),
      phone: composeBrazilPhone(form.ddd, form.phoneNumber),
    });

    if (!parsed.success) {
      const fieldErrors = getFieldErrors(parsed.error);

      if (fieldErrors.location) {
        fieldErrors.cep ??= fieldErrors.location;
        delete fieldErrors.location;
      }

      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const response = await api.registerFreelancer({
        ...parsed.data,
        cep: cepValidation.value.cep,
      });

      if (response.user) {
        setSession(response.user);
        navigate('/dashboard/freelancer');
        return;
      }

      navigate('/login', {
        state: {
          email: parsed.data.email,
          registrationMessage: response.requiresEmailConfirmation
            ? 'Perfil criado com sucesso. Confirme seu e-mail e depois faça login.'
            : 'Perfil criado com sucesso. Faça login para continuar.',
        },
      });
    } catch (submitError) {
      setStatus(
        submitError instanceof Error
          ? submitError.message
          : 'Não foi possível concluir o cadastro.',
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container grid gap-10 py-16 lg:grid-cols-[0.88fr_1.12fr]">
      <section className="space-y-6">
        <span className="inline-flex rounded-full border border-slate-200 bg-white/88 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Perfil freelancer
        </span>
        <h1 className="text-4xl font-semibold tracking-[-0.05em] text-slate-950 sm:text-5xl">
          Monte seu perfil para ser encontrado por clientes que precisam do seu serviço.
        </h1>
        <p className="max-w-xl text-[1.02rem] leading-7 text-slate-500">
          O Faço Freela foi pensado para quem trabalha na rua, na obra, em casa, no escritório, no
          estúdio ou online. Você cria a conta, escolhe o plano e publica seu perfil no mesmo fluxo.
        </p>

        <div className="rounded-[34px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,249,255,0.96)_100%)] p-7 shadow-[0_20px_55px_rgba(15,23,42,0.05)]">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0071e3]">
              Planos freelancer
            </p>
            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-slate-950">
              Escolha o ponto de entrada para publicar seu perfil.
            </h2>
          </div>

          <div className="mt-5 grid gap-4">
            {freelancerPlanEntries.map(([tier, plan]) => {
              const displayPrice = getFreelancerPlanPrice(tier, hasCnpj);
              const hasCnpjBonus = hasCnpj && tier === 'booster';

              return (
                <div
                  key={tier}
                  className={`rounded-[28px] border p-5 ${
                    tier === 'booster'
                      ? 'border-[#0071e3]/18 bg-[#0071e3]/[0.045]'
                      : 'border-slate-200/80 bg-white/88'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{plan.name}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-600">{plan.summary}</p>
                    </div>
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                      {tier === 'booster' ? 'Booster' : 'Normal'}
                    </span>
                  </div>

                  <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                    {currencyMonthly(displayPrice)}
                    <span className="text-base font-medium text-slate-500">/mês</span>
                  </p>

                  {tier === 'booster' ? (
                    <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0071e3]">
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

      <section className="glass-panel tech-panel rounded-[34px] p-6 lg:p-8">
        <form className="grid gap-6" onSubmit={handleSubmit}>
          <div className="grid gap-5 xl:grid-cols-2">
            <FormField
              error={errors.name}
              label="Nome completo"
              name="name"
              onChange={handleChange}
              value={form.name}
            />
            <FormField
              error={errors.email}
              label="E-mail"
              name="email"
              onChange={handleChange}
              type="email"
              value={form.email}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-2">
            <FormField
              error={errors.password}
              label="Senha"
              name="password"
              onChange={handleChange}
              type="password"
              value={form.password}
            />
            <FormField
              error={errors.confirmPassword}
              label="Confirmar senha"
              name="confirmPassword"
              onChange={handleChange}
              type="password"
              value={form.confirmPassword}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(17rem,0.82fr)_minmax(0,1.18fr)] xl:items-start">
            <PhoneField
              dddValue={form.ddd}
              error={errors.phone}
              hint="Usamos esse número só para segurança da conta. O +55 entra automaticamente no sistema."
              label="Celular"
              numberValue={form.phoneNumber}
              onDddChange={(value) => setForm((current) => ({ ...current, ddd: value }))}
              onNumberChange={(value) =>
                setForm((current) => ({
                  ...current,
                  phoneNumber: value,
                }))
              }
            />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                Base de atendimento
              </div>

              <div className="rounded-[28px] border border-slate-200/80 bg-white/92 p-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="grid gap-2.5 lg:grid-cols-[156px_minmax(0,1fr)] lg:items-stretch">
                  <label className="flex min-h-[78px] flex-col justify-center rounded-[22px] border border-slate-200/80 bg-white px-4 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      CEP
                    </span>
                    <input
                      className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                      inputMode="numeric"
                      maxLength={9}
                      onBlur={() => void resolveCep()}
                      onChange={(event) => {
                        handleCepInput(event.target.value);
                        clearLocationErrors();

                        if (event.target.value.replace(/\D/g, '').length === 8) {
                          void resolveCep(event.target.value);
                        }
                      }}
                      placeholder="00000-000"
                      type="text"
                      value={cepLocation.cep}
                    />
                  </label>

                  <div className="grid gap-3">
                    <div className="grid gap-2.5 sm:grid-cols-2">
                      {showManualLocationFields ? (
                        <label className="flex min-h-[78px] flex-col justify-center rounded-[22px] border border-slate-200/80 bg-white px-4 py-3">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Estado
                          </span>
                          <select
                            className="mt-1 w-full appearance-none bg-transparent text-sm font-semibold text-slate-900 outline-none"
                            onChange={(event) => {
                              clearLocationErrors(['state', 'city']);
                              void handleManualStateChange(event.target.value);
                            }}
                            value={cepLocation.state}
                          >
                            <option value="">Selecione</option>
                            {BRAZIL_STATES.map((stateOption) => (
                              <option key={stateOption.code} value={stateOption.code}>
                                {stateOption.code} - {stateOption.name}
                              </option>
                            ))}
                          </select>
                        </label>
                      ) : (
                        <div className="flex min-h-[78px] flex-col justify-center rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-3">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Estado
                          </span>
                          <p
                            className={`mt-1 min-h-[20px] break-words text-sm font-semibold leading-5 ${
                              cepLocation.state ? 'text-slate-900' : 'text-slate-500'
                            }`}
                          >
                            {cepLocation.state || 'Via CEP'}
                          </p>
                        </div>
                      )}

                      {showManualLocationFields ? (
                        <label className="flex min-h-[78px] flex-col justify-center rounded-[22px] border border-slate-200/80 bg-white px-4 py-3">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Cidade
                          </span>
                          <select
                            className="mt-1 w-full appearance-none bg-transparent text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
                            disabled={!cepLocation.state || cityOptionsLoading}
                            onChange={(event) => {
                              clearLocationErrors(['city']);
                              handleManualCitySelect(event.target.value);
                            }}
                            value={manualCitySelectValue}
                          >
                            <option value="">
                              {!cepLocation.state
                                ? 'Escolha o estado primeiro'
                                : cityOptionsLoading
                                  ? 'Carregando cidades...'
                                  : 'Selecione'}
                            </option>
                            {cityOptions.map((cityOption) => (
                              <option key={cityOption} value={cityOption}>
                                {cityOption}
                              </option>
                            ))}
                            <option value={OTHER_BRAZIL_CITY_OPTION}>Outro</option>
                          </select>
                        </label>
                      ) : (
                        <div className="flex min-h-[78px] flex-col justify-center rounded-[22px] border border-slate-200/80 bg-slate-50/90 px-4 py-3">
                          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                            Cidade
                          </span>
                          <p
                            className={`mt-1 min-h-[20px] break-words text-sm font-semibold leading-5 ${
                              cepLocation.city ? 'text-slate-900' : 'text-slate-500'
                            }`}
                          >
                            {cepLocation.city || 'Via CEP'}
                          </p>
                        </div>
                      )}
                    </div>

                    {showManualLocationFields && useCustomCityInput ? (
                      <label className="flex min-h-[78px] flex-col justify-center rounded-[22px] border border-slate-200/80 bg-white px-4 py-3">
                        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                          Digite a cidade
                        </span>
                        <input
                          className="mt-1 w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
                          onChange={(event) => {
                            clearLocationErrors(['city']);
                            handleCustomCityInput(event.target.value);
                          }}
                          placeholder="Ex: Campinas"
                          value={cepLocation.city}
                        />
                      </label>
                    ) : null}
                  </div>
                </div>
              </div>

              <p className="text-xs leading-5 text-slate-500">
                Informe o CEP principal de atendimento. Se ele não retornar, você pode concluir por
                Estado e Cidade para manter o perfil consistente.
              </p>

              {cepFeedback ? (
                <p
                  className={`text-sm ${
                    cepFeedback.tone === 'error'
                      ? 'text-rose-600'
                      : cepFeedback.tone === 'success'
                        ? 'text-emerald-700'
                        : 'text-slate-500'
                  }`}
                >
                  {cepFeedback.text}
                </p>
              ) : null}

              {cityOptionsError ? <p className="text-sm text-amber-700">{cityOptionsError}</p> : null}
              {errors.cep ? <p className="text-sm text-rose-600">{errors.cep}</p> : null}
              {errors.state ? <p className="text-sm text-rose-600">{errors.state}</p> : null}
              {errors.city ? <p className="text-sm text-rose-600">{errors.city}</p> : null}
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Atende com CNPJ?</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Marque essa opção se o perfil vai atender com CNPJ ativo.
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
                        ? 'border-[#0071e3]/30 bg-[#0071e3]/[0.06] shadow-[0_14px_36px_rgba(0,113,227,0.08)]'
                        : 'border-slate-200/90 bg-white/80 hover:border-slate-300'
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

          <div className="grid gap-5 xl:grid-cols-[minmax(0,0.94fr)_minmax(0,1.06fr)]">
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
              placeholder="Ex: Chaveiro 24h, Pedreiro, Designer ou Arquiteto"
              value={form.profession}
            />
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-slate-700">Apresentação profissional</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Nesta etapa, vale priorizar o essencial: serviço, área de atendimento e tipo de
                demanda que você assume.
              </p>
            </div>

            <FormField
              error={errors.summary}
              label="Resumo profissional"
              name="summary"
              onChange={handleChange}
              placeholder="Explique em uma frase o que você faz e onde pode atender."
              value={form.summary}
            />

            {usesCompactDescription ? (
              <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-600">
                Para essa categoria, o cadastro segue mais direto: a descrição profissional fica
                opcional nesta etapa.
              </div>
            ) : (
              <FormField
                error={errors.description}
                label="Descrição profissional"
                name="description"
                onChange={handleChange}
                placeholder="Descreva seus serviços, a região em que atende e o tipo de demanda que você assume."
                textarea
                value={form.description}
              />
            )}
          </div>

          <div className="space-y-5">
            <div>
              <p className="text-sm font-semibold text-slate-700">Links profissionais</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                Se quiser, adicione apenas os canais que ajudam a validar sua presença profissional.
              </p>
            </div>

            <div className="grid gap-5 xl:grid-cols-2">
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

            <div className="rounded-[24px] border border-slate-200/80 bg-slate-50/90 px-4 py-4 text-sm leading-6 text-slate-600">
              Foto profissional, capa do perfil e portfólio podem ser configurados depois, já com a
              conta criada.
            </div>
          </div>

          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Selecione seu plano</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                O plano define a assinatura mensal logo na ativação do perfil.
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
                        ? 'border-[#0071e3]/30 bg-[#0071e3]/[0.06] shadow-[0_14px_36px_rgba(0,113,227,0.08)]'
                        : 'border-slate-200/90 bg-white/80 hover:border-slate-300'
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
                        <p className="text-base font-semibold text-slate-950">{plan.name}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{plan.summary}</p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${
                          isSelected
                            ? 'bg-[#0071e3] text-white'
                            : 'border border-slate-200 bg-white text-slate-500'
                        }`}
                      >
                        {isSelected ? 'Selecionado' : tier === 'booster' ? 'Booster' : 'Normal'}
                      </span>
                    </div>

                    <p className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                      {currencyMonthly(displayPrice)}
                      <span className="text-sm font-medium text-slate-500">/mês</span>
                    </p>

                    {tier === 'booster' ? (
                      <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#0071e3]">
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

          {status ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
              {status}
            </div>
          ) : null}

          <button
            className="w-full rounded-full bg-[#0071e3] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={loading || cepLoading || (showManualLocationFields && cityOptionsLoading)}
            type="submit"
          >
            {loading ? 'Criando perfil...' : 'Criar perfil e ativar plano'}
          </button>
        </form>

        <p className="mt-6 text-sm text-slate-500">
          Já possui conta?{' '}
          <Link className="font-semibold text-[#0071e3]" to="/login">
            Fazer login
          </Link>
        </p>

        <InstitutionalSupportNote className="mt-4" compact />
      </section>
    </div>
  );
}
