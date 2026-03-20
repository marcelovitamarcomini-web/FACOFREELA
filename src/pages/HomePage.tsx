import { Link } from 'react-router-dom';

import { categories } from '../../shared/contracts';
import { SectionHeading } from '../components/SectionHeading';

const workflow = [
  {
    title: 'Descubra sem perder tempo',
    description: 'Veja perfil, portfólio, categoria e experiência logo na primeira busca, com uma navegação simples.',
  },
  {
    title: 'Libere preço e contato quando fizer sentido',
    description: 'Com uma conta de cliente, você desbloqueia valores médios e envia mensagens com mais segurança.',
  },
  {
    title: 'Acompanhe tudo em um só lugar',
    description: 'Contatos, histórico e interesse recebido ficam organizados para facilitar a decisão dos dois lados.',
  },
];

const modules = [
  {
    eyebrow: 'Descoberta rápida',
    title: 'Encontre perfis que fazem sentido',
    description: 'A plataforma destaca especialidade, experiência e apresentação profissional sem poluir a leitura.',
  },
  {
    eyebrow: 'Mais confiança',
    title: 'Preço e contato com acesso controlado',
    description: 'O visitante pode explorar com liberdade e o cliente libera o que importa no momento certo.',
  },
  {
    eyebrow: 'Tudo organizado',
    title: 'Mensagens e histórico no mesmo fluxo',
    description: 'O que o cliente envia já entra no painel do freelancer, sem atalhos quebrados ou perda de contexto.',
  },
];

const clientBenefits = [
  'Compare profissionais com mais clareza antes de chamar.',
  'Libere preço e orçamento com um login simples.',
  'Concentre favoritos e contatos no mesmo lugar.',
];

const freelancerBenefits = [
  'Mostre seu trabalho com uma vitrine mais profissional.',
  'Receba contatos em um fluxo mais qualificado e centralizado.',
  'Acompanhe visualizações, interesse e mensagens no painel.',
];

