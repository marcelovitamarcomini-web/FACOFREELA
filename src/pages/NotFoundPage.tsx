import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <div className="container py-14">
      <div className="glass-panel rounded-[36px] p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">404</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-950">Página não encontrada</h1>
        <p className="mt-4 text-base leading-7 text-slate-600">
          O endereço solicitado não existe nesta versão da plataforma.
        </p>
        <Link className="mt-6 inline-flex rounded-full bg-brand-600 px-5 py-3 text-sm font-semibold text-white" to="/">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
