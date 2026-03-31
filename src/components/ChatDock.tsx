import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useLocation } from 'react-router-dom';

import type { ContactMessage, UserRole } from '../../shared/contracts';
import { useChat } from '../context/ChatContext';
import { useAppSession } from '../context/AppSessionContext';
import { getConversationPeerName, getLatestMessage } from '../lib/chat';
import { handleDesktopEnterSubmit } from '../lib/desktop-submit';
import { shortDateTime } from '../lib/format';

function ChatDockWindow({
  compact = false,
  contact,
  pending,
  role,
}: {
  compact?: boolean;
  contact: ContactMessage;
  pending: boolean;
  role: UserRole;
}) {
  const { closeDockChat, markAsRead, sendMessage } = useChat();
  const [replyMessage, setReplyMessage] = useState('');
  const [replyStatus, setReplyStatus] = useState<string | null>(null);

  useEffect(() => {
    markAsRead(contact.id);
  }, [contact.id, contact.messages.length, markAsRead]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmedMessage = replyMessage.trim();
    if (!trimmedMessage) {
      setReplyStatus('Escreva sua mensagem antes de enviar.');
      return;
    }

    try {
      await sendMessage(contact.id, trimmedMessage);
      setReplyMessage('');
      setReplyStatus(null);
    } catch (sendError) {
      setReplyStatus(
        sendError instanceof Error ? sendError.message : 'Não foi possível enviar agora.',
      );
    }
  }

  function handleReplyKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    handleDesktopEnterSubmit(event);
  }

  return (
    <section className="flex h-full flex-col overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-[0_18px_48px_rgba(15,23,42,0.14)]">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-950">
            {getConversationPeerName(contact, role)}
          </p>
          <p className="truncate text-xs text-slate-500">{contact.subject}</p>
        </div>
        <button
          className="rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-950"
          onClick={() => closeDockChat()}
          type="button"
        >
          Fechar
        </button>
      </div>

      <div
        className={`space-y-3 overflow-y-auto bg-white px-4 py-4 ${
          compact ? 'max-h-[44vh]' : 'max-h-[22rem]'
        }`}
      >
        {contact.messages.map((message) => {
          const isOwnMessage = message.senderRole === role;

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
                <p className="mt-2 leading-6">{message.body}</p>
                <p className="mt-3 text-[11px] opacity-70">{shortDateTime(message.createdAt)}</p>
              </div>
            </div>
          );
        })}
      </div>

      <form className="border-t border-slate-200 bg-white px-4 py-4" onSubmit={handleSubmit}>
        <p className="mb-3 text-[11px] leading-5 text-slate-500">
          Canal oficial da plataforma. O histórico fica inteiro aqui.
        </p>
        <textarea
          className="min-h-[104px] w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-400 focus:ring-4 focus:ring-slate-200"
          onChange={(event) => setReplyMessage(event.target.value)}
          onKeyDown={handleReplyKeyDown}
          placeholder="Responda sem tirar a conversa do site."
          value={replyMessage}
        />

        {replyStatus ? (
          <div className="mt-3 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {replyStatus}
          </div>
        ) : null}

        <div className="mt-3 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">
            Última atividade {shortDateTime(getLatestMessage(contact)?.createdAt ?? contact.createdAt)}
          </span>
          <button
            className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
            disabled={pending}
            type="submit"
          >
            {pending ? 'Enviando...' : 'Enviar'}
          </button>
        </div>
      </form>
    </section>
  );
}

export function ChatDock() {
  const location = useLocation();
  const { session } = useAppSession();
  const { contacts, dockChatId, loading, notifications, openDockChat, pendingContactIds } =
    useChat();
  const [trayOpen, setTrayOpen] = useState(false);

  if (!session || location.pathname === '/mensagens') {
    return null;
  }

  const dashboardRoute =
    session.role === 'freelancer' ? '/dashboard/freelancer' : '/dashboard/cliente';
  const dockContact = contacts.find((contact) => contact.id === dockChatId) ?? null;
  const notificationCount = notifications.length;

  return (
    <>
      {dockContact ? (
        <>
          <div className="fixed bottom-24 right-4 z-50 hidden h-[34rem] w-[20rem] lg:block">
            <ChatDockWindow
              contact={dockContact}
              pending={pendingContactIds.includes(dockContact.id)}
              role={session.role}
            />
          </div>
          <div className="fixed inset-x-0 bottom-0 z-50 h-[72vh] px-3 pb-3 lg:hidden">
            <ChatDockWindow
              compact
              contact={dockContact}
              pending={pendingContactIds.includes(dockContact.id)}
              role={session.role}
            />
          </div>
        </>
      ) : null}

      <div className="fixed bottom-4 right-4 z-50 w-[min(92vw,24rem)]">
        {trayOpen ? (
          <div className="mb-3 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_18px_48px_rgba(15,23,42,0.12)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">Notificações do chat</p>
                <p className="text-xs text-slate-500">
                  Aqui embaixo fica só o que chegou para você.
                </p>
              </div>
              <button
                className="text-xs font-semibold text-slate-500 transition hover:text-slate-900"
                onClick={() => setTrayOpen(false)}
                type="button"
              >
                Fechar
              </button>
            </div>

            <div className="mt-4 space-y-3">
              {loading ? (
                <div className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-500">
                  Atualizando suas mensagens...
                </div>
              ) : notificationCount > 0 ? (
                notifications.map((contact) => {
                  const latestMessage = getLatestMessage(contact);

                  return (
                    <button
                      key={contact.id}
                      className="w-full rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-left transition hover:border-slate-300 hover:bg-white"
                      onClick={() => {
                        openDockChat(contact.id);
                        setTrayOpen(false);
                      }}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-950">
                            {getConversationPeerName(contact, session.role)}
                          </p>
                          <p className="truncate text-xs uppercase tracking-[0.16em] text-slate-400">
                            {contact.subject}
                          </p>
                        </div>
                        <span className="rounded-full bg-slate-950 px-3 py-1 text-[11px] font-semibold text-white">
                          Novo
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">
                        {latestMessage?.body ?? contact.message}
                      </p>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-500">
                  Sem novas notificações. Todas as conversas oficiais continuam na sua central.
                </div>
              )}
            </div>

            <div className="mt-4 flex flex-wrap gap-3">
              <Link className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800" to="/mensagens">
                Abrir central completa
              </Link>
              <Link
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                to={dashboardRoute}
              >
                Ver dashboard
              </Link>
            </div>
          </div>
        ) : null}

        <div className="flex justify-end">
          <button
            className="inline-flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-950 shadow-[0_12px_34px_rgba(15,23,42,0.12)] transition hover:border-slate-300 hover:bg-slate-50"
            onClick={() => setTrayOpen((current) => !current)}
            type="button"
          >
            <span>Mensagens</span>
            <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white">
              {notificationCount}
            </span>
          </button>
        </div>
      </div>
    </>
  );
}
