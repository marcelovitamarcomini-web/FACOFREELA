import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import heroPracticeIllustration from '../../incial_2.png';

const coreBenefits = [
  {
    eyebrow: 'Mais fácil de achar',
    title: 'Ache quem faz o serviço que você precisa',
    description:
      'Encontre chaveiro, pedreiro, guincho, designer, arquiteto, programador e muitos outros em um só lugar.',
  },
  {
    eyebrow: 'Tudo mais simples',
    title: 'Veja, compare e fale sem complicação',
    description:
      'O caminho fica mais simples para buscar, olhar perfis, abrir contato e seguir com o serviço.',
  },
  {
    eyebrow: 'Contato sem atrito',
    title: 'Siga pelo canal que fizer sentido',
    description:
      'Cliente e profissional podem seguir pelo WhatsApp, site ou outro canal externo logo no primeiro contato.',
  },
];

const heroFacts = [
  {
    label: 'Entender rápido',
    value: 'A proposta do site aparece logo no topo, sem depender de excesso de texto.',
  },
  {
    label: 'Comparar melhor',
    value: 'Cidade, disponibilidade e contexto entram cedo na leitura da plataforma.',
  },
  {
    label: 'Seguir com ordem',
    value: 'Busca, perfil e saída para contato externo continuam no mesmo fluxo, com menos ruído.',
  },
];

const heroBoard = [
  {
    label: 'Busca ativa',
    value: 'Eletricista · Campinas · hoje',
  },
  {
    label: 'Leitura do perfil',
    value: 'Área atendida · resposta média · disponibilidade',
  },
  {
    label: 'Próximo passo',
    value: 'Abrir perfil e seguir para WhatsApp ou link externo',
  },
];

const featuredCategories = [
  {
    title: 'Conserto em casa',
    description: 'Chaveiro, eletricista, encanador, montador e ajuda no dia a dia.',
    filter: 'Conserto em Casa',
    signal: 'Casa',
  },
  {
    title: 'Obra e reforma',
    description: 'Pedreiro, pintor, gesseiro, arquiteto, engenheiro e apoio para obra.',
    filter: 'Obra e Reforma',
    signal: 'Obra',
  },
  {
    title: 'Frete e guincho',
    description: 'Guincho, frete, mudança, entrega e ajuda de rua ou emergência.',
    filter: 'Frete e Guincho',
    signal: 'Rua',
  },
  {
    title: 'Instalação e manutenção',
    description: 'Instalação, manutenção, vistoria, refrigeração e serviços técnicos.',
    filter: 'Instalação e Manutenção',
    signal: 'Serviço',
  },
  {
    title: 'Design e vídeo',
    description: 'Logo, arte, social media, vídeo, foto e apresentação.',
    filter: 'Design e Vídeo',
    signal: 'Criativo',
  },
  {
    title: 'Marketing e redes',
    description: 'Anúncios, redes sociais, texto, atendimento e apoio para vender mais.',
    filter: 'Marketing e Redes',
    signal: 'Marca',
  },
  {
    title: 'Sites e tecnologia',
    description: 'Site, sistema, suporte digital, automação e programação.',
    filter: 'Sites e Tecnologia',
    signal: 'Online',
  },
  {
    title: 'Projetos e consultoria',
    description: 'Arquitetura, engenharia, aulas, planejamento e orientação profissional.',
    filter: 'Projetos e Consultoria',
    signal: 'Projeto',
  },
];

