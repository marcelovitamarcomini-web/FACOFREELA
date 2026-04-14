import { useEffect, useLayoutEffect, useState } from 'react';
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

const marketingLinks = [
  { kind: 'section', label: 'Como funciona', sectionId: 'como-funciona' },
  { kind: 'route', label: 'Serviços', to: '/freelancers' },
  { kind: 'route', label: 'Planos', to: '/assinatura' },
] as const;

const footerNavigationLinks = [
  { kind: 'route', label: 'Início', to: '/' },
  { kind: 'section', label: 'Como funciona', sectionId: 'como-funciona' },
  { kind: 'route', label: 'Serviços', to: '/freelancers' },
  { kind: 'route', label: 'Planos', to: '/assinatura' },
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
  const isHome = location.pathname === '/';

  const headerClass = isHome
    ? 'sticky top-0 z-40 border-b border-white/90 bg-[linear-gradient(180deg,rgba(255,255,255,0.88)_0%,rgba(255,255,255,0.74)_100%)] shadow-[0_18px_54px_rgba(15,23,42,0.06)] backdrop-blur-2xl'
    : 'sticky top-0 z-40 border-b border-slate-200/70 bg-white/96 shadow-[0_8px_24px_rgba(15,23,42,0.04)]';
  const navLinkClass = isHome
    ? 'inline-flex min-h-[44px] items-center rounded-full px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100/90 hover:text-slate-950'
    : 'inline-flex min-h-[44px] items-center rounded-full px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-950';
  const secondaryButtonClass = isHome
    ? 'inline-flex min-h-[44px] items-center rounded-full border border-slate-200 bg-white/92 px-4 py-2 text-sm font-semibold text-slate-700 shadow-[0_8px_22px_rgba(15,23,42,0.04)] transition hover:border-slate-300 hover:text-slate-950'
    : 'inline-flex min-h-[44px] items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-950';
  const textButtonClass = isHome
    ? 'inline-flex min-h-[44px] items-center rounded-full px-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950'
    : 'inline-flex min-h-[44px] items-center rounded-full px-2 text-sm font-semibold text-slate-600 transition hover:text-slate-950';
  const primaryButtonClass = isHome
    ? 'inline-flex min-h-[44px] items-center rounded-full bg-[#0f4fd8] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(15,79,216,0.28)] transition hover:bg-[#1558e8]'
    : 'inline-flex min-h-[44px] items-center rounded-full bg-[#0071e3] px-5 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_rgba(0,113,227,0.22)] transition hover:bg-[#0077ed]';
  const mobileMenuButtonClass = isHome
    ? 'inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 lg:hidden'
    : 'inline-flex min-h-[44px] items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 lg:hidden';
  const mobilePanelClass = isHome
    ? 'border-t border-slate-200/70 bg-white/92 backdrop-blur-xl lg:hidden'
    : 'border-t border-white/60 bg-white/92 lg:hidden';
  const mobileItemClass = isHome
    ? 'flex min-h-[44px] items-center rounded-2xl border border-slate-200/80 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)]'
    : 'flex min-h-[44px] items-center rounded-2xl border border-slate-200/80 bg-white px-4 text-sm font-medium text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)]';
  const mobilePrimaryItemClass = isHome
    ? 'flex min-h-[44px] items-center rounded-2xl border border-[#0f4fd8]/18 bg-[#eaf2ff] px-4 text-sm font-semibold text-[#0f4fd8] shadow-[0_8px_20px_rgba(15,79,216,0.08)]'
    : 'flex min-h-[44px] items-center rounded-2xl border border-[#0071e3]/18 bg-[#0071e3]/6 px-4 text-sm font-semibold text-[#0071e3] shadow-[0_8px_20px_rgba(0,113,227,0.08)]';

  function scrollViewportToTop(behavior: ScrollBehavior = 'auto') {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior,
    });
  }

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

  useLayoutEffect(() => {
    if (location.hash) {
      return;
    }

    scrollViewportToTop();
  }, [location.hash, location.pathname, location.search]);

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

  useEffect(() => {
    function handleSamePageLinkClick(event: MouseEvent) {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target && anchor.target !== '_self') {
        return;
      }

      if (anchor.hasAttribute('download')) {
        return;
      }

      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('mailto:') || href.startsWith('tel:')) {
        return;
      }

      const nextLocation = new URL(anchor.href, window.location.href);
      if (nextLocation.origin !== window.location.origin || nextLocation.hash) {
        return;
      }

      const currentRoute = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      const nextRoute = `${nextLocation.pathname}${nextLocation.search}${nextLocation.hash}`;

      if (currentRoute !== nextRoute) {
        return;
      }

      window.requestAnimationFrame(() => {
        scrollViewportToTop();
      });
    }

    document.addEventListener('click', handleSamePageLinkClick);

    return () => {
      document.removeEventListener('click', handleSamePageLinkClick);
    };
  }, []);

  return (
    <div className="min-h-screen">
      <header className={headerClass}>
        <div className="container flex items-center justify-between gap-3 py-3 sm:gap-4 sm:py-4">
          <Link className="flex items-center gap-3 sm:gap-4" onClick={() => setMobileOpen(false)} to="/">
            <img
              alt="Logo FaçoFreela"
              className="h-[3.2rem] w-auto object-contain sm:h-[4.5rem]"
              src="/logo.png"
            />
            <div className="space-y-1">
              <p
                className={`brand-wordmark text-[1.38rem] sm:text-[1.7rem] lg:text-[2.15rem] ${
                  isHome ? 'text-slate-950' : 'text-slate-950'
                }`}
              >
                <span>Faço</span>
                <span className="brand-wordmark-accent">Freela</span>
              </p>
              <p
                className={`hidden text-[10px] font-semibold uppercase tracking-[0.16em] sm:block ${
                  isHome ? 'text-slate-500' : 'text-slate-500'
                }`}
              >
                Serviços para todo tipo de trabalho
              </p>
            </div>
          </Link>

          <button
            className={mobileMenuButtonClass}
            onClick={() => setMobileOpen((current) => !current)}
            type="button"
          >
            Menu
          </button>

          <nav className="hidden items-center gap-6 lg:flex">
            {marketingLinks.map((item) => (
              item.kind === 'route' ? (
                <Link
                  key={item.label}
                  className={navLinkClass}
                  to={item.to}
                >
                  {item.label}
                </Link>
              ) : (
                <button
                  key={item.label}
                  className={navLinkClass}
                  onClick={() => openMarketingSection(item.sectionId)}
                  type="button"
                >
                  {item.label}
                </button>
              )
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            {loading ? null : session ? (
              <>
                {publicProfileRoute ? (
                  <Link className={secondaryButtonClass} to={publicProfileRoute}>
                    {firstName}
                  </Link>
                ) : (
                  <span className={secondaryButtonClass}>
                    {firstName}
                  </span>
                )}
                <Link className={secondaryButtonClass} to={dashboardRoute}>
                  Dashboard
                </Link>
                {session.role === 'freelancer' ? (
                  <Link className={secondaryButtonClass} to="/assinatura">
                    Assinatura
                  </Link>
                ) : null}
                <button
                  className={primaryButtonClass}
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
                <Link className={secondaryButtonClass} to="/login">
                  Entrar
                </Link>
                <Link className={textButtonClass} to="/cadastro/cliente">
                  Criar conta
                </Link>
                <Link className={primaryButtonClass} to="/cadastro/freelancer">
                  Virar freelancer
                </Link>
              </>
            )}
          </div>
        </div>

        {mobileOpen ? (
          <div className={mobilePanelClass}>
            <div className="container flex flex-col gap-3 py-3.5">
              {marketingLinks.map((item) => (
                item.kind === 'route' ? (
                  <Link
                    key={item.label}
                    className={mobileItemClass}
                    onClick={() => setMobileOpen(false)}
                    to={item.to}
                  >
                    {item.label}
                  </Link>
                ) : (
                  <button
                    key={item.label}
                    className={mobileItemClass}
                    onClick={() => {
                      openMarketingSection(item.sectionId);
                      setMobileOpen(false);
                    }}
                    type="button"
                  >
                    {item.label}
                  </button>
                )
              ))}

              {loading ? null : session ? (
                <>
                  {publicProfileRoute ? (
                    <Link
                      className={mobileItemClass}
                      onClick={() => setMobileOpen(false)}
                      to={publicProfileRoute}
                    >
                      Meu perfil público
                    </Link>
                  ) : null}
                  <Link
                    className={mobileItemClass}
                    onClick={() => setMobileOpen(false)}
                    to={dashboardRoute}
                  >
                    Dashboard
                  </Link>
                  {session.role === 'freelancer' ? (
                    <Link
                      className={mobileItemClass}
                      onClick={() => setMobileOpen(false)}
                      to="/assinatura"
                    >
                      Assinatura
                    </Link>
                  ) : null}
                  <button
                    className={mobileItemClass}
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
                    className={mobileItemClass}
                    onClick={() => setMobileOpen(false)}
                    to="/login"
                  >
                    Entrar
                  </Link>
                  <Link
                    className={mobileItemClass}
                    onClick={() => setMobileOpen(false)}
                    to="/cadastro/cliente"
                  >
                    Criar conta
                  </Link>
                  <Link
                    className={mobilePrimaryItemClass}
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

      <main className="pb-20 lg:pb-24">
        <Outlet />
      </main>

      <footer className="relative overflow-hidden border-t border-[#c7dbff] bg-[linear-gradient(180deg,#edf5ff_0%,#dce9ff_44%,#cadcff_100%)] text-slate-900">
        <div className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(15,79,216,0.52),transparent)]" />
        <div className="absolute -right-16 top-0 h-60 w-60 rounded-full bg-sky-300/18 blur-[110px]" />
        <div className="absolute left-1/3 top-16 h-40 w-40 rounded-full bg-white/20 blur-[90px]" />
        <div className="absolute -left-16 bottom-0 h-56 w-56 rounded-full bg-blue-600/14 blur-[100px]" />

        <div className="container relative py-14 sm:py-16">
          <div className="grid gap-8 rounded-[36px] border border-white/65 bg-[linear-gradient(180deg,rgba(255,255,255,0.78)_0%,rgba(248,251,255,0.6)_100%)] px-6 pb-10 pt-8 shadow-[0_34px_90px_rgba(15,79,216,0.12)] backdrop-blur-sm md:grid-cols-2 xl:grid-cols-[1.4fr_1fr_0.95fr_1fr]">
            <div className="space-y-5">
              <span className="inline-flex rounded-full border border-[#cfe0ff] bg-[#eaf2ff] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-[#0f4fd8]">
                Plataforma oficial
              </span>
              <div className="space-y-3">
                <p className="brand-wordmark text-[2rem] text-slate-950">
                  <span>Faço </span>
                  <span className="brand-wordmark-accent">Freela</span>
                </p>
                <p className="text-base font-medium text-slate-700">Site + sistema para freela</p>
                <p className="max-w-md text-sm leading-7 text-slate-600">
                  Mais clareza, organização e praticidade para o dia a dia do freela.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                Navegação
              </p>
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-1">
                {footerNavigationLinks.map((item) =>
                  item.kind === 'route' ? (
                    <Link
                      key={item.label}
                      className="inline-flex min-h-[44px] items-center rounded-2xl px-3 text-sm text-slate-600 transition hover:bg-white/85 hover:text-slate-950"
                      to={item.to}
                    >
                      {item.label}
                    </Link>
                  ) : (
                    <button
                      key={item.label}
                      className="inline-flex min-h-[44px] items-center rounded-2xl px-3 text-left text-sm text-slate-600 transition hover:bg-white/85 hover:text-slate-950"
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
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                Suporte institucional
              </p>
              <div className="rounded-[28px] border border-white/80 bg-white/92 p-5 shadow-[0_18px_48px_rgba(15,23,42,0.06)]">
                <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Canal oficial</p>
                <a
                  className="mt-3 inline-flex min-h-[44px] items-center break-words rounded-2xl px-2 text-base font-semibold text-slate-950 transition hover:bg-slate-50 hover:text-[#0f4fd8]"
                  href={institutionalSupportMailto}
                >
                  {institutionalEmail}
                </a>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Atendimento institucional para dúvidas, suporte e assuntos oficiais da marca.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600">
                Redes oficiais
              </p>
              <div className="space-y-3">
                <a
                  className="group flex items-start gap-4 rounded-[28px] border border-white/80 bg-white/92 p-4 transition hover:border-[#0f4fd8]/20 hover:bg-white"
                  href={institutionalInstagramUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#cfe0ff] bg-[#eaf2ff] text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0f4fd8]">
                    IG
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-950">Instagram</span>
                    <span className="mt-1 block text-sm text-slate-600 transition group-hover:text-[#0f4fd8]">
                      {institutionalInstagramHandle}
                    </span>
                  </span>
                </a>

                <a
                  className="group flex items-start gap-4 rounded-[28px] border border-white/80 bg-white/92 p-4 transition hover:border-[#0f4fd8]/20 hover:bg-white"
                  href={institutionalLinkedinUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  <span className="flex h-11 w-11 items-center justify-center rounded-full border border-[#cfe0ff] bg-[#eaf2ff] text-[11px] font-semibold uppercase tracking-[0.18em] text-[#0f4fd8]">
                    in
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold text-slate-950">Faço Freela</span>
                    <span className="mt-1 block text-sm text-slate-600 transition group-hover:text-[#0f4fd8]">
                      {institutionalLinkedinLabel}
                    </span>
                  </span>
                </a>
              </div>
            </div>
          </div>

          <div className="mt-6 flex flex-col gap-4 rounded-[28px] border border-[#c7dbff] bg-[linear-gradient(180deg,rgba(238,244,255,0.92)_0%,rgba(225,236,255,0.92)_100%)] px-5 py-4 text-sm text-slate-600 shadow-[0_20px_48px_rgba(15,79,216,0.08)] md:flex-row md:items-center md:justify-between">
            <p>© 2026 Faço Freela. Todos os direitos reservados.</p>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <Link className="inline-flex min-h-[44px] items-center rounded-2xl px-2 transition hover:bg-white/80 hover:text-slate-950" to="/info/privacidade">
                Política de Privacidade
              </Link>
              <Link className="inline-flex min-h-[44px] items-center rounded-2xl px-2 transition hover:bg-white/80 hover:text-slate-950" to="/info/termos">
                Termos de Uso
              </Link>
            </div>
          </div>
        </div>
      </footer>

    </div>
  );
}
