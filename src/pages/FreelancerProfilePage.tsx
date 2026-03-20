import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';

import type { Freelancer } from '../../shared/contracts';
import { FreelancerVerifiedSeal } from '../components/FreelancerVerifiedSeal';
import { contactSchema } from '../../shared/schemas';
import { FormField } from '../components/FormField';
import { PriceMask } from '../components/PriceMask';
import { SectionHeading } from '../components/SectionHeading';
import { useAppSession } from '../context/AppSessionContext';
import { api } from '../lib/api';
import { currency, shortDate } from '../lib/format';
import { getFieldErrors } from '../lib/validation';

type ContactFormState = {
  subject: string;
  message: string;
  channel: 'Plataforma' | 'E-mail';
};

const initialContactForm: ContactFormState = {
  subject: '',
  message: '',
  channel: 'Plataforma',
};

export function FreelancerProfilePage() {
  const { slug } = useParams();
  const location = useLocation();
  const { session } = useAppSession();
  const [freelancer, setFreelancer] = useState<Freelancer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [contactForm, setContactForm] = useState<ContactFormState>(initialContactForm);
  const [contactErrors, setContactErrors] = useState<Record<string, string>>({});
  const [contactStatus, setContactStatus] = useState<{ tone: 'error' | 'success'; text: string } | null>(
    null,
  );
  const [submittingContact, setSubmittingContact] = useState(false);

  useEffect(() => {
    if (typeof slug !== 'string') {
      return;
    }

    const controller = new AbortController();
    const currentSlug = slug;

    async function loadFreelancer() {
      try {
        const data = await api.getFreelancer(currentSlug, {
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setFreelancer(data);
          setError(null);
        }
      } catch (loadError) {
        if (!controller.signal.aborted) {
          setError(
            loadError instanceof Error ? loadError.message : 'Não foi possível carregar o perfil.',
          );
        }
      }
    }

    void loadFreelancer();

    return () => controller.abort();
  }, [slug]);

  function handleContactChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;
    setContactForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleContactSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!freelancer) {
      return;
    }

    setContactStatus(null);

    const parsed = contactSchema.safeParse({
      freelancerId: freelancer.id,
      freelancerName: freelancer.name,
      ...contactForm,
    });

    if (!parsed.success) {
      setContactErrors(getFieldErrors(parsed.error));
      return;
    }

    setContactErrors({});
    setSubmittingContact(true);

    try {
      await api.createContact(parsed.data);
      setContactForm(initialContactForm);
      setContactStatus({
        tone: 'success',
        text: 'Mensagem enviada. O freelancer já pode visualizar esse contato no painel.',
      });
    } catch (submitError) {
      setContactStatus({
        tone: 'error',
        text:
          submitError instanceof Error
            ? submitError.message
            : 'Não foi possível enviar sua mensagem agora.',
      });
    } finally {
      setSubmittingContact(false);
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

  if (!freelancer) {
    return (
      <div className="container py-14">
        <div className="glass-panel rounded-[30px] px-6 py-8 text-sm text-slate-500 shadow-soft">
          Carregando perfil profissional...
        </div>
      </div>
    );
  }

  const averagePrice = freelancer.averagePrice;
  const averagePriceVisible = averagePrice !== null;
  const isClient = session?.role === 'client';
  const hasVerificationSeal = freelancer.subscriptionTier === 'booster';
  const firstName = freelancer.name.split(' ')[0];
  const trustPoints = [
    {
      title: 'Portfólio visível',
      description: 'Veja trabalhos e referências antes de entrar em contato.',
    },
    {
      title: averagePriceVisible ? 'Faixa de investimento disponível' : 'Preço liberado no login',
      description: averagePriceVisible
        ? 'A conta de cliente já pode comparar valores com mais clareza.'
        : 'O valor aparece quando o cliente decide avançar na conversa.',
    },
    {
      title: 'Contato protegido na plataforma',
      description: 'A negociação começa com mais contexto e sem atalhos confusos.',
    },
  ];
  const bannerStyle = freelancer.bannerUrl
    ? {
        backgroundImage:
          `linear-gradient(120deg, rgba(2, 6, 23, 0.86), rgba(8, 47, 73, 0.44)), url(${freelancer.bannerUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }
    : undefined;

  return (
    <div className="container py-14">
      <section className="overflow-hidden rounded-[36px] border border-white/60 bg-white shadow-soft">
        <div
          className="relative z-0 h-48 overflow-hidden bg-[linear-gradient(135deg,#020617_0%,#0f172a_45%,#0f766e_100%)]"
          style={bannerStyle}
        >
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(34,211,238,0.16)_1px,transparent_1px),linear-gradient(to_bottom,rgba(34,211,238,0.12)_1px,transparent_1px)] bg-[size:26px_26px] opacity-50" />
        </div>

        <div className="relative z-10 grid gap-8 px-6 pb-8 pt-4 lg:grid-cols-[1.3fr_0.7fr] lg:px-10">
          <div className="-mt-10 space-y-6 sm:-mt-12">
            <div className="relative z-20 rounded-[30px] border border-white/70 bg-white/95 p-4 shadow-soft sm:px-5 sm:py-4 xl:max-w-[860px]">
              <div className="grid gap-3 sm:grid-cols-[96px_minmax(0,1fr)] sm:items-start">
                <div className="relative z-20 w-fit self-start rounded-[26px] bg-white p-1 shadow-[0_18px_50px_rgba(15,23,42,0.18)]">
                  <img
                    alt={freelancer.name}
                    className="h-20 w-20 shrink-0 rounded-[22px] object-cover object-center sm:h-24 sm:w-24"
                    src={freelancer.avatarUrl}
                  />
                </div>
                <div className="min-w-0 space-y-1 sm:pt-0.5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
                    <h1 className="text-4xl font-extrabold leading-none tracking-tight text-slate-950 sm:text-[4rem]">
                      {freelancer.name}
                    </h1>
                    {hasVerificationSeal ? <FreelancerVerifiedSeal /> : null}
                  </div>
                  <p className="text-base font-medium leading-tight text-slate-600 sm:text-lg">
                    {freelancer.profession}
                  </p>
                  <p className="text-sm leading-snug text-slate-500">
                    {freelancer.location} • membro desde {shortDate(freelancer.memberSince)}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              <p className="max-w-3xl text-base leading-7 text-slate-600">{freelancer.summary}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {trustPoints.map((point) => (
                <div
                  key={point.title}
                  className="rounded-[24px] border border-slate-200/80 bg-white/92 p-4 shadow-soft"
                >
                  <p className="text-sm font-semibold text-slate-800">{point.title}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{point.description}</p>
                </div>
              ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/90 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Categoria</p>
                <p className="mt-2 text-base font-semibold text-slate-700">{freelancer.category}</p>
              </div>
              <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/90 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Experiência</p>
                <p className="mt-2 text-base font-semibold text-slate-700">
                  {freelancer.experienceLevel} • {freelancer.yearsExperience} anos
                </p>
              </div>
              <div className="rounded-[28px] border border-slate-200/80 bg-slate-50/90 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Preço médio</p>
                {averagePriceVisible ? (
                  <p className="mt-2 text-base font-semibold text-slate-700">
                    {currency(averagePrice)}
                  </p>
                ) : (
                  <div className="mt-2">
                    <PriceMask
                      compact
                      hint="Entre como cliente para visualizar."
                      state={{ from: location }}
                      to="/login"
                    />
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <SectionHeading
                description="Veja o posicionamento do profissional, como ele se apresenta e os trabalhos que já publicou."
                eyebrow="Sobre o profissional"
                title="Perfil pensado para transmitir confiança"
              />
              <p className="text-base leading-8 text-slate-600">{freelancer.description}</p>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Habilidades
              </p>
              <div className="mt-4 flex flex-wrap gap-3">
                {freelancer.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-full border border-cyan-400/20 bg-cyan-500/5 px-4 py-2 text-sm font-semibold text-cyan-800"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Portfólio
              </p>
              <div className="mt-5 grid gap-5 md:grid-cols-2">
                {freelancer.portfolio.map((item) => (
                  <a
                    key={`${item.title}-${item.url}`}
                    className="glass-panel tech-panel rounded-[28px] p-6 shadow-soft transition hover:-translate-y-1"
                    href={item.url}
                    rel="noreferrer"
                    target="_blank"
                  >
                    <p className="font-mono text-[11px] uppercase tracking-[0.26em] text-cyan-700">
                      Link externo
                    </p>
                    <p className="mt-3 text-lg font-bold text-slate-950">{item.title}</p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
                    <span className="mt-5 inline-flex text-sm font-semibold text-cyan-700">
                      Acessar trabalho
                    </span>
                  </a>
                ))}
              </div>
            </div>
          </div>

          <aside className="-mt-10 self-start rounded-[32px] border border-slate-800/40 bg-[linear-gradient(180deg,#020617_0%,#0f172a_100%)] p-6 text-white shadow-soft lg:mt-8">
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">
              Envie sua proposta
            </p>
            <h2 className="mt-4 text-2xl font-bold">
              Fale com {firstName} com mais contexto
            </h2>
              <p className="mt-3 text-sm leading-6 text-slate-300">
              Descreva o projeto, o prazo e o objetivo. Você pode iniciar um chat dentro da plataforma ou pedir continuidade por e-mail.
              </p>

            {isClient ? (
              <form className="mt-6 grid gap-4" onSubmit={handleContactSubmit}>
                <FormField
                  error={contactErrors.channel}
                  label="Canal"
                  name="channel"
                  onChange={handleContactChange}
                  options={['Plataforma', 'E-mail']}
                  value={contactForm.channel}
                />
                <FormField
                  error={contactErrors.subject}
                  label="Assunto"
                  name="subject"
                  onChange={handleContactChange}
                  placeholder="Ex: Landing page para startup"
                  value={contactForm.subject}
                />
                <FormField
                  error={contactErrors.message}
                  label="Mensagem"
                  name="message"
                  onChange={handleContactChange}
                  placeholder="Explique o projeto, prazo e objetivo."
                  textarea
                  value={contactForm.message}
                />

                {contactStatus ? (
                  <div
                    className={`rounded-2xl px-4 py-3 text-sm ${
                      contactStatus.tone === 'success'
                        ? 'border border-emerald-300/30 bg-emerald-500/10 text-emerald-200'
                        : 'border border-rose-300/30 bg-rose-500/10 text-rose-200'
                    }`}
                  >
                    {contactStatus.text}
                  </div>
                ) : null}

                <button
                  className="rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-not-allowed disabled:bg-cyan-200"
                  disabled={submittingContact}
                  type="submit"
                >
                  {submittingContact ? 'Enviando...' : 'Enviar mensagem'}
                </button>
              </form>
            ) : (
              <div className="mt-6 space-y-4">
                <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                  <p className="text-sm font-semibold text-white">
                    Libere esta etapa quando quiser avançar
                  </p>
                  <div className="mt-4">
                    <PriceMask
                      compact
                      hint="Faça login como cliente para ver preço e enviar mensagem."
                      state={{ from: location }}
                      to="/login"
                    />
                  </div>
                </div>

                <div className="grid gap-3">
                  <Link
                    className="rounded-full bg-white px-5 py-3 text-center text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                    state={{ from: location }}
                    to="/login"
                  >
                    Entrar para liberar contato
                  </Link>
                  <Link
                    className="rounded-full border border-white/15 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-white/10"
                    to="/cadastro/cliente"
                  >
                    Criar conta de cliente
                  </Link>
                </div>
              </div>
            )}

            <div className="mt-6 rounded-[28px] border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white">Por que esse fluxo ajuda</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">
                {isClient
                  ? 'Sua mensagem chega com histórico, canal escolhido e contexto do projeto. No chat da plataforma, a continuidade fica toda registrada por aqui.'
                  : 'Você conhece o profissional primeiro e só libera preço e contato quando decidir seguir, deixando a navegação mais leve.'}
              </p>
            </div>

            <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-5">
              <p className="text-sm font-semibold text-white">Disponibilidade atual</p>
              <p className="mt-3 text-sm leading-6 text-slate-300">{freelancer.availability}</p>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              {freelancer.linkedinUrl ? (
                <a
                  className="text-sm font-semibold text-cyan-200 underline-offset-4 hover:underline"
                  href={freelancer.linkedinUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  LinkedIn
                </a>
              ) : null}
              {freelancer.websiteUrl ? (
                <a
                  className="text-sm font-semibold text-cyan-200 underline-offset-4 hover:underline"
                  href={freelancer.websiteUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Site
                </a>
              ) : null}
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}
