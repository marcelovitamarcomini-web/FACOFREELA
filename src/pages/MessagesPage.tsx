import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { useChat } from '../context/ChatContext';
import { useAppSession } from '../context/AppSessionContext';
import { getConversationPeerName, getLatestMessage } from '../lib/chat';
import { handleDesktopEnterSubmit } from '../lib/desktop-submit';
import { shortDateTime } from '../lib/format';

export function MessagesPage() {
  const { session } = useAppSession();
  const {
    activeChatId,
    contacts,
    error,
    loading,
    markAsRead,
    notifications,
    pendingContactIds,
    selectChat,
    sendMessage,
  } = useChat();
  const [replyMessage, setReplyMessage] = useState('');
  const [replyStatus, setReplyStatus] = useState<string | null>(null);
  const [searchParams] = useSearchParams();

  useEffect(() => {
    const requestedChatId = searchParams.get('chat');
    if (requestedChatId && contacts.some((contact) => contact.id === requestedChatId)) {
      selectChat(requestedChatId);
      return;
    }

    if (!activeChatId && contacts[0]) {
      selectChat(contacts[0].id);
    }
  }, [activeChatId, contacts, searchParams, selectChat]);

  useEffect(() => {
    if (!activeChatId) {
      return;
    }

    const contact = contacts.find((item) => item.id === activeChatId);
    if (!contact) {
      return;
    }

    markAsRead(contact.id);
  }, [activeChatId, contacts, markAsRead]);

  if (!session) {
    return null;
  }

  const dashboardRoute =
    session.role === 'freelancer' ? '/dashboard/freelancer' : '/dashboard/cliente';
  const activeContact = contacts.find((contact) => contact.id === activeChatId) ?? null;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!activeContact) {
      return;
    }

    const trimmedMessage = replyMessage.trim();
    if (!trimmedMessage) {
      setReplyStatus('Escreva sua mensagem antes de enviar.');
      return;
    }

    try {
      await sendMessage(activeContact.id, trimmedMessage);
      setReplyMessage('');
      setReplyStatus(null);
    } catch (sendError) {
      setReplyStatus(sendError instanceof Error ? sendError.message : 'Não foi possível enviar.');
    }
  }

  function handleReplyKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    handleDesktopEnterSubmit(event);
  }

  return (
    <div className="container space-y-6 py-12">
      <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-500">
              Central de mensagens
            </p>
            <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-950">
              Um chat por pessoa, com histórico contínuo.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Se o mesmo cliente voltar a falar com o mesmo freelancer, a mensagem entra nesta
              mesma thread. Nada de chat duplicado.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Novas respostas</p>
              <p className="mt-1 text-lg font-bold text-slate-950">
                {notifications.length}
              </p>
            </div>
            <Link
              className="rounded-full border border-slate-200 px-5 py-3 text-center text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
              to={dashboardRoute}
            >
              Voltar ao dashboard
            </Link>
          </div>
        </div>

        <div className="mt-5 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-500">
          O único canal oficial entregue pela plataforma é este chat interno. Se as partes
          compartilharem telefone, e-mail ou outro meio dentro da conversa, isso não fica sob
          responsabilidade da plataforma.
        </div>
      </section>

      {error ? (
        <div className="rounded-[28px] border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
          {error}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[21rem_minmax(0,1fr)]">
        <aside className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-soft">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                Chats
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">
                {contacts.length} conversas
              </h2>
            </div>
            <span className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
              {notifications.length} novas
            </span>
          </div>

          <div className="mt-4 space-y-2.5">
            {loading && contacts.length === 0 ? (
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-500">
                Carregando sua central...
              </div>
            ) : contacts.length > 0 ? (
              contacts.map((contact) => {
                const isActive = contact.id === activeContact?.id;
                const latestMessage = getLatestMessage(contact);
                const unread = notifications.some((notification) => notification.id === contact.id);

                return (
                  <button
                    key={contact.id}
                    className={`w-full rounded-[18px] border px-4 py-3.5 text-left transition ${
                      isActive
                        ? 'border-slate-950 bg-white shadow-soft'
                        : 'border-slate-200 bg-slate-50 hover:border-slate-300 hover:bg-white'
                    }`}
                    onClick={() => {
                      selectChat(contact.id);
                      setReplyStatus(null);
                    }}
                    type="button"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-950">
                          {getConversationPeerName(contact, session.role)}
                        </p>
                        <p className="truncate text-xs uppercase tracking-[0.14em] text-slate-400">
                          {contact.subject}
                        </p>
                      </div>
                      {unread ? (
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold text-white">
                          Novo
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                      {latestMessage?.body ?? contact.message}
                    </p>
                    <p className="mt-3 text-xs text-slate-400">
                      {shortDateTime(latestMessage?.createdAt ?? contact.createdAt)}
                    </p>
                  </button>
                );
              })
            ) : (
              <div className="rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500">
                Nenhuma conversa ainda. Quando um contato for iniciado no perfil de um freelancer,
                ele aparece aqui.
              </div>
            )}
          </div>
        </aside>

        <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-soft">
          {activeContact ? (
            <>
              <div className="border-b border-slate-200 bg-white px-6 py-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                      Chat interno
                    </p>
                    <h2 className="mt-2 text-2xl font-bold text-slate-950">
                      {getConversationPeerName(activeContact, session.role)}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500">{activeContact.subject}</p>
                  </div>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
                    {activeContact.status}
                  </span>
                </div>
              </div>

              <div className="space-y-3 bg-white px-6 py-6">
                {activeContact.messages.map((message) => {
                  const isOwnMessage = message.senderRole === session.role;

                  return (
                    <div
                      key={message.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[88%] rounded-[20px] px-4 py-3 text-sm ${
                          isOwnMessage
                            ? 'bg-slate-950 text-white'
                            : 'border border-slate-200 bg-slate-50 text-slate-700'
                        }`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-[0.12em]">
                          {isOwnMessage ? 'Você' : message.senderName}
                        </p>
                        <p className="mt-2 leading-7">{message.body}</p>
                        <p className="mt-3 text-[11px] opacity-70">
                          {shortDateTime(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <form className="border-t border-slate-200 bg-white px-6 py-5" onSubmit={handleSubmit}>
                <textarea
                  className="min-h-[132px] w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
                  onChange={(event) => setReplyMessage(event.target.value)}
                  onKeyDown={handleReplyKeyDown}
                  placeholder="Continue a conversa aqui dentro."
                  value={replyMessage}
                />

                {replyStatus ? (
                  <div className="mt-3 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                    {replyStatus}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
                  <p className="max-w-2xl text-xs leading-6 text-slate-500">
                    O histórico oficial da negociação permanece registrado aqui.
                  </p>
                  <button
                    className="rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                    disabled={pendingContactIds.includes(activeContact.id)}
                    type="submit"
                  >
                    {pendingContactIds.includes(activeContact.id) ? 'Enviando...' : 'Enviar no chat'}
                  </button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex h-full min-h-[26rem] items-center justify-center px-6 py-10 text-center">
              <div className="max-w-lg space-y-3">
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
                  Conversa
                </p>
                <h2 className="text-2xl font-bold text-slate-950">
                  Escolha um chat para abrir a thread completa.
                </h2>
                <p className="text-sm leading-6 text-slate-500">
                  A lateral mostra todas as conversas e o rodapé do site continua reservado para as
                  notificações recebidas.
                </p>
              </div>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}
