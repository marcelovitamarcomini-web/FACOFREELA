import { useEffect, useState, type FormEvent } from 'react';

import type { ClientDashboard, ContactMessage } from '../../shared/contracts';
import { FreelancerCard } from '../components/FreelancerCard';
import { api } from '../lib/api';
import { shortDateTime } from '../lib/format';

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

export function ClientDashboardPage() {
  const [dashboard, setDashboard] = useState<ClientDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeContactId, setActiveContactId] = useState<string | null>(null);
  const [replyMessage, setReplyMessage] = useState('');
  const [replyStatus, setReplyStatus] = useState<ReplyStatus | null>(null);
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        const data = await api.getClientDashboard({
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
          Carregando dashboard do cliente...
        </div>
      </div>
    );
  }

  const activeContact =
    dashboard.recentContacts.find((contact) => contact.id === activeContactId) ??
    dashboard.recentContacts[0] ??
    null;

  async function handleReplySubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeContact || activeContact.channel !== 'Plataforma') {
      return;
    }

    const trimmedMessage = replyMessage.trim();
    if (!trimmedMessage) {
      setReplyStatus({
        tone: 'error',
        text: 'Escreva sua mensagem antes de enviar.',
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
        text: 'Mensagem enviada no chat da plataforma.',
      });
    } catch (submitError) {
      setReplyStatus({
        tone: 'error',
        text:
          submitError instanceof Error
            ? submitError.message
            : 'Não foi possível enviar sua mensagem agora.',
      });
    } finally {
      setSubmittingReply(false);
    }
  }

  return (
    <div className="container space-y-10 py-14">
      <section className="glass-panel rounded-[36px] p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">
          Dashboard do cliente
        </p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-950">
          {dashboard.profile.name}, acompanhe seus favoritos e suas conversas.
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-slate-600">
          Sua conta está ativa em {dashboard.profile.location}. Aqui você continua no chat da
          plataforma quando quiser manter tudo organizado em um só lugar.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.9fr]">
        <article className="glass-panel rounded-[32px] p-7 shadow-soft">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
            Freelancers favoritos
          </p>
          <div className="mt-6 grid gap-6">
            {dashboard.favorites.map((freelancer) => (
              <FreelancerCard key={freelancer.id} freelancer={freelancer} />
            ))}
          </div>
        </article>

        <div className="space-y-6">
          <article className="glass-panel rounded-[32px] p-7 shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Conversas recentes
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Mensagens enviadas</h2>
              </div>
              {activeContact ? (
                <span className="rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold text-brand-700">
                  {activeContact.channel}
                </span>
              ) : null}
            </div>

            <div className="mt-5 space-y-4">
              {dashboard.recentContacts.map((contact) => {
                const isActive = contact.id === activeContact?.id;

                return (
                  <button
                    key={contact.id}
                    className={`w-full rounded-[24px] border p-5 text-left transition ${
                      isActive
                        ? 'border-cyan-300/50 bg-cyan-500/8 shadow-soft'
                        : 'border-slate-200/80 bg-white/80 hover:border-cyan-200'
                    }`}
                    onClick={() => {
                      setActiveContactId(contact.id);
                      setReplyMessage('');
                      setReplyStatus(null);
                    }}
                    type="button"
                  >
                    <p className="text-sm font-semibold text-slate-950">{contact.freelancerName}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                      {contact.subject}
                    </p>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{contact.message}</p>
                  </button>
                );
              })}
            </div>
          </article>

          <article className="rounded-[32px] bg-slate-950 p-7 text-white shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-200">
              Conversa ativa
            </p>

            {activeContact ? (
              <div className="mt-5 space-y-4">
                <div className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                  <p className="text-sm font-semibold text-white">{activeContact.freelancerName}</p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-400">
                    {activeContact.subject}
                  </p>
                </div>

                <div className="space-y-3">
                  {activeContact.messages.map((message) => {
                    const isClientMessage = message.senderRole === 'client';

                    return (
                      <div
                        key={message.id}
                        className={`flex ${isClientMessage ? 'justify-end' : 'justify-start'}`}
                      >
                        <div
                          className={`max-w-[88%] rounded-[24px] px-4 py-3 text-sm ${
                            isClientMessage
                              ? 'bg-cyan-400 text-slate-950'
                              : 'border border-white/10 bg-white/5 text-slate-100'
                          }`}
                        >
                          <p
                            className={`text-xs font-semibold uppercase tracking-[0.14em] ${
                              isClientMessage ? 'text-slate-900/70' : 'text-cyan-200'
                            }`}
                          >
                            {isClientMessage ? 'Você' : message.senderName}
                          </p>
                          <p className="mt-2 leading-6">{message.body}</p>
                          <p
                            className={`mt-3 text-[11px] ${
                              isClientMessage ? 'text-slate-900/70' : 'text-slate-400'
                            }`}
                          >
                            {shortDateTime(message.createdAt)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {activeContact.channel === 'Plataforma' ? (
                  <form className="space-y-4" onSubmit={handleReplySubmit}>
                    <textarea
                      className="min-h-[130px] w-full rounded-[24px] border border-white/10 bg-white/5 px-4 py-3 text-sm text-white outline-none transition placeholder:text-slate-500 focus:border-cyan-300 focus:ring-4 focus:ring-cyan-400/10"
                      onChange={(event) => setReplyMessage(event.target.value)}
                      placeholder="Continue a conversa sem sair da plataforma."
                      value={replyMessage}
                    />

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

                    <button
                      className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:bg-slate-200"
                      disabled={submittingReply}
                      type="submit"
                    >
                      {submittingReply ? 'Enviando...' : 'Responder no chat'}
                    </button>
                  </form>
                ) : (
                  <div className="rounded-[24px] border border-white/10 bg-white/5 p-4 text-sm leading-6 text-slate-300">
                    Esta conversa foi aberta no canal de e-mail. O histórico inicial segue salvo
                    aqui, mas a continuidade acontece pelo correio eletrônico.
                  </div>
                )}
              </div>
            ) : (
              <p className="mt-5 text-sm leading-6 text-slate-300">
                Escolha um contato para ver a conversa.
              </p>
            )}
          </article>

          <article className="rounded-[32px] bg-slate-950 p-7 text-white shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-200">
              Notificações
            </p>
            <ul className="mt-5 space-y-4 text-sm leading-6 text-slate-200">
              {dashboard.notifications.map((notification) => (
                <li
                  key={notification}
                  className="rounded-[24px] border border-white/10 bg-white/5 px-4 py-4"
                >
                  {notification}
                </li>
              ))}
            </ul>
          </article>
        </div>
      </section>
    </div>
  );
}
