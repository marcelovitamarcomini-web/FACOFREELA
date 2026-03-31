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
      'O caminho fica mais simples para buscar, olhar perfis, conversar e seguir com o serviço.',
  },
  {
    eyebrow: 'Conversa no lugar certo',
    title: 'Fale com mais clareza',
    description:
      'Cliente e profissional começam a conversa dentro da plataforma, com histórico e mais organização.',
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
    title: 'Converse e siga',
    description:
      'Abra a conversa dentro da plataforma e siga com o serviço de forma mais clara.',
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
    title: 'Receba pedidos',
    description:
      'Junte contatos e conversas em um só lugar para responder melhor.',
  },
];

const platformTags = [
  'clareza',
  'atendimento',
  'orçamento',
  'agenda',
  'projetos',
  'serviços locais',
  'especialistas',
  'histórico de conversa',
];

type HowItWorksTab = 'clients' | 'freelancers' | 'platform';

const desktopHowItWorksTabs: Array<{
  id: HowItWorksTab;
  label: string;
}> = [
  { id: 'platform', label: 'No site' },
  { id: 'clients', label: 'Para clientes' },
  { id: 'freelancers', label: 'Para freelancers' },
];

const platformHighlights = [
  {
    eyebrow: 'Perfil objetivo',
    title: 'Servico, localizacao e experiencia aparecem sem excesso de ruido.',
  },
  {
    eyebrow: 'Conversa no mesmo lugar',
    title: 'O contato acontece no mesmo ambiente, sem espalhar atendimento.',
  },
];

const platformExamples = [
  {
    title: 'Cliente encontra o que precisa',
    description: 'Busca por cidade, tipo de servico e perfil de um jeito mais direto.',
  },
  {
    title: 'Profissional mostra o que faz',
    description:
      'O perfil valoriza trabalho, disponibilidade e area atendida, nao so portfolio digital.',
  },
  {
    title: 'A conversa nao se perde',
    description: 'A conversa fica guardada no mesmo lugar para dar continuidade.',
  },
];

const trustPillars = [
  {
    title: 'Feita para vários tipos de trabalho',
    description:
      'Funciona para serviço de rua, obra, escritório, criação e tecnologia sem falar só com um tipo de público.',
  },
  {
    title: 'Mais fácil de entender',
    description:
      'O site evita exagero e mostra as informações de um jeito mais claro para quem entra.',
  },
  {
    title: 'Bom para quem contrata e para quem trabalha',
    description:
      'Quem quer contratar entende como seguir. Quem quer trabalhar entende como aparecer melhor.',
  },
  {
    title: 'Bonito sem complicar',
    description:
      'A marca passa confiança e continua simples de usar, sem ficar pesada ou difícil de entender.',
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
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-[11px] sm:tracking-[0.16em]">
        {eyebrow}
      </p>
      <h2 className="max-w-3xl text-[1.9rem] font-semibold leading-[1.04] tracking-[-0.045em] text-slate-950 sm:text-4xl sm:leading-none sm:tracking-[-0.04em]">
        {title}
      </h2>
      <p className="max-w-2xl text-[0.95rem] leading-6 text-slate-600 sm:text-base sm:leading-7">{description}</p>
    </div>
  );
}