const featuredCategoryAccents = [
  {
    card: 'border-[#0071e3]/16 bg-[linear-gradient(180deg,rgba(255,255,255,0.995)_0%,rgba(245,249,255,0.98)_100%)] hover:border-[#0071e3]/30',
    glow: 'bg-[radial-gradient(circle,rgba(0,113,227,0.12)_0%,rgba(0,113,227,0)_72%)]',
    chip: 'border-[#d9e7ff] bg-[#eff6ff] text-[#0f4fd8] group-hover:bg-[#e6f0ff]',
    filter: 'text-[#0f4fd8]',
  },
  {
    card: 'border-[#d6b75a]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.995)_0%,rgba(255,249,236,0.98)_100%)] hover:border-[#c69111]/28',
    glow: 'bg-[radial-gradient(circle,rgba(198,145,17,0.14)_0%,rgba(198,145,17,0)_72%)]',
    chip: 'border-[#f2e1ae] bg-[#fff4cf] text-[#9a6700] group-hover:bg-[#ffefbf]',
    filter: 'text-[#9a6700]',
  },
  {
    card: 'border-[#19a38c]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.995)_0%,rgba(238,252,249,0.98)_100%)] hover:border-[#168f7b]/28',
    glow: 'bg-[radial-gradient(circle,rgba(22,143,123,0.15)_0%,rgba(22,143,123,0)_72%)]',
    chip: 'border-[#c8f2e8] bg-[#eafcf7] text-[#0f766e] group-hover:bg-[#ddf9f1]',
    filter: 'text-[#0f766e]',
  },
  {
    card: 'border-[#4f8df1]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.995)_0%,rgba(241,247,255,0.98)_100%)] hover:border-[#2f6fdd]/28',
    glow: 'bg-[radial-gradient(circle,rgba(47,111,221,0.14)_0%,rgba(47,111,221,0)_72%)]',
    chip: 'border-[#d7e6ff] bg-[#edf4ff] text-[#2256b8] group-hover:bg-[#e4efff]',
    filter: 'text-[#2256b8]',
  },
  {
    card: 'border-[#e48d6e]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.995)_0%,rgba(255,244,240,0.98)_100%)] hover:border-[#d46c45]/28',
    glow: 'bg-[radial-gradient(circle,rgba(212,108,69,0.14)_0%,rgba(212,108,69,0)_72%)]',
    chip: 'border-[#ffd8ca] bg-[#fff0ea] text-[#b4532b] group-hover:bg-[#ffe7dd]',
    filter: 'text-[#b4532b]',
  },
  {
    card: 'border-[#e08062]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.995)_0%,rgba(255,243,239,0.98)_100%)] hover:border-[#cc5f3d]/28',
    glow: 'bg-[radial-gradient(circle,rgba(204,95,61,0.14)_0%,rgba(204,95,61,0)_72%)]',
    chip: 'border-[#ffd7cf] bg-[#fff0ec] text-[#b4492a] group-hover:bg-[#ffe6df]',
    filter: 'text-[#b4492a]',
  },
  {
    card: 'border-[#5e93dc]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.995)_0%,rgba(243,248,255,0.98)_100%)] hover:border-[#3d73c7]/28',
    glow: 'bg-[radial-gradient(circle,rgba(61,115,199,0.14)_0%,rgba(61,115,199,0)_72%)]',
    chip: 'border-[#d9e7ff] bg-[#eef4ff] text-[#2f5fab] group-hover:bg-[#e4eeff]',
    filter: 'text-[#2f5fab]',
  },
  {
    card: 'border-[#5fb197]/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.995)_0%,rgba(239,251,247,0.98)_100%)] hover:border-[#3e9176]/28',
    glow: 'bg-[radial-gradient(circle,rgba(62,145,118,0.14)_0%,rgba(62,145,118,0)_72%)]',
    chip: 'border-[#d2f0e6] bg-[#edf9f4] text-[#2f7d64] group-hover:bg-[#e1f6ed]',
    filter: 'text-[#2f7d64]',
  },
] as const;

const clientFlow = [
  {
    step: '01',
    title: 'Ache o serviço',
    description:
      'Busque por tipo de serviço, cidade ou necessidade e ache ajuda mais rápido.',
  },
  {
    step: '02',
    title: 'Veja quem combina com você',
    description:
      'Compare perfis, cidade atendida, experiência e forma de trabalho de um jeito simples.',
  },
  {
    step: '03',
    title: 'Abra contato e avance',
    description:
      'Abra o perfil, escolha WhatsApp, site ou LinkedIn e siga com o serviço de forma mais direta.',
  },
];

const freelancerFlow = [
  {
    step: '01',
    title: 'Monte seu perfil',
    description:
      'Cadastre seu trabalho com uma apresentação clara e fácil de entender.',
  },
  {
    step: '02',
    title: 'Mostre o que você faz',
    description:
      'Explique o que você faz, onde atende e que tipo de serviço você pega.',
  },
  {
    step: '03',
    title: 'Receba leads qualificados',
    description:
      'Use o perfil para concentrar interesse e levar o primeiro contato para WhatsApp, site ou LinkedIn.',
  },
];

const platformTags = [
  'clareza',
  'atendimento',
  'orçamento',
  'agenda',
  'projetos',
  'contato externo',
];

type HowItWorksTab = 'platform' | 'clients' | 'freelancers';

