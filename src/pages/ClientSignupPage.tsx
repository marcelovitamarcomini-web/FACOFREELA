import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { clientSignupSchema } from '../../shared/schemas';
import { FormField } from '../components/FormField';
import { InstitutionalSupportNote } from '../components/InstitutionalSupportNote';
import { PhoneField } from '../components/PhoneField';
import { useAppSession } from '../context/AppSessionContext';
import { useCepLookup } from '../hooks/useCepLookup';
import { api } from '../lib/api';
import {
  BRAZIL_STATES,
  OTHER_BRAZIL_CITY_OPTION,
  buildBrazilLocation,
} from '../lib/brazil-states';
import { composeBrazilPhone } from '../lib/phone';
import { getFieldErrors } from '../lib/validation';

type ClientFormState = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  ddd: string;
  phoneNumber: string;
};

const initialState: ClientFormState = {
  name: '',
  email: '',
  password: '',
  confirmPassword: '',
  ddd: '',
  phoneNumber: '',
};

export function ClientSignupPage() {
  const navigate = useNavigate();
  const { loading: sessionLoading, session, setSession } = useAppSession();
  const [form, setForm] = useState<ClientFormState>(initialState);
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

  useEffect(() => {
    if (sessionLoading || !session) {
      return;
    }

    navigate(
      session.role === 'freelancer' ? '/dashboard/freelancer' : '/dashboard/cliente',
      { replace: true },
    );
  }, [navigate, session, sessionLoading]);

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setErrors((current) => {
      const nextErrors = { ...current };
      delete nextErrors[name];
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

    const parsed = clientSignupSchema.safeParse({
      ...form,
      cep: cepValidation.value.cep,
      location: buildBrazilLocation(cepValidation.value.city, cepValidation.value.state),
      phone: composeBrazilPhone(form.ddd, form.phoneNumber),
    });

    if (!parsed.success) {
      const fieldErrors = getFieldErrors(parsed.error);

      if (fieldErrors.location) {
        fieldErrors.state ??= fieldErrors.location;
        fieldErrors.city ??= fieldErrors.location;
        delete fieldErrors.location;
      }

      setErrors(fieldErrors);
      return;
    }

    setErrors({});
    setLoading(true);

    try {
      const response = await api.registerClient(parsed.data);
      if (response.user) {
        setSession(response.user);
        navigate('/dashboard/cliente');
        return;
      }

      navigate('/login', {
        state: {
          email: parsed.data.email,
          registrationMessage: response.requiresEmailConfirmation
            ? 'Conta criada com sucesso. Confirme seu e-mail e depois faça login.'
            : 'Conta criada com sucesso. Faça login para continuar.',
        },
      });
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : 'Não foi possível criar a conta.';

      if (message.toLowerCase().includes('já existe uma conta com este e-mail')) {
        setErrors({ email: message });
        return;
      }

      if (message.toLowerCase().includes('já existe uma conta com este telefone')) {
        setErrors({ phone: message });
        return;
      }

      setStatus(message);
    } finally {
      setLoading(false);
    }
  }

  if (sessionLoading || session) {
    return (
      <div className="container py-10 sm:py-12 lg:py-14">
        <div className="glass-panel rounded-[30px] px-6 py-8 text-sm text-slate-500 shadow-soft">
          {session
            ? 'Você já está em uma conta ativa. Redirecionando para o seu painel...'
            : 'Carregando cadastro...'}
        </div>
      </div>
    );
  }

  return (
    <div className="container grid gap-8 py-10 sm:gap-10 sm:py-12 xl:grid-cols-[0.82fr_1.18fr] xl:items-start xl:py-16">
      <section className="space-y-6">
        <span className="inline-flex rounded-full border border-slate-200 bg-white/88 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
          Conta de cliente
        </span>
        <h1 className="text-[2.35rem] font-semibold leading-[1.02] tracking-[-0.05em] text-slate-950 sm:text-[3rem] xl:text-[3.4rem]">
          Crie sua conta para achar profissionais, comparar opções e organizar melhor sua busca.
        </h1>
        <p className="max-w-xl text-[1.02rem] leading-7 text-slate-500">
          O cadastro é simples e gratuito. Depois do login, você salva sua base de atendimento e
          navega com mais contexto antes de seguir para o contato externo.
        </p>

        <div className="rounded-[34px] border border-slate-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96)_0%,rgba(246,249,255,0.96)_100%)] p-5 shadow-[0_20px_55px_rgba(15,23,42,0.05)] sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0071e3]">
            O que entra na conta
          </p>
          <ul className="mt-4 space-y-3 text-sm leading-6 text-slate-600">
            <li>Comparar profissionais com mais clareza e sem se perder no processo.</li>
            <li>Abrir perfis com contexto e seguir para o contato externo quando fizer sentido.</li>
            <li>Entrar na busca já com sua região principal pronta para categorias locais.</li>
          </ul>
        </div>
      </section>

      <section className="glass-panel tech-panel rounded-[34px] p-5 sm:p-6 lg:p-8">
        <form className="grid gap-6" onSubmit={handleSubmit}>
          <div className="grid gap-5 md:grid-cols-2">
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
              placeholder="nome@exemplo.com"
              type="email"
              value={form.email}
            />
          </div>

          <div className="grid gap-5 md:grid-cols-2">
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

          <div className="grid gap-5 2xl:grid-cols-[minmax(17rem,0.82fr)_minmax(0,1.18fr)] 2xl:items-stretch">
            <PhoneField
              dddValue={form.ddd}
              error={errors.phone}
              hint="Usamos esse número só para segurança da conta. O +55 entra automaticamente no sistema."
              label="Celular"
              numberValue={form.phoneNumber}
              onDddChange={(value) => {
                setForm((current) => ({ ...current, ddd: value }));
                setErrors((current) => {
                  if (!current.phone) {
                    return current;
                  }

                  const nextErrors = { ...current };
                  delete nextErrors.phone;
                  return nextErrors;
                });
              }}
              onNumberChange={(value) => {
                setForm((current) => ({
                  ...current,
                  phoneNumber: value,
                }));
                setErrors((current) => {
                  if (!current.phone) {
                    return current;
                  }

                  const nextErrors = { ...current };
                  delete nextErrors.phone;
                  return nextErrors;
                });
              }}
            />

            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                Sua região principal
              </div>

              <div className="rounded-[28px] border border-slate-200/80 bg-white/92 p-2.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)]">
                <div className="grid gap-2.5 lg:grid-cols-[156px_minmax(0,1fr)] lg:items-stretch">
                  <label className="flex min-h-[78px] flex-col justify-center rounded-[22px] border border-slate-200/80 bg-white px-4 py-3">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                      CEP
                    </span>
                    <input
                      className="mt-1 min-h-[44px] w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
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
                            className="mt-1 min-h-[44px] w-full appearance-none bg-transparent text-sm font-semibold text-slate-900 outline-none"
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
                            className="mt-1 min-h-[44px] w-full appearance-none bg-transparent text-sm font-semibold text-slate-900 outline-none disabled:cursor-not-allowed disabled:text-slate-400"
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
                          className="mt-1 min-h-[44px] w-full bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
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
                Essa base principal fica salva para sugerir sua região na busca de serviços locais.
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
            {loading ? 'Criando conta...' : 'Criar conta gratuita'}
          </button>
        </form>

        <p className="mt-6 flex flex-col gap-2 text-sm text-slate-500 sm:flex-row sm:flex-wrap sm:items-center">
          Já tem conta?{' '}
          <Link className="inline-flex min-h-[44px] items-center rounded-full px-3 font-semibold text-[#0071e3] transition hover:bg-[#0071e3]/6" to="/login">
            Fazer login
          </Link>
        </p>

        <InstitutionalSupportNote className="mt-4" compact />
      </section>
    </div>
  );
}