export function HomePage() {
  const location = useLocation();
  const [desktopHowItWorksTab, setDesktopHowItWorksTab] = useState<HowItWorksTab>('platform');

  useEffect(() => {
    const sectionId = decodeURIComponent(location.hash.slice(1));

    if (sectionId === 'para-clientes') {
      setDesktopHowItWorksTab('clients');
      return;
    }

    if (sectionId === 'para-freelancers') {
      setDesktopHowItWorksTab('freelancers');
      return;
    }

    if (sectionId === 'como-funciona') {
      setDesktopHowItWorksTab('platform');
    }
  }, [location.hash]);

  return (
    <div className="space-y-20 pb-14 pt-8 sm:space-y-32 sm:pb-16 sm:pt-12">
      <section className="container">
        <div className="section-shell relative overflow-hidden rounded-[32px] px-5 py-6 sm:rounded-[44px] sm:px-9 sm:py-10 lg:px-12 lg:py-12">
          <div className="relative grid gap-7 sm:gap-10 lg:grid-cols-[1.08fr_0.92fr] lg:items-center">
            <div className="space-y-6 sm:space-y-8">
              <div className="inline-flex rounded-full border border-slate-200 bg-white/92 px-3.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 sm:px-4 sm:py-2 sm:text-[11px] sm:tracking-[0.16em]">
                Gente que trabalha por conta em várias áreas
              </div>

              <div className="space-y-4 sm:space-y-6">
                <h1 className="hero-display-title max-w-4xl text-[2.45rem] leading-[0.98] text-slate-950 sm:text-6xl lg:text-[3.7rem] lg:leading-[0.98] xl:text-[4.2rem]">
                  Um jeito simples de contratar serviços ou mostrar o que você faz.
                </h1>
                <p className="max-w-3xl text-[0.98rem] leading-7 text-slate-500 sm:text-[1.12rem] sm:leading-8">
                  No Faço Freela você encontra profissionais de várias áreas, do serviço local ao
                  digital, em um fluxo simples para buscar, comparar e conversar.
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

              <div className="rounded-[24px] border border-slate-200 bg-white/94 p-4 shadow-[0_10px_28px_rgba(15,23,42,0.05)] sm:rounded-[30px] sm:p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div className="max-w-2xl">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#0071e3] sm:text-[11px] sm:tracking-[0.16em]">
                      Área freelancer
                    </p>
                    <p className="mt-2.5 text-[1.05rem] font-bold text-slate-950 sm:mt-3 sm:text-xl">
                      Trabalha por conta? Monte seu perfil.
                    </p>
                    <p className="mt-2 text-[0.95rem] leading-6 text-slate-600 sm:text-sm sm:leading-7">
                      Mostre o que você faz, onde atende e receba contatos dentro da plataforma.
                    </p>
                  </div>

                  <Link
                    className="inline-flex w-full items-center justify-center rounded-full bg-[#0071e3] px-5 py-3 text-[0.95rem] font-semibold text-white transition hover:bg-[#0077ed] sm:w-auto sm:text-sm"
                    to="/cadastro/freelancer"
                  >
                    Criar perfil freelancer
                  </Link>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="panel-outline rounded-[22px] p-3.5 sm:rounded-[26px] sm:p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 sm:text-xs sm:tracking-[0.18em]">O que é</p>
                  <p className="mt-2 text-[0.92rem] font-semibold leading-6 text-slate-950 sm:text-sm">
                    Uma plataforma para encontrar profissionais e publicar serviços.
                  </p>
                </div>
                <div className="panel-outline rounded-[22px] p-3.5 sm:rounded-[26px] sm:p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 sm:text-xs sm:tracking-[0.18em]">
                    Para quem serve
                  </p>
                  <p className="mt-2 text-[0.92rem] font-semibold leading-6 text-slate-950 sm:text-sm">
                    Para quem precisa contratar e para quem quer viver do próprio trabalho.
                  </p>
                </div>
                <div className="panel-outline rounded-[22px] p-3.5 sm:rounded-[26px] sm:p-4">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-slate-400 sm:text-xs sm:tracking-[0.18em]">
                    Próxima ação
                  </p>
                  <p className="mt-2 text-[0.92rem] font-semibold leading-6 text-slate-950 sm:text-sm">
                    Buscar um serviço ou criar seu perfil.
                  </p>
                </div>
              </div>
            </div>

            <aside className="relative lg:ml-auto lg:max-w-[36rem] xl:max-w-[38rem]">
              <div className="panel-outline rounded-[24px] p-3 sm:rounded-[32px] sm:p-3.5">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:text-[11px] sm:tracking-[0.22em]">
                    Visão do Faço Freela
                  </p>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-600 sm:px-3 sm:text-[11px] sm:tracking-[0.16em]">
                    Fluxo real
                  </span>
                </div>

                <p className="mt-2.5 text-[0.92rem] leading-6 text-slate-600 sm:mt-3 sm:text-sm">
                  Cliente, freelancer e proposta seguem no mesmo fluxo dentro do site.
                </p>

                <div className="mt-3 sm:mt-3.5">
                  <div className="-mx-2 overflow-hidden rounded-[28px] border border-[#0071e3]/18 bg-[#031022] p-1 sm:-mx-2.5 sm:p-1.5">
                    <img
                      alt="Ilustracao da tela inicial do Faço Freela mostrando cliente, freelancer e proposta conectados."
                      className="block aspect-square w-full rounded-[22px] object-cover object-center scale-[1.1]"
                      src={heroPracticeIllustration}
                    />
                  </div>
                  <div className="hidden">
                  <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fb_100%)] p-6">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Da rua ao online
                    </p>
                    <h2 className="mt-3 text-[1.9rem] font-semibold tracking-[-0.04em] text-slate-950">
                      Quem entra no site entende rápido o que dá para fazer aqui.
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                      A home mostra serviços reais, fala de um jeito simples e deixa claro onde clicar.
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Pedido
                      </p>
                      <div className="mt-3 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                        Preciso de um chaveiro hoje à tarde em Campinas.
                      </div>
                    </div>

                    <div className="rounded-[24px] border border-slate-200 bg-white p-4">
                      <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                        Resposta
                      </p>
                      <div className="mt-3 ml-auto w-fit rounded-[18px] bg-[#0071e3]/10 px-4 py-3 text-sm font-medium text-[#0071e3]">
                        Atendo Campinas e região. Posso chegar em 40 minutos.
                      </div>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-3">
                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Categoria
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">
                          Casa e reparos
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Área atendida
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">
                          Cidade e região
                        </p>
                      </div>
                      <div className="rounded-[22px] border border-slate-200 bg-white p-4">
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                          Conversa
                        </p>
                        <p className="mt-2 text-sm font-semibold text-slate-950">
                          Histórico no mesmo lugar
                        </p>
                      </div>
                    </div>
                  </div>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </div>
      </section>

      <section className="container">
        <SectionIntro
          description="A ideia é simples: a pessoa bate o olho e já entende que pode achar ajuda ou oferecer serviço aqui."
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
                <h3 className="text-[1.22rem] font-bold leading-[1.15] text-slate-950 sm:text-2xl">{item.title}</h3>
                <p className="max-w-3xl text-[0.92rem] leading-6 text-slate-600 sm:text-sm sm:leading-7">{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="container" id="servicos">
        <SectionIntro
          description="Em vez de jogar um monte de opção logo de cara, a home mostra as áreas principais de um jeito fácil de bater o olho."
          eyebrow="Serviços em destaque"
          title="Veja os tipos de serviço mais procurados."
        />

        <div className="mt-8 grid gap-4 sm:mt-10 md:grid-cols-2 xl:grid-cols-4">
          {featuredCategories.map((category) => (
            <Link
              key={`${category.title}-${category.filter}`}
              className="group rounded-[24px] border border-[#0071e3]/28 bg-white/96 p-4 shadow-[0_10px_26px_rgba(15,23,42,0.04)] transition duration-200 hover:border-[#0071e3]/46 hover:bg-white focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#0071e3]/16 sm:rounded-[28px] sm:p-5"
              to={sectionLink(category.filter)}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500 sm:px-3 sm:text-[11px] sm:tracking-[0.14em]">
                  {category.signal}
                </span>
                <span className="text-[0.82rem] font-semibold text-slate-400 transition group-hover:text-slate-700 sm:text-sm">
                  Ver categoria
                </span>
              </div>
              <h3 className="mt-4 text-[1.22rem] font-bold leading-[1.15] text-slate-950 sm:mt-5 sm:text-2xl">{category.title}</h3>
              <p className="mt-2.5 text-[0.92rem] leading-6 text-slate-600 sm:mt-3 sm:text-sm sm:leading-7">{category.description}</p>
              <div className="mt-4 flex items-center justify-between gap-3 border-t border-[#0071e3]/16 pt-3.5 sm:mt-5 sm:pt-4">
                <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-slate-400 sm:text-xs sm:tracking-[0.14em]">
                  Abrir filtro
                </span>
                <span className="text-base text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-slate-700">
                  →
                </span>
              </div>
            </Link>
          ))}
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

        <div className="mt-10 hidden lg:block">
          <div className="rounded-[36px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fb_100%)] p-6 shadow-[0_14px_42px_rgba(15,23,42,0.06)] xl:p-7">
            <div className="flex flex-wrap gap-3 border-b border-slate-200 pb-5">
              {desktopHowItWorksTabs.map((tab) => {
                const isActive = desktopHowItWorksTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    className={`rounded-full px-5 py-2.5 text-sm font-semibold transition ${
                      isActive
                        ? 'bg-[#0071e3] text-white shadow-[0_10px_24px_rgba(0,113,227,0.2)]'
                        : 'border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-950'
                    }`}
                    onClick={() => setDesktopHowItWorksTab(tab.id)}
                    type="button"
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {desktopHowItWorksTab === 'platform' ? (
              <div className="mt-6 grid gap-6 xl:grid-cols-[0.92fr_1.08fr] xl:items-start">
                <div className="space-y-6">
                  <div className="rounded-[28px] border border-slate-200 bg-white p-6">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                      Como funciona no site
                    </p>
                    <h3 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                      Busca, perfil e conversa ficam no mesmo fluxo.
                    </h3>
                    <p className="mt-4 text-sm leading-7 text-slate-600">
                      A proposta e juntar busca, perfil e conversa em um caminho so. Assim, quem entra
                      entende rapido como achar alguem e como seguir com o servico.
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
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  {platformHighlights.map((item) => (
                    <div key={item.title} className="rounded-[28px] border border-slate-200 bg-white p-5">
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
                      Menos enrolacao, mais cara de servico bem resolvido.
                    </h3>

                    <div className="mt-5 grid gap-3 xl:grid-cols-3">
                      {platformExamples.map((item) => (
                        <div key={item.title} className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-semibold text-slate-950">{item.title}</p>
                          <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {desktopHowItWorksTab === 'clients' ? (
              <div className="mt-6">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Para clientes
                  </p>
                  <h3 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                    Mais facilidade para achar, escolher e seguir com o servico certo.
                  </h3>
                </div>

                <div className="mt-8 grid gap-4 xl:grid-cols-3">
                  {clientFlow.map((item) => (
                    <div
                      key={item.step}
                      className="rounded-[24px] border border-slate-200 bg-white px-5 py-5"
                    >
                      <div className="flex items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0071e3] text-sm font-semibold text-white shadow-[0_12px_24px_rgba(0,113,227,0.18)]">
                          {item.step}
                        </span>
                        <div>
                          <p className="text-lg font-bold text-slate-950">{item.title}</p>
                          <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {desktopHowItWorksTab === 'freelancers' ? (
              <div className="mt-6">
                <div className="max-w-3xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Para freelancers
                  </p>
                  <h3 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-slate-950">
                    Um jeito melhor de mostrar seu trabalho e receber pedidos.
                  </h3>
                </div>

                <div className="mt-8 grid gap-4 xl:grid-cols-3">
                  {freelancerFlow.map((item) => (
                    <div
                      key={item.step}
                      className="rounded-[24px] border border-slate-200 bg-white px-5 py-5"
                    >
                      <div className="flex items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#0071e3] text-sm font-semibold text-white shadow-[0_12px_24px_rgba(0,113,227,0.18)]">
                          {item.step}
                        </span>
                        <div>
                          <p className="text-lg font-bold text-slate-950">{item.title}</p>
                          <p className="mt-2 text-sm leading-7 text-slate-600">{item.description}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <Link
              className="mt-6 inline-flex w-fit text-sm font-semibold text-slate-700 transition hover:text-slate-950"
              to="/cadastro/cliente"
            >
              Prefere começar como cliente? Criar conta gratuita
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:hidden sm:mt-10 sm:gap-6">
          <article className="panel-outline rounded-[24px] p-5 sm:rounded-[32px] sm:p-7">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-[11px] sm:tracking-[0.16em]">
              Para clientes
            </p>
            <h3 className="mt-3 text-[1.85rem] font-semibold leading-[1.06] tracking-[-0.045em] text-slate-950 sm:mt-4 sm:text-3xl sm:tracking-[-0.04em]">
              Mais facilidade para achar, escolher e seguir com o serviço certo.
            </h3>

            <div className="mt-5 space-y-3 sm:mt-8 sm:space-y-4">
              {clientFlow.map((item) => (
                <div
                  key={item.step}
                  className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4 sm:rounded-[24px] sm:px-5 sm:py-5"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0071e3] text-[0.82rem] font-semibold text-white shadow-[0_12px_24px_rgba(0,113,227,0.18)] sm:h-12 sm:w-12 sm:text-sm">
                      {item.step}
                    </span>
                    <div>
                      <p className="text-[1rem] font-bold leading-6 text-slate-950 sm:text-lg">{item.title}</p>
                      <p className="mt-1.5 text-[0.92rem] leading-6 text-slate-600 sm:mt-2 sm:text-sm sm:leading-7">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          <article className="rounded-[24px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f4f6fb_100%)] p-5 text-slate-950 shadow-[0_12px_36px_rgba(15,23,42,0.06)] sm:rounded-[32px] sm:p-7">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500 sm:text-[11px] sm:tracking-[0.22em]">
              Para freelancers
            </p>
            <h3 className="mt-3 text-[1.85rem] font-semibold leading-[1.06] tracking-[-0.045em] text-slate-950 sm:mt-4 sm:text-3xl sm:tracking-[-0.04em]">
              Um jeito melhor de mostrar seu trabalho e receber pedidos.
            </h3>

            <div className="mt-5 space-y-3 sm:mt-8 sm:space-y-4">
              {freelancerFlow.map((item) => (
                <div
                  key={item.step}
                  className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 sm:rounded-[24px] sm:px-5 sm:py-5"
                >
                  <div className="flex items-start gap-3 sm:gap-4">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[#0071e3] text-[0.82rem] font-semibold text-white shadow-[0_12px_24px_rgba(0,113,227,0.18)] sm:h-12 sm:w-12 sm:text-sm">
                      {item.step}
                    </span>
                    <div>
                      <p className="text-[1rem] font-bold leading-6 text-slate-950 sm:text-lg">{item.title}</p>
                      <p className="mt-1.5 text-[0.92rem] leading-6 text-slate-600 sm:mt-2 sm:text-sm sm:leading-7">{item.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>

      <section className="container lg:hidden">
        <div className="grid gap-8 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">
          <div className="space-y-6">
            <SectionIntro
              description="Em vez de parecer um site só para tecnologia, o Faço Freela se apresenta como um lugar simples para resolver coisa do dia a dia e achar profissionais."
              eyebrow="Como a plataforma ajuda"
              title="Um site mais simples, direto e fácil de usar."
            />

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

            <p className="max-w-2xl text-sm leading-7 text-slate-600">
              A proposta é juntar busca, perfil e conversa em um caminho só. Assim, quem entra
              entende rápido como achar alguém e como seguir com o serviço.
            </p>
          </div>

          <div className="rounded-[36px] border border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f7f8fb_100%)] p-5 shadow-[0_14px_42px_rgba(15,23,42,0.06)] sm:p-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="space-y-4">
                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Busca clara
                  </p>
                  <p className="mt-3 text-lg font-bold text-slate-950">
                    A pessoa entra e entende onde clicar.
                  </p>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Perfil objetivo
                  </p>
                  <p className="mt-3 text-lg font-bold text-slate-950">
                    Serviço, localização e experiência aparecem sem excesso de ruído.
                  </p>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                    Conversa no mesmo lugar
                  </p>
                  <p className="mt-3 text-lg font-bold text-slate-950">
                    O contato acontece no mesmo ambiente, sem espalhar atendimento.
                  </p>
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                  Exemplo de uso
                </p>
                <h3 className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-slate-950">
                  Menos enrolação, mais cara de serviço bem resolvido.
                </h3>

                <div className="mt-5 space-y-3">
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-950">
                      Cliente encontra o que precisa
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Busca por cidade, tipo de serviço e perfil de um jeito mais direto.
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-950">
                      Profissional mostra o que faz
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      O perfil valoriza trabalho, disponibilidade e área atendida, não só portfólio digital.
                    </p>
                  </div>
                  <div className="rounded-[20px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-950">
                      A conversa não se perde
                    </p>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      A conversa fica guardada no mesmo lugar para dar continuidade.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <Link
              className="mt-5 inline-flex w-fit text-sm font-semibold text-slate-700 transition hover:text-slate-950"
              to="/cadastro/cliente"
            >
              Prefere começar como cliente? Criar conta gratuita
            </Link>
          </div>
        </div>
      </section>

      <section className="container lg:hidden">
        <div className="grid gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <div className="space-y-5">
            <SectionIntro
              description="A página também precisa passar confiança, organização e facilidade logo de cara."
              eyebrow="Prova de confiança"
              title="Confiança para quem contrata e espaço para quem quer trabalhar."
            />

            <div className="panel-outline rounded-[28px] p-6">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
                O que diferencia o Faço Freela
              </p>
              <p className="mt-4 text-lg font-semibold text-slate-950">
                Mais tipos de serviço, mais clareza e menos complicação.
              </p>
              <p className="mt-3 text-sm leading-7 text-slate-600">
                Em vez de falar só com tecnologia, o site abre espaço para serviço local, técnico,
                criativo ou digital, com um caminho mais fácil para seguir.
              </p>
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2">
            {trustPillars.map((item) => (
              <article key={item.title} className="panel-outline rounded-[28px] p-6">
                <p className="text-lg font-bold text-slate-950">{item.title}</p>
                <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
              </article>
            ))}
          </div>
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