const howItWorksTabs: Array<{ id: HowItWorksTab; label: string }> = [
  { id: 'platform', label: 'No site' },
  { id: 'clients', label: 'Para clientes' },
  { id: 'freelancers', label: 'Para freelancers' },
];

const platformHighlights = [
  {
    eyebrow: 'Perfil objetivo',
    title: 'Serviço, localização e experiência aparecem sem excesso de ruído.',
  },
  {
    eyebrow: 'Contato no fluxo',
    title: 'O perfil vira ponte para WhatsApp, site e outros canais externos.',
  },
];

const platformExamples = [
  {
    title: 'Cliente encontra o que precisa',
    description: 'Busca por cidade, tipo de serviço e perfil de um jeito mais direto.',
  },
  {
    title: 'Profissional mostra o que faz',
    description:
      'O perfil valoriza trabalho, disponibilidade e área atendida, não só portfólio digital.',
  },
  {
    title: 'O próximo passo fica claro',
    description: 'O perfil reúne as informações principais e já aponta para o canal externo disponível.',
  },
];

function sectionLink(filter: string) {
  return `/freelancers?category=${encodeURIComponent(filter)}`;
}

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="space-y-2.5 sm:space-y-3">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0f4fd8] sm:text-[11px] sm:tracking-[0.16em]">
        {eyebrow}
      </p>
      <h2 className="max-w-3xl text-[1.9rem] font-semibold leading-[1.04] tracking-[-0.045em] text-slate-950 sm:text-4xl sm:leading-none sm:tracking-[-0.04em]">
        {title}
      </h2>
      <p className="max-w-2xl text-[0.95rem] leading-6 text-slate-600 sm:text-base sm:leading-7">
        {description}
      </p>
    </div>
  );
}

function StepCard({
  step,
  title,
  description,
}: {
  step: string;
  title: string;
  description: string;
}) {
  return (
    <article className="ff-card-lift rounded-[24px] border border-slate-200 bg-white px-5 py-5 shadow-[0_10px_26px_rgba(15,23,42,0.04)]">
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0071e3] text-sm font-semibold text-white shadow-[0_12px_24px_rgba(0,113,227,0.18)]">
          {step}
        </span>
        <div>
          <p className="text-lg font-bold text-slate-950">{title}</p>
          <p className="mt-2 text-sm leading-7 text-slate-600">{description}</p>
        </div>
      </div>
    </article>
  );
}

