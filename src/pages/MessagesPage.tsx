import { Link } from 'react-router-dom';

import { useAppSession } from '../context/AppSessionContext';

export function MessagesPage() {
  const { session } = useAppSession();

  if (!session) {
    return null;
  }

  const primaryLink =
    session.role === 'freelancer'
      ? {
          to: '/meu-perfil',
          label: 'Abrir meu perfil público',
        }
      : {
          to: '/freelancers',
          label: 'Explorar profissionais',
        };

  const secondaryLink =
    session.role === 'freelancer'
      ? {
          to: '/dashboard/freelancer',
          label: 'Voltar ao dashboard',
        }
      : {
          to: '/dashboard/cliente',
          label: 'Voltar ao dashboard',
        };

  return (
    <div className="container space-y-6 py-10 sm:py-12 lg:py-14">
      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-soft sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
          Atualização de fluxo
        </p>
        <h1 className="mt-4 text-[2rem] font-extrabold leading-[1.04] tracking-tight text-slate-950 sm:text-3xl">
          O primeiro contato agora acontece fora da plataforma.
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-600">
          Para manter a operação mais leve neste começo, o Faço Freela deixou de priorizar a
          central interna de mensagens. O caminho principal agora é abrir o perfil e seguir para
          WhatsApp, site ou LinkedIn quando o profissional publicar esses canais.
        </p>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-5 py-5">
            <p className="text-sm font-semibold text-slate-950">O que mudou</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              O perfil voltou a ser o centro do fluxo. Ele organiza contexto, portfólio,
              disponibilidade e os atalhos externos para seguir o atendimento.
            </p>
          </div>
          <div className="rounded-[24px] border border-[#0071e3]/14 bg-[#0071e3]/5 px-5 py-5">
            <p className="text-sm font-semibold text-slate-950">Por que fizemos isso</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              A ideia é reduzir peso de banco e simplificar a experiência sem atrapalhar o primeiro
              contato entre cliente e freelancer.
            </p>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            className="inline-flex min-h-[44px] items-center rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            to={primaryLink.to}
          >
            {primaryLink.label}
          </Link>
          <Link
            className="inline-flex min-h-[44px] items-center rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
            to={secondaryLink.to}
          >
            {secondaryLink.label}
          </Link>
        </div>
      </section>
    </div>
  );
}
