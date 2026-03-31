import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { useAppSession } from '../context/AppSessionContext';
import {
  institutionalEmail,
  institutionalInstagramHandle,
  institutionalInstagramUrl,
  institutionalLinkedinLabel,
  institutionalLinkedinUrl,
  institutionalSupportMailto,
} from '../lib/institutional';
import { ChatDock } from './ChatDock';

const marketingLinks = [
  { id: 'como-funciona', label: 'Como funciona' },
  { id: 'servicos', label: 'Serviços' },
];

const footerNavigationLinks = [
  { kind: 'route', label: 'Início', to: '/' },
  { kind: 'section', label: 'Como funciona', sectionId: 'como-funciona' },
  { kind: 'section', label: 'Serviços', sectionId: 'servicos' },
  { kind: 'section', label: 'Para clientes', sectionId: 'para-clientes' },
  { kind: 'section', label: 'Para freelancers', sectionId: 'para-freelancers' },
  { kind: 'route', label: 'Contato', to: '/info/contato' },
  { kind: 'route', label: 'Entrar', to: '/login' },
] as const;

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { session, clearSession, loading } = useAppSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const dashboardRoute =
    session?.role === 'freelancer' ? '/dashboard/freelancer' : '/dashboard/cliente';
  const publicProfileRoute = session?.role === 'freelancer' ? '/meu-perfil' : null;
  const firstName = session?.name.split(' ')[0] ?? '';

  function scrollToSection(sectionId: string) {
    const target = document.getElementById(sectionId);
    if (!target) {
      return;
    }

    const header = document.querySelector('header');
    const headerOffset = header instanceof HTMLElement ? header.offsetHeight + 20 : 116;
    const top = target.getBoundingClientRect().top + window.scrollY - headerOffset;

    window.scrollTo({
      top,
      behavior: 'smooth',
    });
  }

  function openMarketingSection(sectionId: string) {
    if (location.pathname === '/') {
      const nextHash = `#${sectionId}`;
      if (location.hash !== nextHash) {
        navigate({ pathname: '/', hash: nextHash });
      }

      window.setTimeout(() => {
        scrollToSection(sectionId);
      }, 20);
      return;
    }

    navigate({ pathname: '/', hash: `#${sectionId}` });
  }

  useEffect(() => {
    if (location.pathname !== '/' || !location.hash) {
      return;
    }

    const sectionId = decodeURIComponent(location.hash.slice(1));
    const timeout = window.setTimeout(() => {
      scrollToSection(sectionId);
    }, 60);

    return () => window.clearTimeout(timeout);
  }, [location.hash, location.pathname]);

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/96 shadow-[0_8px_24px_rgba(15,23,42,0.04)]">
        <div className="container flex items-center justify-between gap-3 py-3 sm:gap-4 sm:py-4">
          <Link className="flex items-center gap-3 sm:gap-4" to="/">
            <img
              alt="Logo FaçoFreela"
              className="h-[3.2rem] w-auto object-contain sm:h-[4.5rem]"
              src="/logo.png"
            />
            <div className="space-y-1">
              <p className="brand-wordmark text-[1.38rem] text-slate-950 sm:text-[1.7rem] lg:text-[2.15rem]">
                <span>Faço</span>
                <span className="brand-wordmark-accent">Freela</span>
              </p>
              <p className="hidden text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-500 sm:block">
                Serviços para todo tipo de trabalho
              </p>
            </div>
          </Link>

          <button
            className="rounded-full border border-slate-200 bg-white px-3.5 py-2 text-[13px] font-semibold text-slate-700 lg:hidden"
            onClick={() => setMobileOpen((current) => !current)}
            type="button"
          >
            Menu
          </button>

          <nav className="hidden items-center gap-6 lg:flex">
            {marketingLinks.map((item) => (
              <button
                key={item.label}
                className="text-sm font-medium text-slate-600 transition hover:text-slate-950"
                onClick={() => openMarketingSection(item.id)}
                type="button"
              >
                {item.label}
              </button>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            {loading ? null : session ? (
              <>
                <Link
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                  to="/mensagens"
                >
                  Mensagens
                </Link>
                {publicProfileRoute ? (
                  <Link
                    className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                    to={publicProfileRoute}
                  >
                    {firstName}
                  </Link>
                ) : (
                  <span className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
                    {firstName}
                  </span>
                )}
                <Link
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                  to={dashboardRoute}
                >
                  Dashboard
                </Link>
                <button
                  className="rounded-full bg-[#0071e3] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#0077ed]"
                  onClick={() => {
                    void clearSession();
                  }}
                  type="button"
                >
                  Sair
                </button>
              </>
            ) : (
              <>
                <Link
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950"
                  to="/login"
                >
                  Entrar
                </Link>
                <Link
                  className="text-sm font-semibold text-slate-600 transition hover:text-slate-950"
                  to="/cadastro/cliente"
                >
                  Criar conta
                </Link>
                <Link
                  className="rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,113,227,0.22)] transition hover:bg-[#0077ed]"
                  to="/cadastro/freelancer"
                >
                  Virar freelancer
                </Link>
              </>
            )}
          </div>
        </div>

        {mobileOpen ? (
          <div className="border-t border-white/60 bg-white/92 lg:hidden">
            <div className="container flex flex-col gap-2.5 py-3.5">
              {marketingLinks.map((item) => (
                <button
                  key={item.label}
                  className="text-left text-[13px] font-medium text-slate-700"
                  onClick={() => {
                    openMarketingSection(item.id);
                    setMobileOpen(false);
                  }}
                  type="button"
                >
                  {item.label}
                </button>
              ))}

              {loading ? null : session ? (
                <>
                  <Link
                    className="text-[13px] font-semibold text-slate-950"
                    onClick={() => setMobileOpen(false)}
                    to="/mensagens"
                  >
                    Mensagens
                  </Link>
                  {publicProfileRoute ? (
                    <Link
                      className="text-[13px] font-semibold text-slate-950"
                      onClick={() => setMobileOpen(false)}
                      to={publicProfileRoute}
                    >
                      Meu perfil p?blico
                    </Link>
                  ) : null}
                  <Link
                    className="text-[13px] font-semibold text-slate-950"
                    onClick={() => setMobileOpen(false)}
                    to={dashboardRoute}
                  >
                    Dashboard
                  </Link>
                  <button
                    className="text-left text-[13px] font-semibold text-slate-700"
                    onClick={() => {
                      void clearSession();
                      setMobileOpen(false);
                    }}
                    type="button"
                  >
                    Sair
                  </button>
                </>
              ) : (
                <>
                  <Link
                    className="text-[13px] font-semibold text-slate-950"
                    onClick={() => setMobileOpen(false)}
                    to="/login"
                  >
                    Entrar
                  </Link>
                  <Link
                    className="text-[13px] font-semibold text-slate-950"
                    onClick={() => setMobileOpen(false)}
                    to="/cadastro/cliente"
                  >
                    Criar conta
                  </Link>
                  <Link
                    className="text-[13px] font-semibold text-[#0071e3]"
                    onClick={() => setMobileOpen(false)}
                    to="/cadastro/freelancer"
                  >
                    Virar freelancer
                  </Link>
                </>
              )}
            </div>
          </div>
        ) : null}
      </header>

      <main className="pb-32 lg:pb-36">
        <Outlet />
      </main>

      <footer className="relative overflow-hidden border-t border-slate-900/90 bg-[linear-gradient(180deg,#0f172a_0%,#0b1220_100%)] text-slate-100">
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(125,211,252,0.65),transparent)]" />
        <div className="absolute -right-20 top-0 h-56 w-56 rounded-full bg-[#38bdf8]/10 blur-3xl" />
        <div className="absolute -left-16 bottom-0 h-48 w-48 rounded-full bg-[#0f172a]/80 blur-2xl" />

        <div className="container relative py-14 sm:py-16">
          <div className="grid gap-8 border-b border-white/10 pb-10 md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_0.95fr_1fr]">
            <div className="space-y-5">
              <span className="inline-flex rounded-full border border-white/12 bg-white/6 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-sky-100/90">
                Plataforma oficial
              </span>
              <div className="space-y-3">
                <p className="brand-wordmark text-[2rem] text-white">
                  <span>Faço </span>
                  <span className="brand-wordmark-accent text-sky-300">Freela</span>
                </p>
                <p className="text-base font-medium text-slate-200">Site + sistema para freela</p>
                <p className="max-w-md text-sm leading-7 text-slate-400">
                  Mais clareza, organização e praticidade para o dia a dia do freela.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Navegação
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
                {footerNavigationLinks.map((item) =>
                  item.kind === 'route' ? (
                    <Link
                      key={item.label}
                      className="text-sm text-slate-300 transition hover:text-white"
                      to={item.to}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      key={item.label}
                      className="text-left text-sm text-slate-300 transition hover:text-white"
                      onClick={() => openMarketingSection(item.sectionId)}
                      type="button"
                    >
                      {item.label}
                    </button>
                  ),
                )}
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Suporte institucional
              </p>
              <div className="rounded-[28px] border border-white/10 bg-white/[0.045] p-5 shadow-[0_18px_48px_rgba(2,6,23,0.24)]">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Canal oficial</p>
                <a
                  className="mt-3 block text-base font-semibold text-white transition hover:text-sky-200"
                  href={institutionalSupportMailto}
                >
                  {institutionalEmail}
                </a>
                <p className="mt-3 text-sm leading-6 text-slate-400">
                  Atendimento institucional para dúvidas, suporte e assuntos oficiais da marca.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
                Redes oficiais
              </p>
              <div className="space-y-3">
                <a
                  className="group flex items-start gap-4 rounded-[28px] border border-white/10 bg-white/[0.045] p-4 transition hover:border-sky-300/30 hover:bg-white/[0.07]"
                  href={institutionalInstagramUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100">
                    IG
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">Instagram</span>
                    <span className="mt-1 block text-sm text-slate-400 transition group-hover:text-slate-200">
                      {institutionalInstagramHandle}
                    </span>
                  </span>
                </a>

                <a
                  className="group flex items-start gap-4 rounded-[28px] border border-white/10 bg-white/[0.045] p-4 transition hover:border-sky-300/30 hover:bg-white/[0.07]"
                  href={institutionalLinkedinUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-white/6 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-100">
                    in
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-white">Faço Freela</span>
                    <span className="mt-1 block text-sm text-slate-400 transition group-hover:text-slate-200">
                      {institutionalLinkedinLabel}
                    </span>
                  </span>
                </a>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-4 pt-6 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
            <p>© 2026 Faço Freela. Todos os direitos reservados.</p>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              <Link className="transition hover:text-white" to="/info/privacidade">
                Política de Privacidade
              </Link>
              <Link className="transition hover:text-white" to="/info/termos">
                Termos de Uso
              </Link>
            </div>
          </div>
        </div>
      </footer>

      <ChatDock />
    </div>
  );
}
