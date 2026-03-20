import { startTransition, useDeferredValue, useEffect, useState } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

import { categories, experienceLevels, type Freelancer } from '../../shared/contracts';
import { FreelancerCard } from '../components/FreelancerCard';
import { FormField } from '../components/FormField';
import { PriceMask } from '../components/PriceMask';
import { SectionHeading } from '../components/SectionHeading';
import { useAppSession } from '../context/AppSessionContext';
import { api } from '../lib/api';

type SearchState = {
  search: string;
  category: string;
  location: string;
  experience: string;
  maxPrice: string;
};

function buildState(params: URLSearchParams): SearchState {
  return {
    search: params.get('search') ?? '',
    category: params.get('category') ?? 'Todos',
    location: params.get('location') ?? '',
    experience: params.get('experience') ?? 'Todos',
    maxPrice: params.get('maxPrice') ?? '',
  };
}

export function SearchPage() {
  const { session } = useAppSession();
  const location = useLocation();
  const canViewPrices = session?.role === 'client';
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<SearchState>(() => buildState(searchParams));
  const deferredSearch = useDeferredValue(filters.search);
  const [results, setResults] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setFilters(buildState(searchParams));
  }, [searchParams]);

  useEffect(() => {
    const controller = new AbortController();

    async function loadResults() {
      setLoading(true);
      setError(null);

      try {
        const data = await api.getFreelancers(
          {
            search: deferredSearch,
            category: filters.category !== 'Todos' ? filters.category : '',
            location: filters.location,
            experience: filters.experience !== 'Todos' ? filters.experience : '',
            maxPrice: canViewPrices ? filters.maxPrice : '',
          },
          {
            signal: controller.signal,
          },
        );

        if (!controller.signal.aborted) {
          setResults(data);
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(loadError instanceof Error ? loadError.message : 'Erro ao carregar profissionais.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadResults();

    return () => controller.abort();
  }, [
    canViewPrices,
    deferredSearch,
    filters.category,
    filters.experience,
    filters.location,
    filters.maxPrice,
  ]);

  function handleChange(name: keyof SearchState, value: string) {
    const nextState = {
      ...filters,
      [name]: value,
    };

    setFilters(nextState);
    startTransition(() => {
      const nextParams = new URLSearchParams();

      Object.entries(nextState).forEach(([key, currentValue]) => {
        if (key === 'maxPrice' && !canViewPrices) {
          return;
        }

        if (currentValue && currentValue !== 'Todos') {
          nextParams.set(key, currentValue);
        }
      });

      setSearchParams(nextParams);
    });
  }

  return (
    <div className="container py-14">
      <section className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <SectionHeading
            description={
              canViewPrices
                ? 'Pesquise por categoria, localização, experiência e orçamento em uma busca otimizada para descoberta rápida.'
                : 'Pesquise por categoria, localização e experiência. O valor médio permanece protegido até o login como cliente.'
            }
            eyebrow="Busca de freelancers"
            title="Compare profissionais com mais clareza e sem se perder em listas confusas."
          />
        </div>

        <aside className="glass-panel tech-panel rounded-[32px] p-6 shadow-soft">
          <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-700">
            Como funciona
          </p>
          <h2 className="mt-4 text-2xl font-bold text-slate-950">
            {canViewPrices
              ? 'Sua conta já liberou preço e contato.'
              : 'Descubra primeiro. Libere preço e contato quando quiser.'}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {canViewPrices
              ? 'Agora você pode comparar orçamento e iniciar conversa sem sair do fluxo principal da plataforma.'
              : 'Você já pode conhecer os profissionais. Quando quiser avançar, o login libera preço médio e o canal de mensagem.'}
          </p>

          <div className="mt-6 rounded-[28px] border border-slate-200/80 bg-white/90 p-5">
            {canViewPrices ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-cyan-300/20 bg-cyan-500/5 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-cyan-700">
                    Preços
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">Filtro de orçamento ativo</p>
                </div>
                <div className="rounded-[22px] border border-slate-200/80 bg-slate-50 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-[0.22em] text-slate-500">
                    Contato
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">Lead registrado no backend</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <PriceMask
                  hint="Entre como cliente para liberar valor médio e envio de mensagem."
                  state={{ from: location }}
                  to="/login"
                />
                <div className="flex flex-wrap gap-3">
                  <Link
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                    state={{ from: location }}
                    to="/login"
                  >
                    Entrar agora
                  </Link>
                  <Link
                    className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-500/15"
                    to="/cadastro/cliente"
                  >
                    Criar conta de cliente
                  </Link>
                </div>
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="glass-panel tech-panel mt-10 rounded-[32px] p-6 shadow-soft lg:p-8">
        <div
          className={`grid gap-4 ${
            canViewPrices
              ? 'lg:grid-cols-[2fr_1fr_1fr_1fr_1fr]'
              : 'lg:grid-cols-[2fr_1fr_1fr_1fr]'
          }`}
        >
          <FormField
            label="Busca"
            name="search"
            onChange={(event) => handleChange('search', event.target.value)}
            placeholder="Nome, profissão ou habilidade"
            value={filters.search}
          />
          <FormField
            label="Categoria"
            name="category"
            onChange={(event) => handleChange('category', event.target.value)}
            options={['Todos', ...categories]}
            value={filters.category}
          />
          <FormField
            label="Localização"
            name="location"
            onChange={(event) => handleChange('location', event.target.value)}
            placeholder="Cidade, estado"
            value={filters.location}
          />
          <FormField
            label="Experiência"
            name="experience"
            onChange={(event) => handleChange('experience', event.target.value)}
            options={['Todos', ...experienceLevels]}
            value={filters.experience}
          />
          {canViewPrices ? (
            <FormField
              label="Preço máximo"
              min="1"
              name="maxPrice"
              onChange={(event) => handleChange('maxPrice', event.target.value)}
              placeholder="Ex: 1500"
              type="number"
              value={filters.maxPrice}
            />
          ) : null}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-slate-200/80 bg-white/80 px-5 py-4 text-sm text-slate-600">
          <p>
            {canViewPrices
              ? 'Sua sessão já pode cruzar especialidade, experiência e orçamento.'
              : 'Você pode explorar sem barreiras. Preço e mensagem aparecem quando fizer sentido avançar.'}
          </p>
          {!canViewPrices ? (
            <Link
              className="font-semibold text-cyan-700 transition hover:text-cyan-500"
              state={{ from: location }}
              to="/login"
            >
              Liberar acesso
            </Link>
          ) : (
            <span className="font-mono text-[11px] uppercase tracking-[0.24em] text-cyan-700">
              Preços liberados
            </span>
          )}
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-slate-500">
            {loading ? 'Atualizando resultados...' : `${results.length} profissionais encontrados`}
          </p>
          <p className="text-xs font-medium text-cyan-700">
            Perfis com booster aparecem primeiro e com destaque visual.
          </p>
        </div>
        <p className="font-mono text-[11px] uppercase tracking-[0.24em] text-slate-400">
          {canViewPrices ? 'Fluxo de contato ativo' : 'Fluxo de contato protegido'}
        </p>
      </div>

      {error ? (
        <div className="mt-8 rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 xl:grid-cols-2">
        {results.map((freelancer) => (
          <FreelancerCard key={freelancer.id} freelancer={freelancer} />
        ))}
      </div>

      {!loading && results.length === 0 && !error ? (
        <div className="mt-8 rounded-[30px] border border-slate-200/80 bg-white/90 px-6 py-8 text-center shadow-soft">
          <p className="text-lg font-bold text-slate-950">Nenhum freelancer encontrado.</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Ajuste os filtros e teste outra combinação de habilidade, categoria ou localização.
          </p>
        </div>
      ) : null}
    </div>
  );
}
