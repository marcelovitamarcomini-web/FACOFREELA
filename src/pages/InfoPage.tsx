import { Link, useParams } from 'react-router-dom';

const content: Record<string, { title: string; body: string[] }> = {
  sobre: {
    title: 'Sobre a plataforma',
    body: [
      'A FaçoFreela foi concebida para funcionar como um diretório profissional pesquisável, conectando clientes e freelancers de forma simples, profissional e acessível.',
      'O MVP prioriza páginas essenciais, perfis públicos com URL própria, busca refinável e dashboards para organizar contatos e visibilidade.',
    ],
  },
  termos: {
    title: 'Termos de uso',
    body: [
      'Este espaço apresenta a estrutura inicial de termos para o MVP. Em produção, recomenda-se publicação do texto jurídico definitivo com regras de assinatura, visibilidade de perfis e responsabilidades de cada tipo de usuário.',
      'Clientes acessam a busca gratuitamente, enquanto freelancers dependem de assinatura ativa para aparecer nos resultados públicos.',
    ],
  },
  privacidade: {
    title: 'Política de privacidade',
    body: [
      'A versão atual já separa dados públicos e dados sensíveis na API. Senhas são tratadas por hash no backend mock e entradas passam por validação com Zod.',
      'Em evolução futura, é indicado complementar com consentimento explícito, retenção de dados, logs de auditoria e política de cookies.',
    ],
  },
  contato: {
    title: 'Contato',
    body: [
      'Para o MVP, o contato principal do produto pode ser centralizado por e-mail institucional, formulário e canais sociais da marca.',
      'O próximo passo natural é integrar formulário real, notificações por e-mail e monitoramento de suporte ao cliente.',
    ],
  },
};

export function InfoPage() {
  const { slug } = useParams();
  const page = slug ? content[slug] : undefined;

  if (!page) {
    return (
      <div className="container py-14">
        <div className="glass-panel rounded-[32px] p-8 shadow-soft">
          <h1 className="text-3xl font-extrabold tracking-tight text-slate-950">Página não encontrada</h1>
          <p className="mt-4 text-sm leading-6 text-slate-600">
            O conteúdo institucional solicitado não existe nesta versão.
          </p>
          <Link className="mt-6 inline-flex text-sm font-semibold text-brand-600" to="/">
            Voltar para a página inicial
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container py-14">
      <article className="glass-panel rounded-[36px] p-8 shadow-soft">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-brand-600">Institucional</p>
        <h1 className="mt-4 text-4xl font-extrabold tracking-tight text-slate-950">{page.title}</h1>
        <div className="mt-8 space-y-5 text-base leading-8 text-slate-600">
          {page.body.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
        </div>
      </article>
    </div>
  );
}
