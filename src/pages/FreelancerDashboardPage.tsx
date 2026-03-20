import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';

import type { ContactMessage, FreelancerDashboard } from '../../shared/contracts';
import { StatsCard } from '../components/StatsCard';
import { api } from '../lib/api';
import { currency, currencyMonthly, shortDate, shortDateTime } from '../lib/format';

type ReplyStatus = {
  tone: 'error' | 'success';
  text: string;
};

function replaceContact(
  contacts: ContactMessage[],
  updatedContact: ContactMessage,
): ContactMessage[] {
  return contacts.map((contact) => (contact.id === updatedContact.id ? updatedContact : contact));
}

export function FreelancerDashboardPage() {
  const [dashboard, setDashboard] = useState<FreelancerDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyStatus, setReplyStatus] = useState<ReplyStatus | null>(null);
  const [submittingReply, setSubmittingReply] = useState(false);
  const conversationPanelRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        const data = await api.getFreelancerDashboard({
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setDashboard(data);
          setActiveContactId((current) => current ?? data.recentContacts[0]?.id ?? null);
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
  }, []);

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

  const activeContact =
    dashboard.recentContacts.find((contact) => contact.id === activeContactId) ??
    dashboard.recentContacts[0] ??
    null;

  function openContact(contactId: string) {
    setActiveContactId(contactId);
    setReplyMessage('');
    setReplyStatus(null);
    window.requestAnimationFrame(() => {
      conversationPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
    });
  }

  async function handleReplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeContact || activeContact.channel !== 'Plataforma') {
      return;
    }

    const trimmedMessage = replyMessage.trim();
    if (!trimmedMessage) {
      setReplyStatus({
        tone: 'error',
        text: 'Escreva sua resposta antes de enviar.',
      });
      return;
    }

    setSubmittingReply(true);
    setReplyStatus(null);

    try {
      const updatedContact = await api.sendContactMessage(activeContact.id, {
        message: trimmedMessage,
      });

      setDashboard((current) =>
        current
          ? {
              ...current,
              recentContacts: replaceContact(current.recentContacts, updatedContact),
            }
          : current,
      );
      setReplyMessage('');
      setReplyStatus({
        tone: 'success',
        text: 'Resposta enviada no chat da plataforma.',
      });
    } catch (submitError) {
      setReplyStatus({
        tone: 'error',
        text:
          submitError instanceof Error
            ? submitError.message
            : 'Não foi possível enviar sua resposta agora.',
      });
    } finally {
      setSubmittingReply(false);
    }
  }

  return (
    <div className="container space-y-10 py-14">
      <section className="rounded-[36px] bg-slate-950 p-8 text-white shadow-soft">
        <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-200">
              Dashboard do freelancer
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight">
              {dashboard.profile.name}, seu perfil está ativo e visível nas buscas.
            </h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-slate-300">
              Gerencie apresentação, portfólio, assinatura e acompanhe as conversas do cliente
              sem tirar ninguém da plataforma.
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
              <span className="font-semibold text-white">{dashboard.subscription.status}</span>
            </p>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <StatsCard
          helper="Volume acumulado de visitas na página pública."
          label="Visualizações do perfil"
          value={dashboard.metrics.profileViews.toString()}
        />
        <StatsCard
          helper="Ações de contato registradas no fluxo protegido da plataforma."
          label="Ações de contato"
          value={dashboard.metrics.contactClicks.toString()}
        />
        <StatsCard
          helper="Mensagens que chegaram dentro das conversas da plataforma."
          label="Mensagens recebidas"
          value={dashboard.metrics.messagesReceived.toString()}
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1fr_1.02fr]">
        <article className="glass-panel rounded-[32px] p-7 shadow-soft">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Contatos recentes
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Leads recebidos</h2>
              <p className="mt-2 text-sm text-slate-500">
                Abra o chat para responder por aqui ou siga no e-mail quando esse for o canal
                escolhido.
              </p>
            </div>
            <Link
              className="text-sm font-semibold text-brand-600"
              to={`/freelancers/${dashboard.profile.slug}`}
            >
              Ver perfil público
            </Link>
          </div>

          <div className="mt-6 space-y-4">
            {dashboard.recentContacts.length > 0 ? (
              dashboard.recentContacts.map((contact) => {
                const isActive = contact.id === activeContact?.id;

                return (
                  <div
                    key={contact.id}
                    className={`rounded-[24px] border p-5 transition ${
                      isActive
                        ? 'border-cyan-300/50 bg-cyan-500/8 shadow-soft'
                        : 'border-slate-200/80 bg-white/80'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <p className="text-sm font-semibold text-slate-950">{contact.subject}</p>
                        <p className="mt-1 text-sm text-slate-500">
                          {contact.clientName} • {contact.clientLocation}
                        </p>
                        <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-400">
                          {shortDate(contact.createdAt)}
                        </p>
                      </div>
                      <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                        {contact.channel}
                      </span>
                    </div>

                    <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">
                      {contact.message}
                    </p>

                    <div className="mt-4 flex flex-wrap items-center gap-3">
                      <button
                        className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                          isActive
                            ? 'bg-slate-950 text-white hover:bg-slate-800'
                            : 'border border-slate-200 bg-white text-slate-700 hover:border-cyan-300 hover:text-cyan-700'
                        }`}
                        onClick={() => openContact(contact.id)}
                        type="button"
                      >
                        {isActive ? 'Conversa aberta' : 'Abrir conversa'}
                      </button>
                      <span className="text-xs font-medium text-slate-500">
                        {contact.channel === 'Plataforma'
                          ? 'Chat interno ativo'
                          : 'Resposta segue por e-mail'}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[24px] border border-slate-200/80 bg-white/80 p-5 text-sm text-slate-500">
                Nenhum lead recebido ainda. Quando um cliente entrar em contato, a conversa vai
                aparecer aqui.
              </div>
            )}
          </div>
        </article>

        <article
          className="rounded-[32px] border border-slate-800/40 bg-[linear-gradient(180deg,#020617_0%,#0f172a_100%)] p-7 text-white shadow-soft"
          ref={conversationPanelRef}
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="font-mono text-sm font-semibold uppercase tracking-[0.22em] text-cyan-200">
                Central de conversa
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                {activeContact ? activeContact.subject : 'Selecione um lead'}
              </h2>
              <p className="mt-2 text-sm text-slate-300">
                {activeContact
                  ? activeContact.channel === 'Plataforma'
                    ? 'Esta conversa continua dentro da plataforma.'
                    : 'Este lead escolheu continuidade por e-mail.'
                  : 'Escolha um lead em “Leads recebidos” para abrir a conversa por aqui.'}
              </p>
            </div>
            {activeContact ? (
              <div className="flex flex-wrap items-center gap-3">
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-cyan-100">
                  {activeContact.channel}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-cyan-100">
                  {activeContact.status}
                </span>
              </div>
            ) : null}
          </div>

          {activeContact ? (
            <div className="mt-6 space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Cliente</p>
                  <p className="mt-2 text-sm font-semibold text-white">{activeContact.clientName}</p>
                  <p className="mt-1 text-sm text-slate-300">{activeContact.clientLocation}</p>
                </div>
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Contato</p>
                  <p className="mt-2 text-sm font-semibold text-white">
                    {activeContact.clientEmail ?? 'E-mail não informado'}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Lead recebido em {shortDateTime(activeContact.createdAt)}
                  </p>
                </div>
              </div>

              <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-400">
                  Histórico da conversa
                </p>
                <div className="mt-4 space-y-3">
                  {activeContact.messages.map((message) => {
                    const isFreelancerMessage = message.senderRole === 'freelancer';

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isFreelancerMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-[24px] px-4 py-3 text-sm shadow-soft ${
                            isFreelancerMessage
                              ? 'bg-cyan-400 text-slate-950'
                              : 'border border-white/10 bg-slate-900/80 text-slate-100'
                          }`}
                        >
                          <p
                            className={`text-xs font-semibold uppercase tracking-[0.14em] ${
                              isFreelancerMessage ? 'text-slate-900/70' : 'text-cyan-200'
                            }`}
                          >
                            {isFreelancerMessage ? 'Você' : message.senderName}
                          </p>
                          <p className="mt-2 leading-6">{message.body}</p>
                          <p
                            className={`mt-3 text-[11px] ${
                              isFreelancerMessage ? 'text-slate-900/70' : 'text-slate-400'
                            }`}
                          >
                            {shortDateTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {activeContact.channel === 'Plataforma' ? (
                <form className="space-y-4" onSubmit={handleReplySubmit}>
                  <label className="block space-y-2">
                    <span className="text-sm font-semibold text-white">Responder no chat</span>
                    <textarea
                      className="min-h-[140px] w-full rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-400/10"
                      onChange={(event) => setReplyMessage(event.target.value)}
                      placeholder="Escreva sua resposta para continuar a conversa sem tirar o cliente da plataforma."
                      value={replyMessage}
                    />
                  </label>

                  {replyStatus ? (
                    <div
                      className={`rounded-[22px] px-4 py-3 text-sm ${
                        replyStatus.tone === 'success'
                          ? 'border border-emerald-300/30 bg-emerald-500/10 text-emerald-200'
                          : 'border border-rose-300/30 bg-rose-500/10 text-rose-200'
                      }`}
                    >
                      {replyStatus.text}
                    </div>
                  ) : null}

                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-200"
                      disabled={submittingReply}
                      type="submit"
                    >
                      {submittingReply ? 'Enviando...' : 'Enviar no chat'}
                    </button>
                    <span className="text-sm text-slate-300">
                      O cliente visualiza essa resposta no dashboard dele.
                    </span>
                  </div>
                </form>
              ) : (
                <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                  <p className="text-sm font-semibold text-white">Canal de e-mail selecionado</p>
                  <p className="mt-3 text-sm leading-6 text-slate-300">
                    Esse lead preferiu seguir por e-mail. O histórico inicial continua salvo aqui,
                    mas a resposta deve sair pelo correio eletrônico.
                  </p>
                  {activeContact.clientEmail ? (
                    <a
                      className="mt-5 inline-flex rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100"
                      href={`mailto:${activeContact.clientEmail}?subject=${encodeURIComponent(`Re: ${activeContact.subject}`)}`}
                    >
                      Responder por e-mail
                    </a>
                  ) : (
                    <p className="mt-4 text-sm text-slate-400">
                      Este lead ainda não informou um e-mail para retorno.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-6 rounded-[26px] border border-white/10 bg-white/5 p-5 text-sm leading-6 text-slate-300">
              Escolha um lead em “Leads recebidos” para abrir a conversa por aqui.
            </div>
          )}
        </article>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <article className="glass-panel rounded-[32px] p-7 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
            Resumo profissional
          </p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            {dashboard.profile.profession}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">{dashboard.profile.summary}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-[24px] bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Categoria</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {dashboard.profile.category}
              </p>
            </div>
            <div className="rounded-[24px] bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Preço médio</p>
              {dashboard.profile.averagePrice !== null ? (
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  {currency(dashboard.profile.averagePrice)}
                </p>
              ) : (
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  Oculto no perfil público
                </p>
              )}
            </div>
            <div className="rounded-[24px] bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">E-mail</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">{dashboard.account.email}</p>
            </div>
            <div className="rounded-[24px] bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Telefone</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">{dashboard.account.phone}</p>
            </div>
            <div className="rounded-[24px] bg-white/80 p-4">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-400">CNPJ</p>
              <p className="mt-2 text-sm font-semibold text-slate-700">
                {dashboard.account.hasCnpj ? 'Possui CNPJ' : 'Sem CNPJ'}
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                {dashboard.account.hasCnpj
                  ? 'Conta configurada para atendimento como pessoa jurídica.'
                  : 'Você pode atualizar isso depois quando decidir operar com CNPJ.'}
              </p>
            </div>
          </div>
        </article>

        <div className="space-y-6">
          <article className="rounded-[32px] border border-brand-100 bg-brand-50 p-7 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-700">
              Checklist do MVP
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
              <li>Editar informações do perfil profissional.</li>
              <li>Gerenciar portfólio e links externos.</li>
              <li>Responder no chat da plataforma ou seguir por e-mail.</li>
            </ul>
          </article>

          <article className="glass-panel rounded-[32px] p-7 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
              Acesso rápido
            </p>
            <div className="mt-5 grid gap-3">
              <Link
                className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
                to={`/freelancers/${dashboard.profile.slug}`}
              >
                Ver perfil público
              </Link>
              <a
                className="rounded-full border border-slate-200 px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                href={`mailto:${dashboard.account.email}`}
              >
                Abrir e-mail profissional
              </a>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