export function HomePage() {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<HowItWorksTab>('platform');

  useEffect(() => {
    const sectionId = decodeURIComponent(location.hash.slice(1));

    if (sectionId === 'para-clientes') {
      setActiveTab('clients');
      return;
    }

    if (sectionId === 'para-freelancers') {
      setActiveTab('freelancers');
      return;
    }

    if (sectionId === 'como-funciona') {
      setActiveTab('platform');
    }
  }, [location.hash]);

  const activeFlow = activeTab === 'clients' ? clientFlow : freelancerFlow;

  return (
    <div className="space-y-20 pb-14 pt-8 sm:space-y-28 sm:pb-16 sm:pt-12">
      <section className="container">
        <div className="section-shell relative overflow-hidden rounded-[32px] px-5 py-6 sm:rounded-[44px] sm:px-9 sm:py-10 lg:px-12 lg:py-12">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(circle_at_top,rgba(0,113,227,0.12),transparent_60%)]"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-[-4rem] h-40 w-40 rounded-full bg-sky-200/35 blur-3xl"
          />

          <div className="relative grid gap-8 sm:gap-10 lg:grid-cols-[1.02fr_0.98fr] lg:items-center">
            <div className="ff-fade-up space-y-6 sm:space-y-8">
              <div className="inline-flex rounded-full border border-[#cfe0ff] bg-[#eff6ff] px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0f4fd8] sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.16em]">
                Plataforma clara para contratar e oferecer serviços
              </div>

              <div className="space-y-4 sm:space-y-6">
                <h1 className="hero-display-title max-w-4xl text-[2.45rem] leading-[0.98] text-slate-950 sm:text-6xl lg:text-[3.7rem] lg:leading-[0.98] xl:text-[4.2rem]">
                  Contratar ou oferecer serviços com mais clareza desde o primeiro clique.
                </h1>
                <p className="max-w-3xl text-[0.98rem] leading-7 text-slate-500 sm:text-[1.12rem] sm:leading-8">
                  O Faço Freela reúne busca, perfil e saída para contato externo em uma
                  experiência clean, tecnológica e fácil de entender para clientes e freelancers.
                </p>
              </div>

              <div className="flex flex-col gap-2.5 sm:flex-row sm:flex-wrap sm:gap-3">
                <Link
                  className="inline-flex w-full items-center justify-center rounded-full bg-[#0071e3] px-5 py-3 text-[0.95rem] font-semibold text-white shadow-[0_12px_28px_rgba(0,113,227,0.22)] transition hover:bg-[#0077ed] sm:w-auto sm:px-6 sm:text-sm"
                  to="/freelancers"
                >
                  Encontrar serviços
                </Link>
                <Link
                  className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-[0.95rem] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 sm:w-auto sm:px-6 sm:text-sm"
                  to="/cadastro/freelancer"
                >
                  Quero oferecer serviços
                </Link>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                {heroFacts.map((item) => (
                  <div
                    key={item.label}
                    className="panel-outline ff-card-lift rounded-[22px] p-3.5 sm:rounded-[26px] sm:p-4"
                  >
                    <p className="text-[10px] uppercase tracking-[0.16em] text-[#0f4fd8] sm:text-xs sm:tracking-[0.18em]">
                      {item.label}
                    </p>
                    <p className="mt-2 text-[0.92rem] font-semibold leading-6 text-slate-950 sm:text-sm">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <aside className="ff-fade-up ff-delay-1 relative lg:ml-auto lg:max-w-[36rem] xl:max-w-[38rem]">
              <div className="panel-outline ff-card-lift rounded-[24px] p-4 sm:rounded-[32px] sm:p-5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-[11px] sm:tracking-[0.22em]">
                    Painel inicial
                  </p>
                  <span className="rounded-full border border-[#cfe0ff] bg-[#eaf2ff] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0f4fd8] sm:px-3 sm:text-[11px] sm:tracking-[0.16em]">
                    Inteligência do fluxo
                  </span>
                </div>

                <p className="mt-2.5 text-[0.92rem] leading-6 text-slate-600 sm:mt-3 sm:text-sm">
                  A plataforma já transmite ordem antes do cadastro: a leitura do problema, do
                  perfil e do próximo passo acontece no mesmo caminho.
                </p>

                <div className="relative mt-4">
                  <div className="absolute left-4 top-4 z-10 hidden max-w-[13rem] rounded-[20px] border border-slate-200 bg-white/96 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.12)] lg:block">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0f4fd8]">
                      Busca ativa
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      Eletricista em Campinas com urgência para hoje.
                    </p>
                  </div>

                  <div className="absolute bottom-4 right-4 z-10 hidden max-w-[13rem] rounded-[20px] border border-slate-200 bg-white/96 px-4 py-3 shadow-[0_18px_40px_rgba(15,23,42,0.12)] xl:block">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Leitura rápida
                    </p>
                    <p className="mt-2 text-sm font-semibold text-slate-950">
                      Área atendida, resposta média e próximo passo aparecem cedo.
                    </p>
                  </div>

                  <div className="overflow-hidden rounded-[28px] border border-[#0071e3]/14 bg-[linear-gradient(180deg,#f8fbff_0%,#edf4ff_100%)] p-2 sm:p-2.5">
                    <img
                      alt="Ilustração da tela inicial do Faço Freela mostrando cliente, freelancer e proposta conectados."
                      className="block aspect-square w-full rounded-[22px] object-cover object-center"
                      src={heroPracticeIllustration}
                    />
                  </div>
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {heroBoard.map((item) => (
                    <div key={item.label} className="rounded-[22px] border border-slate-200 bg-white px-4 py-3.5">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {item.label}
                      </p>
                      <p className="mt-2 text-[0.88rem] font-semibold leading-6 text-slate-950">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="container">
        <SectionIntro
          description={'A ideia é simples: a pessoa bate o olho e já entende que pode achar ajuda ou oferecer serviço\u00A0aqui.'}
          eyebrow="Benefícios centrais"
          title="Tudo pensado para ficar simples para mais gente."
        />

        <div className="mt-8 overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_8px_22px_rgba(15,23,42,0.03)] sm:mt-10 sm:rounded-[34px]">
          {coreBenefits.map((item, index) => (
            <article
              key={item.title}
              className="grid gap-3.5 border-t border-slate-200 px-4 py-4.5 first:border-t-0 sm:px-7 sm:py-6 lg:grid-cols-[5.5rem_13rem_minmax(0,1fr)] lg:items-start lg:gap-6"
            >
              <span className="text-[2rem] font-semibold tracking-[-0.06em] text-slate-200 sm:text-4xl">
                0{index + 1}
              </span>
              <p className="pt-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:pt-1 sm:text-[11px] sm:tracking-[0.16em]">
                {item.eyebrow}
              </p>
              <div className="space-y-2.5 sm:space-y-3">
                <h3 className="text-[1.22rem] font-bold leading-[1.15] text-slate-950 sm:text-2xl">
                  {item.title}
                </h3>
                <p className="max-w-3xl text-[0.92rem] leading-6 text-slate-600 sm:text-sm sm:leading-7">
                  {item.description}
                </p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container" id="servicos">
        <div className="flex flex-col gap-5 sm:gap-6 lg:flex-row lg:items-end lg:justify-between">
          <SectionIntro
            description="A home mostra as áreas principais sem voltar a parecer um marketplace carregado."
            eyebrow="Serviços em destaque"
            title="Veja os tipos de serviço mais procurados."
          />

          <Link
            className="inline-flex w-fit items-center justify-center rounded-full border border-slate-200 bg-white px-5 py-3 text-[0.95rem] font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-950 sm:text-sm"
            to="/freelancers"
          >
            Ver todas as categorias
          </Link>
        </div>

        <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-2 xl:grid-cols-4">
          {featuredCategories.map((category, index) => {
            const accent = featuredCategoryAccents[index % featuredCategoryAccents.length];

            return (
            <Link
              key={`${category.title}-${category.filter}`}
              className={`group ff-card-lift relative flex h-full min-h-[15.5rem] flex-col overflow-hidden rounded-[24px] border p-4 shadow-[0_12px_30px_rgba(15,23,42,0.045)] transition duration-200 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0071e3]/14 sm:rounded-[28px] sm:p-5 ${accent.card}`}
              to={sectionLink(category.filter)}
            >
              <div
                aria-hidden
                className={`pointer-events-none absolute right-0 top-0 h-24 w-24 rounded-full ${accent.glow}`}
              />

              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-slate-200 bg-white/88 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-3 sm:text-[11px] sm:tracking-[0.14em]">
                  {category.signal}
                </span>
                <span
                  className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] transition sm:px-3 sm:text-[11px] sm:tracking-[0.14em] ${accent.chip}`}
                >
                  Busca pronta
                </span>
              </div>

              <div className="relative mt-4 flex-1">
                <h3 className="text-[1.14rem] font-bold leading-[1.15] text-slate-950 sm:mt-1 sm:text-[1.35rem]">
                  {category.title}
                </h3>
                <p className="mt-2.5 text-[0.9rem] leading-6 text-slate-600 sm:text-[0.95rem] sm:leading-7">
                  {category.description}
                </p>
              </div>

              <div className="mt-5 flex items-end justify-between gap-3 border-t border-slate-100 pt-4">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Filtro
                  </p>
                  <p className={`mt-1 truncate text-[0.84rem] font-semibold sm:text-[0.88rem] ${accent.filter}`}>
                    {category.filter}
                  </p>
                </div>
                <span className="shrink-0 text-[0.82rem] font-semibold text-slate-400 transition group-hover:text-slate-700 sm:text-sm">
                  Ver categoria
                </span>
              </div>
            </Link>
            );
          })}
        </div>
      </section>

      <section className="container" id="como-funciona">
        <SectionIntro
          description="O caminho foi montado para qualquer pessoa entender rápido o que fazer, seja para contratar ou para trabalhar."
          eyebrow="Como funciona"
          title="Um jeito fácil de usar para quem procura e para quem oferece serviço."
        />

        <div className="h-0 overflow-hidden">
          <div id="para-clientes" />
          <div id="para-freelancers" />
        </div>

        <div className="mt-10 rounded-[36px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fb_100%)] p-6 shadow-[0_14px_42px_rgba(15,23,42,0.06)] xl:p-7">
          <div className="flex flex-wrap gap-3 border-b border-slate-200 pb-5">
            {howItWorksTabs.map((tab) => {
              const isActive = activeTab === tab.id;

              return (
                <button
                  key={tab.id}
                  className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-[#0071e3] text-white shadow-[0_10px_24px_rgba(0,113,227,0.2)]'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950'
                  }`}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {activeTab === 'platform' ? (
            <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr] xl:items-start">
              <div className="space-y-6">
                <div className="rounded-[28px] border border-slate-200 bg-white p-6">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Como funciona no site
                  </p>
                  <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                    Busca, perfil e contato ficam no mesmo fluxo.
                  </h3>
                  <p className="mt-4 text-sm leading-7 text-slate-600">
                    A proposta é juntar busca, perfil e saída para contato em um caminho só. Assim,
                    quem entra entende rápido como achar alguém e como seguir com o serviço.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  {platformTags.map((tag) => (
                    <span
                      key={tag}
                      className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="rounded-[24px] border border-[#cfe0ff] bg-[#edf5ff] p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#0f4fd8]">
                    Leitura inteligente
                  </p>
                  <p className="mt-2 text-sm font-semibold leading-6 text-slate-950">
                    A interface deixa claro o que procurar, o que comparar e qual é o próximo passo.
                  </p>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {platformHighlights.map((item) => (
                  <div key={item.title} className="ff-card-lift rounded-[28px] border border-slate-200 bg-white p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      {item.eyebrow}
                    </p>
                    <p className="mt-3 text-lg font-bold text-slate-950">{item.title}</p>
                  </div>
                ))}

                <div className="rounded-[28px] border border-slate-200 bg-white p-5 sm:col-span-2">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Exemplo de uso
                  </p>
                  <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                    Menos enrolação, mais cara de serviço bem resolvido.
                  </h3>

                  <div className="mt-5 grid gap-3 xl:grid-cols-3">
                    {platformExamples.map((item) => (
                      <div key={item.title} className="ff-card-lift rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                        <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                        <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="mt-6">
              <div className="max-w-3xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  {activeTab === 'clients' ? 'Para clientes' : 'Para freelancers'}
                </p>
                <h3 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                  {activeTab === 'clients'
                    ? 'Mais facilidade para achar, escolher e seguir com o serviço certo.'
                    : 'Um jeito melhor de mostrar seu trabalho e receber pedidos.'}
                </h3>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                  {activeTab === 'clients'
                    ? 'O caminho foi pensado para comparar melhor, abrir o perfil certo e seguir para contato externo sem ruído logo no primeiro passo.'
                    : 'A plataforma ajuda o profissional a se apresentar com mais clareza e transformar o perfil em ponte para novos contatos.'}
                </p>
              </div>

              <div className="mt-8 grid gap-4 xl:grid-cols-3">
                {activeFlow.map((item) => (
                  <StepCard
                    key={`${activeTab}-${item.step}`}
                    description={item.description}
                    step={item.step}
                    title={item.title}
                  />
                ))}
              </div>
            </div>
          )}

          <Link
            className="mt-6 inline-flex w-fit text-sm font-semibold text-slate-700 transition hover:text-slate-950"
            to={activeTab === 'freelancers' ? '/cadastro/freelancer' : '/cadastro/cliente'}
          >
            {activeTab === 'freelancers'
              ? 'Quero começar como freelancer'
              : 'Prefere começar como cliente? Criar conta gratuita'}
          </Link>
        </div>
      </section>

      <section className="container">
        <div className="section-shell relative overflow-hidden rounded-[30px] px-5 py-6 sm:rounded-[44px] sm:px-10 sm:py-12">
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-[11px] sm:tracking-[0.22em]">
                CTA final
              </p>
              <h2 className="mt-3 text-[1.9rem] font-semibold leading-[1.06] tracking-[-0.045em] text-slate-950 sm:mt-4 sm:text-4xl">
                Comece agora e use uma plataforma feita para facilitar serviços e freelas.
              </h2>
              <p className="mt-3 text-[0.95rem] leading-6 text-slate-600 sm:mt-4 sm:text-base sm:leading-7">
                Quem precisa de ajuda encontra mais fácil. Quem quer trabalhar ganha um espaço melhor
                para aparecer. O próximo passo já está pronto.
              </p>
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row sm:gap-3">
              <Link
                className="inline-flex items-center justify-center rounded-full bg-[#0071e3] px-5 py-3 text-[0.95rem] font-semibold text-white transition hover:bg-[#0077ed] sm:px-6 sm:text-sm"
                to="/cadastro/freelancer"
              >
                Quero oferecer serviços
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-full border border-slate-200 px-5 py-3 text-[0.95rem] font-semibold text-slate-700 transition hover:bg-white sm:px-6 sm:text-sm"
                to="/freelancers"
              >
                Explorar serviços
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
