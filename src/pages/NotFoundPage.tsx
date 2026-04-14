import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="container py-10 sm:py-12 lg:py-14">
      <div className="mx-auto max-w-2xl">
        <div className="glass-panel rounded-[36px] p-5 shadow-soft sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">404</p>
          <h1 className="mt-4 text-[2.2rem] font-extrabold tracking-tight text-slate-950 sm:text-4xl">
            Página não encontrada
          </h1>
          <p className="mt-4 text-base leading-7 text-slate-600">
            O endereço solicitado não existe nesta versão da plataforma.
          </p>
          <Link
            className="mt-6 inline-flex min-h-[44px] items-center rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white"
            to="/"
          >
            Voltar ao início
          </Link>
        </div>
      </div>
    </div>
  );
}
