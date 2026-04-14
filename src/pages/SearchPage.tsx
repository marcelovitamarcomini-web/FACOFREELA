import { startTransition, useDeferredValue, useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import {
  categories,
  shouldUseRegionalSearch,
  type Freelancer,
} from '../../shared/contracts';
import { FreelancerCard } from '../components/FreelancerCard';
import { FormField } from '../components/FormField';
import { SectionHeading } from '../components/SectionHeading';
import { useAppSession } from '../context/AppSessionContext';
import { api } from '../lib/api';
import { buildBrazilLocation } from '../lib/brazil-states';

type SearchState = {
  search: string;
  category: string;
  location: string;
};

type ClientBaseLocation = {
  cep: string;
  city: string;
  state: string;
  location: string;
};

function buildState(params: URLSearchParams): SearchState {
  return {
    search: params.get('search') ?? '',
    category: params.get('category') ?? 'Todos',
    location: params.get('location') ?? '',
  };
}

function buildSearchParams(state: SearchState) {
  const nextParams = new URLSearchParams();

  Object.entries(state).forEach(([key, currentValue]) => {
    if (currentValue && currentValue !== 'Todos') {
      nextParams.set(key, currentValue);
    }
  });

  return nextParams;
}

export function SearchPage() {
  const { session } = useAppSession();
  const hasClientSession = session?.role === 'client';
  const [searchParams, setSearchParams] = useSearchParams();
  const [filters, setFilters] = useState<SearchState>(() => buildState(searchParams));
  const [clientBaseLocation, setClientBaseLocation] = useState<ClientBaseLocation | null>(null);
  const userAdjustedLocationRef = useRef(Boolean(searchParams.get('location')));
  const deferredSearch = useDeferredValue(filters.search);
  const [results, setResults] = useState<Freelancer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const categoryUsesRegion = shouldUseRegionalSearch(filters.category);

  function applyFilters(nextState: SearchState) {
    setFilters(nextState);
    startTransition(() => {
      setSearchParams(buildSearchParams(nextState));
    });
  }

  useEffect(() => {
    let cancelled = false;

    async function loadClientBaseLocation() {
      if (session?.role !== 'client') {
        setClientBaseLocation(null);
        return;
      }

      try {
        const data = await api.getOwnClientLocation();
        if (cancelled) {
          return;
        }

        const normalizedLocation = buildBrazilLocation(data.city, data.state);
        setClientBaseLocation(
          normalizedLocation
            ? {
                ...data,
                location: normalizedLocation,
              }
            : null,
        );
      } catch {
        if (!cancelled) {
          setClientBaseLocation(null);
        }
      }
    }

    void loadClientBaseLocation();

    return () => {
      cancelled = true;
    };
  }, [session?.id, session?.role]);

  useEffect(() => {
    if (
      session?.role !== 'client' ||
      !clientBaseLocation?.location ||
      userAdjustedLocationRef.current
    ) {
      return;
    }

    if (!categoryUsesRegion && filters.location) {
      applyFilters({
        ...filters,
        location: '',
      });
      return;
    }

    if (categoryUsesRegion && !filters.location) {
      applyFilters({
        ...filters,
        location: clientBaseLocation.location,
      });
    }
  }, [
    categoryUsesRegion,
    clientBaseLocation?.location,
    filters,
    session?.role,
  ]);

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
  }, [deferredSearch, filters.category, filters.location]);

  function handleChange(name: keyof SearchState, value: string) {
    const nextState: SearchState = {
      ...filters,
      [name]: value,
    };

    if (name === 'location') {
      userAdjustedLocationRef.current = true;
    }

    if (name === 'category') {
      const nextCategoryUsesRegion = shouldUseRegionalSearch(value);

      if (
        !nextCategoryUsesRegion &&
        !userAdjustedLocationRef.current &&
        clientBaseLocation?.location &&
        nextState.location === clientBaseLocation.location
      ) {
        nextState.location = '';
      }

      if (
        nextCategoryUsesRegion &&
        !userAdjustedLocationRef.current &&
        clientBaseLocation?.location &&
        !nextState.location
      ) {
        nextState.location = clientBaseLocation.location;
      }
    }

    applyFilters(nextState);
  }

  return (
    <div className="container py-10 sm:py-12 lg:py-14">
      <section className="grid gap-8 xl:grid-cols-[1.15fr_0.85fr] xl:items-start">
        <div>
          <SectionHeading
            description="Pesquise por categoria e localização para encontrar desde serviços locais até trabalhos técnicos, criativos e digitais."
            eyebrow="Busca de profissionais"
            title="Encontre serviços de diferentes áreas com uma busca mais clara e organizada."
          />
        </div>

        <aside className="glass-panel tech-panel rounded-[32px] p-6">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
            Como funciona
          </p>
          <h2 className="mt-4 text-2xl font-bold text-slate-950">
            {hasClientSession
              ? 'Sua conta já pode seguir para contato externo.'
              : 'Explore os perfis e siga pelo canal que fizer sentido.'}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {hasClientSession
              ? 'Agora você já pode comparar profissionais e abrir WhatsApp, site ou LinkedIn de cada perfil sem depender de chat interno.'
              : 'Você já pode conhecer os profissionais com calma. Quando quiser avançar, abra o perfil e siga para o contato externo disponível.'}
          </p>

          <div className="mt-6 rounded-[28px] border border-slate-200/80 bg-white/90 p-5">
            {hasClientSession ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[22px] border border-slate-200/80 bg-slate-50 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Perfis
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    Busca e comparação liberadas
                  </p>
                </div>
                <div className="rounded-[22px] border border-[#0071e3]/12 bg-[#0071e3]/5 p-4">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0071e3]">
                    Contato
                  </p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    WhatsApp, site e links externos
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-sm leading-6 text-slate-600">
                  Criar conta de cliente ajuda a organizar favoritos, pedidos e histórico da sua
                  navegação, mas o primeiro contato já pode acontecer fora do site.
                </p>
                <div className="flex flex-wrap gap-3">
                  <Link
                    className="inline-flex min-h-[44px] items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[#0071e3]/30 hover:text-[#0071e3]"
                    to="/cadastro/cliente"
                  >
                    Criar conta de cliente
                  </Link>
                  <Link
                    className="inline-flex min-h-[44px] items-center rounded-full border border-[#0071e3]/20 bg-[#0071e3]/6 px-4 py-2 text-sm font-semibold text-[#0071e3] transition hover:bg-[#0071e3]/10"
                    to="/login"
                  >
                    Entrar
                  </Link>
                </div>
              </div>
            )}
          </div>
        </aside>
      </section>

      <section className="glass-panel tech-panel mt-10 rounded-[32px] p-5 sm:p-6 lg:p-8">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-[2fr_1fr_1fr]">
          <FormField
            className="md:col-span-2 xl:col-span-1"
            label="Busca"
            name="search"
            onChange={(event) => handleChange('search', event.target.value)}
            placeholder="Nome, profissão, serviço ou habilidade"
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
            placeholder={categoryUsesRegion ? 'Cidade, estado' : 'Opcional para serviço digital'}
            value={filters.location}
          />
        </div>

        {hasClientSession && clientBaseLocation ? (
          <div className="mt-4 rounded-[24px] border border-slate-200/80 bg-white/75 px-4 py-3 text-xs leading-6 text-slate-500">
            {categoryUsesRegion
              ? `Sua base principal salva é ${clientBaseLocation.location}. Usamos essa região como ponto de partida nas categorias locais, mas você pode ajustar quando quiser.`
              : 'Nesta categoria a região fica opcional por padrão. Se quiser, você ainda pode informar cidade ou estado manualmente.'}
          </div>
        ) : null}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-[28px] border border-slate-200/80 bg-white/80 px-5 py-4 text-sm text-slate-600">
          <p>
            {hasClientSession
              ? 'Sua sessão já pode cruzar tipo de serviço e seguir para o contato externo direto no perfil.'
              : 'Você pode explorar sem barreiras. O perfil mostra quando existe WhatsApp, site ou outro atalho externo.'}
          </p>
          {!hasClientSession ? (
            <Link
              className="inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-semibold text-[#0071e3] transition hover:bg-[#0071e3]/6 hover:text-[#0077ed]"
              to="/cadastro/cliente"
            >
              Criar conta
            </Link>
          ) : (
            <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#0071e3]">
              Contato externo ativo
            </span>
          )}
        </div>
      </section>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm text-slate-500">
            {loading ? 'Atualizando resultados...' : `${results.length} profissionais encontrados`}
          </p>
          <p className="text-xs font-medium text-[#0071e3]">
            Perfis com booster aparecem primeiro e com destaque visual.
          </p>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
          {hasClientSession ? 'Fluxo com contato externo' : 'Perfil pronto para contato externo'}
        </p>
      </div>

      {error ? (
        <div className="mt-8 rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        {results.map((freelancer) => (
          <FreelancerCard key={freelancer.id} freelancer={freelancer} />
        ))}
      </div>

      {!loading && results.length === 0 && !error ? (
        <div className="mt-8 rounded-[30px] border border-slate-200/80 bg-white/90 px-6 py-8 text-center shadow-soft">
          <p className="text-lg font-bold text-slate-950">Nenhum profissional encontrado.</p>
          <p className="mt-2 text-sm leading-6 text-slate-500">
            Ajuste os filtros e teste outra combinação de serviço, categoria ou localização.
          </p>
        </div>
      ) : null}
    </div>
  );
}
