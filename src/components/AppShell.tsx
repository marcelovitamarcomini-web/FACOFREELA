import { useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';

import { useAppSession } from '../context/AppSessionContext';

const navLinks = [
  { to: '/', label: 'Início' },
  { to: '/freelancers', label: 'Buscar freelancers' },
  { to: '/cadastro/cliente', label: 'Conta de cliente' },
  { to: '/cadastro/freelancer', label: 'Tornar-se freelancer' },
];

export function AppShell() {
  const { session, clearSession, loading } = useAppSession();
  const [mobileOpen, setMobileOpen] = useState(false);

  const dashboardRoute =
    session?.role === 'freelancer' ? '/dashboard/freelancer' : '/dashboard/cliente';

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-40 border-b border-white/40 bg-white/72 backdrop-blur-2xl">
        <div className="container flex items-center justify-between gap-4 py-4">
          <Link className="flex items-center gap-4" to="/">
            <span className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-cyan-400/20 bg-slate-950 shadow-soft">
              <img
                alt="Logo FacoFreela"
                className="h-12 w-12 object-contain"
                src="/logo-facofreela.svg"
              />
            </span>
            <div>
              <p className="text-lg font-extrabold text-slate-950">FacoFreela</p>
              <p className="font-mono text-[11px] uppercase tracking-[0.28em] text-cyan-700">
                Diretório // Motor de conexão
              </p>
            </div>
          </Link>

          <button
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 lg:hidden"
            onClick={() => setMobileOpen((current) => !current)}
            type="button"
          >
            Menu
          </button>

          <nav className="hidden items-center gap-3 lg:flex">
            {navLinks.map((item) => (
              <NavLink
                key={item.to}
                className={({ isActive }) =>
                  `rounded-full px-4 py-2 text-sm font-semibold transition ${
                    isActive
                      ? 'bg-slate-950 text-white'
                      : 'text-slate-600 hover:bg-white hover:text-slate-950'
                  }`
                }
                to={item.to}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="hidden items-center gap-3 lg:flex">
            {loading ? null : session ? (
              <>
                <Link
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                  to={dashboardRoute}
                >
                  {session.name.split(' ')[0]}
                </Link>
                <button
                  className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white"
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
                  className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-cyan-300 hover:text-cyan-700"
                  to="/login"
                >
                  Entrar
                </Link>
                <Link
                  className="rounded-full bg-slate-950 px-4 py-2 text-sm font-semibold text-white shadow-soft transition hover:bg-slate-800"
                  to="/cadastro/freelancer"
                >
                  Ativar perfil
                </Link>
              </>
            )}
          </div>
        </div>

        {mobileOpen ? (
          <div className="border-t border-white/50 bg-white/92 lg:hidden">
            <div className="container flex flex-col gap-3 py-4">
              {navLinks.map((item) => (
                <NavLink
                  key={item.to}
                  className="text-sm font-medium text-slate-700"
                  onClick={() => setMobileOpen(false)}
                  to={item.to}
                >
                  {item.label}
                </NavLink>
              ))}

              {loading ? null : session ? (
                <>
                  <Link
                    className="text-sm font-semibold text-cyan-700"
                    onClick={() => setMobileOpen(false)}
                    to={dashboardRoute}
                  >
                    Ir para o dashboard
                  </Link>
                  <button
                    className="text-left text-sm font-semibold text-slate-700"
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
                <Link
                  className="text-sm font-semibold text-cyan-700"
                  onClick={() => setMobileOpen(false)}
                  to="/login"
                >
                  Entrar
                </Link>
              )}
            </div>
          </div>
        ) : null}
      </header>

      <main className="pb-24">
        <Outlet />
      </main>

      <footer className="border-t border-slate-200/80 bg-white/88 backdrop-blur-xl">
        <div className="container grid gap-10 py-12 lg:grid-cols-[1.6fr_1fr_1fr]">
          <div className="space-y-4">
            <p className="text-lg font-bold text-slate-950">FacoFreela</p>
            <p className="max-w-xl text-sm leading-6 text-slate-600">
              Plataforma com busca indexável, sessão protegida, contatos registrados e interface
              pensada para descoberta rápida de profissionais.
            </p>
          </div>

          <div className="space-y-3">
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
              Plataforma
            </p>
            <Link className="block text-sm text-slate-600 hover:text-cyan-700" to="/info/sobre">
              Sobre a plataforma
            </Link>
            <Link className="block text-sm text-slate-600 hover:text-cyan-700" to="/freelancers">
              Buscar freelancers
            </Link>
            <Link
              className="block text-sm text-slate-600 hover:text-cyan-700"
              to="/cadastro/freelancer"
            >
              Tornar-se freelancer
            </Link>
          </div>

          <div className="space-y-3">
            <p className="font-mono text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">
              Institucional
            </p>
            <Link className="block text-sm text-slate-600 hover:text-cyan-700" to="/info/termos">
              Termos de uso
            </Link>
            <Link
              className="block text-sm text-slate-600 hover:text-cyan-700"
              to="/info/privacidade"
            >
              Política de privacidade
            </Link>
            <Link className="block text-sm text-slate-600 hover:text-cyan-700" to="/info/contato">
              Contato
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