export function HomePage() {
  return (
    <div className="space-y-24 pb-6 pt-8">
      <section className="container">
        <div className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-stretch">
          <div className="space-y-8">
            <div className="inline-flex rounded-full border border-cyan-400/20 bg-cyan-500/10 px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.28em] text-cyan-700">
              Rede Freelance // Camada Segura de Conexão
            </div>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-extrabold tracking-tight text-slate-950 sm:text-6xl">
                Encontre o freelancer certo com mais clareza, mais confiança e menos atrito.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-slate-600">
                A FacoFreela foi pensada para facilitar a contratação: o visitante descobre profissionais, o cliente libera preço e contato com um login simples, e o freelancer recebe tudo organizado no painel.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link
                className="rounded-full bg-slate-950 px-6 py-3 text-sm font-semibold text-white shadow-soft transition hover:bg-slate-800"
                to="/freelancers"
              >
                Explorar rede de freelancers
              </Link>
              <Link
                className="rounded-full border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                to="/login"
              >
                Entrar para liberar preços
              </Link>
              <Link
                className="rounded-full border border-cyan-300/30 bg-cyan-500/10 px-6 py-3 text-sm font-semibold text-cyan-800 transition hover:bg-cyan-500/15"
                to="/cadastro/freelancer"
              >
                Publicar perfil profissional
              </Link>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="glass-panel tech-panel rounded-[28px] p-5 shadow-soft">
                <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-cyan-700">
                  Acesso
                </p>
                <p className="mt-3 text-3xl font-extrabold text-slate-950">****</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  O preço aparece no momento certo, sem quebrar a navegação pública.
                </p>
              </div>
              <div className="glass-panel tech-panel rounded-[28px] p-5 shadow-soft">
                <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-cyan-700">
                  Backend
                </p>
                <p className="mt-3 text-3xl font-extrabold text-slate-950">Ativo</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Cadastro, login, dashboard e contato funcionando em uma experiência contínua.
                </p>
              </div>
              <div className="glass-panel tech-panel rounded-[28px] p-5 shadow-soft">
                <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-cyan-700">
                  Operação
                </p>
                <p className="mt-3 text-3xl font-extrabold text-slate-950">1:1</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  O cliente envia a mensagem e o freelancer recebe tudo no painel, sem ruído.
                </p>
              </div>
            </div>
          </div>

          <aside className="glass-panel tech-panel overflow-hidden rounded-[36px] p-7 shadow-soft">
            <div className="rounded-[28px] border border-slate-800/50 bg-[linear-gradient(180deg,#020617_0%,#0f172a_100%)] p-6 text-white">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-200">
                Visão do sistema
              </p>
              <h2 className="mt-4 text-2xl font-bold">
                Uma jornada simples para quem contrata e para quem vende serviço.
              </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                A descoberta continua aberta e leve, enquanto preço, contato e histórico ficam protegidos para dar mais confiança na negociação.
              </p>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">
                  Antes do login
                </p>
                <p className="mt-3 text-lg font-bold text-slate-950">
                  Descoberta rápida e comparação inicial.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  O usuário navega por perfis, categorias e portfólios sem barreiras desnecessárias.
                </p>
              </div>

              <div className="rounded-[28px] border border-cyan-300/25 bg-cyan-500/8 p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-cyan-700">
                  Depois do login
                </p>
                <p className="mt-3 text-lg font-bold text-slate-950">
                  Preço, contato e acompanhamento com segurança.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  A conta do cliente libera preço e mensagem, e o freelancer acompanha o interesse com mais contexto.
                </p>
              </div>

              <div className="rounded-[28px] border border-slate-200/80 bg-white/90 p-5">
                <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-slate-500">
                  Resultado prático
                </p>
                <p className="mt-3 text-lg font-bold text-slate-950">
                  Uma experiência mais limpa para decidir e contratar.
                </p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  Menos atrito para o usuário, mais organização para o freelancer e uma navegação que não se perde em excesso de informação.
                </p>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="container">
        <SectionHeading
          description="A proposta fica mais clara quando o usuário entende o benefício antes da parte técnica."
          eyebrow="Arquitetura de produto"
          title="Três pontos que deixam a experiência mais convincente."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {modules.map((module) => (
            <article key={module.title} className="glass-panel tech-panel rounded-[30px] p-7 shadow-soft">
              <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-cyan-700">
                {module.eyebrow}
              </p>
              <h3 className="mt-4 text-2xl font-bold text-slate-950">{module.title}</h3>
              <p className="mt-4 text-sm leading-7 text-slate-600">{module.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container">
        <SectionHeading
          description="O fluxo foi pensado para facilitar a entrada, a comparação e o contato."
          eyebrow="Fluxo operacional"
          title="Como o usuário descobre, decide e avança."
        />

        <div className="mt-10 grid gap-6 lg:grid-cols-3">
          {workflow.map((step, index) => (
            <article key={step.title} className="glass-panel tech-panel rounded-[30px] p-7 shadow-soft">
              <div className="grid grid-cols-[3rem_minmax(0,1fr)] items-start gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-slate-950 font-mono text-sm font-bold tabular-nums text-cyan-200">
                  0{index + 1}
                </span>
                <h3 className="pt-1 text-xl font-bold leading-7 text-slate-950">{step.title}</h3>
              </div>
              <p className="mt-5 text-sm leading-7 text-slate-600">{step.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="container">
        <SectionHeading
          description="Cada categoria leva direto para a busca com filtros aplicados."
          eyebrow="Categorias"
          title="Navegue pela rede de talentos com atalhos rápidos."
        />

        <div className="mt-10 flex flex-wrap gap-4">
          {categories.map((category) => (
            <Link
              key={category}
              className="rounded-full border border-cyan-300/20 bg-white/90 px-5 py-3 text-sm font-semibold text-slate-700 shadow-soft transition hover:border-cyan-400/40 hover:text-cyan-700"
              to={`/freelancers?category=${encodeURIComponent(category)}`}
            >
              {category}
            </Link>
          ))}
        </div>
      </section>

      <section className="container">
        <div className="grid gap-6 lg:grid-cols-2">
          <article className="glass-panel tech-panel rounded-[32px] p-8 shadow-soft">
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-cyan-700">
              Para clientes
            </p>
            <h2 className="mt-4 text-3xl font-bold text-slate-950">
              Mais clareza antes da contratação.
            </h2>
            <ul className="mt-6 space-y-4">
              {clientBenefits.map((benefit) => (
                <li key={benefit} className="rounded-[24px] border border-slate-200/80 bg-white/90 px-4 py-4 text-sm leading-6 text-slate-600">
                  {benefit}
                </li>
              ))}
            </ul>
          </article>

          <article className="rounded-[32px] border border-slate-800/50 bg-[linear-gradient(180deg,#020617_0%,#0f172a_100%)] p-8 text-white shadow-soft">
            <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-cyan-200">
              Para freelancers
            </p>
            <h2 className="mt-4 text-3xl font-bold">
              Mais controle sobre visibilidade e contato.
            </h2>
            <ul className="mt-6 space-y-4">
              {freelancerBenefits.map((benefit) => (
                <li
                  key={benefit}
                  className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4 text-sm leading-6 text-slate-200"
                >
                  {benefit}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>

      <section className="container">
        <div className="relative overflow-hidden rounded-[38px] border border-cyan-300/20 bg-[linear-gradient(135deg,#020617_0%,#0f172a_48%,#155e75_100%)] px-8 py-10 text-white shadow-soft lg:px-12 lg:py-14">
          <div className="absolute -right-12 top-10 h-44 w-44 rounded-full bg-cyan-400/15 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-52 w-52 rounded-full bg-sky-400/10 blur-3xl" />
          <div className="relative flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-200">
                Chamada para ação
              </p>
              <h2 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-4xl">
                Entre para contratar com mais clareza ou publique seu perfil para receber contatos melhores.
              </h2>
              <p className="mt-4 text-base leading-7 text-slate-200">
                A experiência já está pronta para conectar descoberta pública com contato protegido, mantendo a navegação simples para quem chega pela primeira vez.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                className="inline-flex items-center justify-center rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                to="/cadastro/freelancer"
              >
                Ativar perfil profissional
              </Link>
              <Link
                className="inline-flex items-center justify-center rounded-full border border-white/20 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                to="/cadastro/cliente"
              >
                Criar conta de cliente
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
