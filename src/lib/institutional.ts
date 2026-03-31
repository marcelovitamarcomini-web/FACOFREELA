export const institutionalEmail = 'suporte@facofreela.com.br';
export const institutionalSupportMailto = `mailto:${institutionalEmail}`;
export const passwordSupportMailto = `${institutionalSupportMailto}?subject=${encodeURIComponent(
  'Ajuda com acesso a conta',
)}`;

export const institutionalInstagramHandle = '@faco.freela';
export const institutionalInstagramUrl = 'https://www.instagram.com/faco.freela/';

export const institutionalLinkedinLabel = 'linkedin.com/company/facofreela';
export const institutionalLinkedinUrl = 'https://www.linkedin.com/company/facofreela/';

export type InstitutionalChannel = {
  id: 'email' | 'instagram' | 'linkedin';
  title: string;
  value: string;
  href: string;
  description: string;
  actionLabel: string;
};

export const institutionalChannels: InstitutionalChannel[] = [
  {
    id: 'email',
    title: 'E-mail institucional',
    value: institutionalEmail,
    href: institutionalSupportMailto,
    description: 'Canal oficial para suporte, d?vidas operacionais e contato institucional.',
    actionLabel: 'Enviar e-mail',
  },
  {
    id: 'instagram',
    title: 'Instagram oficial',
    value: institutionalInstagramHandle,
    href: institutionalInstagramUrl,
    description: 'Presen?a oficial da marca para atualiza??es, visibilidade e comunica??o p?blica.',
    actionLabel: 'Abrir Instagram',
  },
  {
    id: 'linkedin',
    title: 'LinkedIn da empresa',
    value: institutionalLinkedinLabel,
    href: institutionalLinkedinUrl,
    description: 'Canal institucional para marca, reputa??o e relacionamento profissional.',
    actionLabel: 'Abrir LinkedIn',
  },
];
