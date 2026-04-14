import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import type { FreelancerDashboard } from '../../shared/contracts';
import { StatsCard } from '../components/StatsCard';
import { useCepLookup } from '../hooks/useCepLookup';
import { api } from '../lib/api';
import { buildWhatsappUrl, countExternalContactChannels } from '../lib/external-contact';
import { BRAZIL_STATES, OTHER_BRAZIL_CITY_OPTION } from '../lib/brazil-states';
import { currencyMonthly, shortDate } from '../lib/format';
import { getSubscriptionStatusLabel } from '../lib/subscription';

export function FreelancerDashboardPage() {
  const [dashboard, setDashboard] = useState<FreelancerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<{
    tone: 'error' | 'success';
    text: string;
  } | null>(null);
  const [savingLocation, setSavingLocation] = useState(false);
  const {
    value: cepLocation,
    applyStoredValue,
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
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        const [data, location] = await Promise.all([
          api.getFreelancerDashboard({
            signal: controller.signal,
          }),
          api.getOwnFreelancerLocation(),
        ]);

        if (!controller.signal.aborted) {
          setDashboard(data);
          applyStoredValue(location);
          setError(null);
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error ? loadError.message : 'Não foi possível carregar o dashboard.',
          );
        }
      }
    }

    void loadDashboard();

    return () => controller.abort();
  }, [applyStoredValue]);

  async function handleLocationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLocationStatus(null);

    if (cepLoading) {
      setLocationStatus({
        tone: 'error',
        text: 'Aguarde a consulta do CEP terminar antes de salvar.',
      });
      return;
    }

    if (showManualLocationFields && cityOptionsLoading) {
      setLocationStatus({
        tone: 'error',
        text: 'Aguarde a lista de cidades carregar antes de salvar.',
      });
      return;
    }

    const locationValidation = validateResolvedLocation();
    if (!locationValidation.ok) {
      setLocationStatus({
        tone: 'error',
        text: locationValidation.message,
      });
      return;
    }

    setSavingLocation(true);

    try {
      const savedLocation = await api.updateFreelancerLocation(locationValidation.value);
      applyStoredValue(savedLocation);
      setDashboard((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          profile: {
            ...current.profile,
            location: `${savedLocation.city}, ${savedLocation.state}`,
          },
        };
      });
      setLocationStatus({
        tone: 'success',
        text: 'Base de atendimento atualizada com sucesso.',
      });
    } catch (saveError) {
      setLocationStatus({
        tone: 'error',
        text:
          saveError instanceof Error
            ? saveError.message
            : 'Não foi possível salvar a localização agora.',
      });
    } finally {
      setSavingLocation(false);
    }
  }
  if (error) {
    return (
      <div className="container py-14">
        <div className="rounded-[30px] border border-rose-200 bg-rose-50 px-6 py-5 text-sm text-rose-700">
          {error}
        </div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="container py-14">
        <div className="glass-panel rounded-[30px] px-6 py-8 text-sm text-slate-500 shadow-soft">
          Carregando dashboard profissional...
        </div>
      </div>
    );
  }

  const whatsappUrl = buildWhatsappUrl(
    dashboard.profile.whatsapp || dashboard.account.phone,
    `Olá, encontrei seu perfil no Faço Freela e quero falar sobre um serviço com ${dashboard.profile.name.split(' ')[0]}.`,
  );
  const contactChannels = countExternalContactChannels({
    whatsapp: dashboard.profile.whatsapp || dashboard.account.phone,
    websiteUrl: dashboard.profile.websiteUrl,
    linkedinUrl: dashboard.profile.linkedinUrl,
  });

  return (
    <div className="container space-y-8 py-10 sm:space-y-10 sm:py-12 lg:py-14">
      <section className="rounded-[36px] bg-slate-950 p-5 text-white shadow-soft sm:p-8">
        <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr] xl:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-200">
              Dashboard do freelancer
            </p>
            <h1 className="mt-4 text-[2.2rem] font-extrabold leading-[1.02] tracking-tight sm:text-[2.8rem]">
              {dashboard.profile.name}, seu perfil agora empurra o primeiro contato para fora da plataforma.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              A ideia é simples: o cliente entende seu serviço aqui e segue para WhatsApp, site ou
              LinkedIn quando fizer sentido. Assim a plataforma fica mais leve sem perder contexto.
            </p>
          </div>

          <div className="rounded-[28px] border border-white/10 bg-white/5 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-sm font-semibold text-brand-100">{dashboard.subscription.name}</p>
              {dashboard.subscription.tier === 'booster' ? (
                <span className="rounded-full border border-cyan-300/20 bg-cyan-400/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-100">
                  Booster
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-3xl font-extrabold">
              {currencyMonthly(dashboard.subscription.priceMonthly)}/mês
            </p>
            <p className="mt-2 text-sm text-slate-300">
              Renovação até {shortDate(dashboard.subscription.endsAt)} • status{' '}
              <span className="font-semibold text-white">
                {getSubscriptionStatusLabel(dashboard.subscription.status)}
              </span>
            </p>
          </div>

          <div
            className={`rounded-[28px] p-5 text-white ${
              dashboard.subscription.status === 'active'
                ? 'border border-white/10 bg-white/5'
                : 'border border-amber-200/40 bg-amber-50/10'
            }`}
          >
            <p
              className={`text-sm font-semibold ${
                dashboard.subscription.status === 'active' ? 'text-brand-100' : 'text-amber-100'
              }`}
            >
              {dashboard.subscription.status === 'active'
                ? 'Sua assinatura está rodando normalmente.'
                : 'Sua assinatura precisa de atenção.'}
            </p>
            <p className="mt-3 text-sm leading-6 text-slate-200">
              A área de assinatura concentra plano atual, checkout em andamento e próximos passos sem
              quebrar o estado real salvo no banco.
            </p>
            <div className="mt-4">
              <Link
                className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                to="/assinatura"
              >
                Abrir assinatura
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 sm:gap-6">
        <StatsCard
          helper="Volume acumulado de visitas na página pública."
          label="Visualizações do perfil"
          value={dashboard.metrics.profileViews.toString()}
        />
        <StatsCard
          helper="Quantidade de leads antigos já registrados no perfil."
          label="Leads registrados"
          value={dashboard.metrics.contactClicks.toString()}
        />
        <StatsCard
          helper="WhatsApp, site e LinkedIn publicados no perfil."
          label="Canais externos"
          value={contactChannels.toString()}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_0.98fr]">
        <article className="glass-panel rounded-[32px] p-7 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Canais do perfil
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                O que o cliente vê antes de chamar
              </h2>
            </div>
            <Link
              className="text-sm font-semibold text-brand-600"
              to={`/freelancers/${dashboard.profile.slug}`}
            >
              Ver perfil público
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            {contactChannels > 0 ? (
              <>
                {whatsappUrl ? (
                  <a
                    className="block rounded-[24px] border border-[#0071e3]/15 bg-[#0071e3]/5 p-5 transition hover:bg-[#0071e3]/10"
                    href={whatsappUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <p className="text-sm font-semibold text-slate-950">WhatsApp</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Canal mais direto para orçamento rápido e primeiro alinhamento.
                    </p>
                  </a>
                ) : null}

                {dashboard.profile.websiteUrl ? (
                  <a
                    className="block rounded-[24px] border border-slate-200/80 bg-white/80 p-5 transition hover:border-cyan-300 hover:bg-cyan-50/50"
                    href={dashboard.profile.websiteUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <p className="text-sm font-semibold text-slate-950">Site pessoal</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Bom para apresentar proposta, portfólio ou presença comercial.
                    </p>
                  </a>
                ) : null}

                {dashboard.profile.linkedinUrl ? (
                  <a
                    className="block rounded-[24px] border border-slate-200/80 bg-white/80 p-5 transition hover:border-cyan-300 hover:bg-cyan-50/50"
                    href={dashboard.profile.linkedinUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <p className="text-sm font-semibold text-slate-950">LinkedIn</p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Reforça experiência, histórico profissional e confiança.
                    </p>
                  </a>
                ) : null}
              </>
            ) : (
              <div className="rounded-[24px] border border-slate-200/80 bg-white/80 p-5 text-sm leading-6 text-slate-500">
                Você ainda não publicou um canal externo claro no perfil. O WhatsApp costuma sair do
                telefone cadastrado, mas vale revisar site e LinkedIn também.
              </div>
            )}
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-[32px] bg-slate-950 p-7 text-white shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-200">
              Como esse fluxo funciona
            </p>
            <h2 className="mt-2 text-2xl font-bold">O perfil virou sua ponte para novos contatos</h2>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-300">
              <li>Cliente lê o perfil, entende o serviço e decide se vale chamar.</li>
              <li>O primeiro contato sai para WhatsApp, site ou LinkedIn, sem abrir chat interno.</li>
              <li>Seu foco aqui fica em apresentação, prova social e base de atendimento.</li>
            </ul>
          </article>

          <article className="rounded-[32px] border border-slate-200/80 bg-white/90 p-7 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
              Base de atendimento
            </p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">CEP do perfil freelancer</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Esse CEP não fica público. Ele serve para manter o estado e a cidade sincronizados no
              perfil.
            </p>

            <form className="mt-6 space-y-4" onSubmit={handleLocationSubmit}>
              <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/70 p-2.5">
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
                        setLocationStatus(null);
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
                              setLocationStatus(null);
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
                        <div className="flex min-h-[78px] flex-col justify-center rounded-[22px] border border-slate-200/80 bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            Estado
                          </p>
                          <p
                            className={`mt-2 min-h-[20px] break-words text-sm font-semibold leading-5 ${
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
                              setLocationStatus(null);
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
                        <div className="flex min-h-[78px] flex-col justify-center rounded-[22px] border border-slate-200/80 bg-white px-4 py-3">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                            Cidade
                          </p>
                          <p
                            className={`mt-2 min-h-[20px] break-words text-sm font-semibold leading-5 ${
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
                            setLocationStatus(null);
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
                Se o CEP não retornar, abrimos Estado e Cidade para você concluir manualmente.
              </p>

              {cepFeedback ? (
                <div
                  className={`rounded-[20px] px-4 py-3 text-sm ${
                    cepFeedback.tone === 'error'
                      ? 'border border-rose-200 bg-rose-50 text-rose-700'
                      : cepFeedback.tone === 'success'
                        ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {cepFeedback.text}
                </div>
              ) : null}

              {cityOptionsError ? (
                <div className="rounded-[20px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {cityOptionsError}
                </div>
              ) : null}

              {locationStatus ? (
                <div
                  className={`rounded-[20px] px-4 py-3 text-sm ${
                    locationStatus.tone === 'success'
                      ? 'border border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border border-rose-200 bg-rose-50 text-rose-700'
                  }`}
                >
                  {locationStatus.text}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-xs leading-5 text-slate-500">
                  Localização pública atual: {dashboard.profile.location || 'Não definida'}
                </p>
                <button
                  className="rounded-full bg-[#0071e3] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#0077ed] disabled:cursor-not-allowed disabled:bg-slate-300"
                  disabled={savingLocation || cepLoading || (showManualLocationFields && cityOptionsLoading)}
                  type="submit"
                >
                  {savingLocation ? 'Salvando...' : 'Salvar base de atendimento'}
                </button>
              </div>
            </form>
          </article>

          <article className="rounded-[32px] border border-brand-100 bg-brand-50 p-7 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-700">
              Operação do perfil
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
              <li>Seu perfil público agora é o ponto principal de captação de lead.</li>
              <li>O primeiro contato externo reduz carga de banco e simplifica a operação.</li>
              <li>Mantenha WhatsApp, site e LinkedIn coerentes com o tipo de serviço que você vende.</li>
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}
