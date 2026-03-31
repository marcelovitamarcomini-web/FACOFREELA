import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import type { ClientDashboard } from '../../shared/contracts';
import { FreelancerCard } from '../components/FreelancerCard';
import { useChat } from '../context/ChatContext';
import { api } from '../lib/api';
import { getConversationPeerName, getLatestMessage } from '../lib/chat';
import { shortDateTime } from '../lib/format';

export function ClientDashboardPage() {
  const { contacts, notifications } = useChat();
  const [dashboard, setDashboard] = useState<ClientDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();

    async function loadDashboard() {
      try {
        const data = await api.getClientDashboard({
          signal: controller.signal,
        });

        if (!controller.signal.aborted) {
          setDashboard(data);
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

  return (
    <div className="container space-y-10 py-14">
      <section className="glass-panel rounded-[36px] p-8 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div className="max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">
              Dashboard do cliente
            </p>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-950">
              {dashboard.profile.name}, acompanhe propostas e respostas sem sair do site.
            </h1>
            <p className="mt-4 text-base leading-7 text-slate-600">
              O fluxo oficial entre cliente e freelancer agora fica concentrado no chat interno da
              plataforma. O rodapé mostra notificações recebidas e a central de mensagens guarda
              todo o histórico.
            </p>
          </div>

          <div className="grid min-w-[15rem] gap-3">
            <div className="rounded-[24px] border border-cyan-200 bg-cyan-50 px-5 py-4">
              <p className="text-xs uppercase tracking-[0.18em] text-cyan-700">Novas respostas</p>
              <p className="mt-2 text-3xl font-extrabold text-slate-950">
                {notifications.length}
              </p>
            </div>
            <Link
              className="rounded-full bg-slate-950 px-5 py-3 text-center text-sm font-semibold text-white transition hover:bg-slate-800"
              to="/mensagens"
            >
              Abrir central de mensagens
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1fr_0.92fr]">
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
          <article className="rounded-[32px] bg-slate-950 p-7 text-white shadow-soft">
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-200">
                  Mensagens
                </p>
                <h2 className="mt-2 text-2xl font-bold">Conversas recentes</h2>
              </div>
              <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-cyan-100">
                {contacts.length} chats
              </span>
            </div>

            <div className="mt-5 space-y-4">
              {contacts.length > 0 ? (
                contacts.slice(0, 3).map((contact) => {
                  const latestMessage = getLatestMessage(contact);

                  return (
                    <Link
                      key={contact.id}
                      className="block rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 transition hover:bg-white/10"
                      to={`/mensagens?chat=${contact.id}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-white">
                            {getConversationPeerName(contact, 'client')}
                          </p>
                          <p className="truncate text-xs uppercase tracking-[0.16em] text-cyan-200">
                            {contact.subject}
                          </p>
                        </div>
                        <span className="text-xs text-slate-400">
                          {shortDateTime(latestMessage?.createdAt ?? contact.createdAt)}
                        </span>
                      </div>
                      <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-300">
                        {latestMessage?.body ?? contact.message}
                      </p>
                    </Link>
                  );
                })
              ) : (
                <div className="rounded-[24px] border border-white/10 bg-white/5 px-5 py-4 text-sm leading-6 text-slate-300">
                  Assim que um contato for aberto no perfil de um freelancer, ele aparece aqui e
                  também na central completa.
                </div>
              )}
            </div>
          </article>

          <article className="rounded-[32px] border border-brand-100 bg-brand-50 p-7 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-700">
              Comunicação protegida
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-700">
              <li>O único canal oficial entregue pela plataforma é o chat interno.</li>
              <li>Notificações recebidas aparecem na dock fixa no rodapé.</li>
              <li>Se as partes trocarem contatos por conta própria dentro do chat, isso não fica sob responsabilidade da plataforma.</li>
            </ul>
          </article>

          <article className="glass-panel rounded-[32px] p-7 shadow-soft">
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
              Avisos da conta
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-slate-600">
              {[...dashboard.notifications, `${notifications.length} nova(s) resposta(s) aguardando leitura na central.`].map((notification) => (
                <li
                  key={notification}
                  className="rounded-[22px] border border-slate-200 bg-white/80 px-4 py-4"
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
