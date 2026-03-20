import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import type {
  ClientDashboard,
  ClientProfile,
  ContactThreadMessage,
  ContactMessage,
  Freelancer,
  FreelancerPlanTier,
  FreelancerDashboard,
  PortfolioItem,
  SessionUser,
  SubscriptionPlan,
  UserRole,
} from '../../shared/contracts.js';
import { freelancerPlanCatalog, getFreelancerPlanPrice } from '../../shared/contracts.js';
import {
  createPasswordHash,
  createSessionExpiry,
  createSessionToken,
  isSessionExpired,
} from './auth.js';

export interface StoredFreelancer {
  // Local freelancer shadow only.
  // It is not the source of identity after Block 1.
  // It survives temporarily for operational/showcase fields not present in Supabase yet.
  email: string;
  hasCnpj: boolean;
  passwordHash: string;
  phone: string;
  profile: Freelancer;
  subscription: SubscriptionPlan;
  metrics: FreelancerDashboard['metrics'];
}

export interface StoredClient {
  // Local client compatibility shadow only.
  // It exists only for accounts that cannot finish subtype persistence at sign-up time.
  profile: ClientProfile;
  passwordHash: string;
}

export interface StoredSession {
  // HTTP-only app session kept locally for now.
  // This is operational state, not user identity source of truth.
  token: string;
  userId: string;
  role: UserRole;
  expiresAt: string;
}

export interface AppStore {
  // Local shadows for user compatibility and showcase residue.
  freelancers: StoredFreelancer[];
  // Local client compatibility shadows.
  clients: StoredClient[];
  // Operational contact persistence. This remains local until a later persistence block.
  contacts: ContactMessage[];
  // Operational HTTP-only sessions. This remains local until a later session block.
  sessions: StoredSession[];
}

const DATA_DIR = resolve(process.cwd(), 'server', 'data');
const STORE_FILE = resolve(DATA_DIR, 'store.json');

function basePortfolio(url: string): PortfolioItem[] {
  return [
    {
      title: 'Projeto em destaque',
      description: 'Estudo de caso com foco em resultado mensurável e apresentação profissional.',
      url,
    },
    {
      title: 'Portfólio completo',
      description: 'Coleção de trabalhos recentes com contexto, processo e resultados.',
      url,
    },
  ];
}

function createSubscriptionPlan(
  tier: FreelancerPlanTier,
  hasCnpj = false,
  overrides?: Partial<Omit<SubscriptionPlan, 'tier' | 'name' | 'priceMonthly'>>,
): SubscriptionPlan {
  const plan = freelancerPlanCatalog[tier];

  return {
    tier,
    name: plan.name,
    priceMonthly: getFreelancerPlanPrice(tier, hasCnpj),
    status: overrides?.status ?? 'active',
    startedAt: overrides?.startedAt ?? new Date().toISOString(),
    endsAt:
      overrides?.endsAt ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function inferSubscriptionTier(subscription: Partial<SubscriptionPlan>): FreelancerPlanTier {
  if (
    subscription.tier === 'booster' ||
    subscription.name?.toLowerCase().includes('booster') ||
    Number(subscription.priceMonthly) > freelancerPlanCatalog.normal.priceMonthly
  ) {
    return 'booster';
  }

  return 'normal';
}

function normalizeSubscriptionPlan(
  subscription: Partial<SubscriptionPlan>,
  hasCnpj = false,
): SubscriptionPlan {
  const tier = inferSubscriptionTier(subscription);

  return createSubscriptionPlan(tier, hasCnpj, {
    status: subscription.status,
    startedAt: subscription.startedAt,
    endsAt: subscription.endsAt,
  });
}

function createSeedContact(input: Omit<ContactMessage, 'messages'>): ContactMessage {
  return {
    ...input,
    messages: [
      {
        id: `${input.id}-message-1`,
        senderRole: 'client',
        senderName: input.clientName,
        body: input.message,
        createdAt: input.createdAt,
      },
    ],
  };
}

function normalizeContactChannel(channel: unknown): ContactMessage['channel'] {
  return channel === 'Plataforma' ? 'Plataforma' : 'E-mail';
}

function createInitialContactMessage(contact: Partial<ContactMessage>): ContactThreadMessage {
  return {
    id: `${contact.id ?? `contact-${Date.now()}`}-message-1`,
    senderRole: 'client',
    senderName: contact.clientName ?? 'Cliente',
    body: contact.message ?? '',
    createdAt: contact.createdAt ?? new Date().toISOString(),
  };
}

function normalizeThreadMessages(contact: Partial<ContactMessage>): ContactThreadMessage[] {
  if (!Array.isArray(contact.messages) || contact.messages.length === 0) {
    return [createInitialContactMessage(contact)];
  }

  return contact.messages.map((message, index) => ({
    id: message?.id ?? `${contact.id ?? 'contact'}-message-${index + 1}`,
    senderRole: message?.senderRole === 'freelancer' ? 'freelancer' : 'client',
    senderName:
      message?.senderName ??
      (message?.senderRole === 'freelancer' ? contact.freelancerName : contact.clientName) ??
      'Usuário',
    body: message?.body ?? '',
    createdAt: message?.createdAt ?? contact.createdAt ?? new Date().toISOString(),
  }));
}

function findStoredFreelancerByContact(
  store: AppStore,
  contact: Partial<ContactMessage>,
): StoredFreelancer | undefined {
  return (
    store.freelancers.find((freelancer) => freelancer.profile.id === contact.freelancerId) ??
    store.freelancers.find(
      (freelancer) =>
        Boolean(contact.freelancerEmail) &&
        freelancer.email.toLowerCase() === contact.freelancerEmail?.toLowerCase(),
    ) ??
    store.freelancers.find(
      (freelancer) =>
        Boolean(contact.freelancerName) && freelancer.profile.name === contact.freelancerName,
    )
  );
}

function normalizeContactRecord(store: AppStore, rawContact: ContactMessage): ContactMessage {
  const matchedClient =
    store.clients.find((client) => client.profile.id === rawContact.clientId) ??
    store.clients.find((client) => client.profile.email === rawContact.clientEmail) ??
    store.clients.find(
      (client) =>
        client.profile.name === rawContact.clientName &&
        client.profile.location === rawContact.clientLocation,
    );
  const matchedFreelancer = findStoredFreelancerByContact(store, rawContact);
  const messages = normalizeThreadMessages(rawContact);
  const latestMessage = messages[messages.length - 1];

  return {
    ...rawContact,
    freelancerName: rawContact.freelancerName || matchedFreelancer?.profile.name || 'Freelancer',
    freelancerEmail: rawContact.freelancerEmail ?? matchedFreelancer?.email,
    clientId: rawContact.clientId ?? matchedClient?.profile.id,
    clientName: rawContact.clientName || matchedClient?.profile.name || 'Cliente',
    clientLocation: rawContact.clientLocation || matchedClient?.profile.location || '',
    clientEmail: rawContact.clientEmail ?? matchedClient?.profile.email,
    clientPhone: rawContact.clientPhone ?? matchedClient?.profile.phone,
    channel: normalizeContactChannel(rawContact.channel),
    message: latestMessage.body,
    messages,
  };
}

function hydrateContact(store: AppStore, contact: ContactMessage): ContactMessage {
  return normalizeContactRecord(store, contact);
}

function createSeedStore(): AppStore {
  return {
    freelancers: [
      {
        email: 'aline@facofreela.com',
        hasCnpj: false,
        passwordHash: createPasswordHash('123456'),
        phone: '(11) 99999-1111',
        profile: {
          id: 'freelancer-1',
          slug: 'aline-rocha-ux-designer',
          name: 'Aline Rocha',
          profession: 'UX/UI Designer',
          category: 'Design',
          summary: 'Design de produtos digitais com foco em conversão, clareza e experiência do usuário.',
          description:
            'Ajudo startups e negócios digitais a transformar processos confusos em experiências intuitivas. Atuo com discovery, interface, design system e protótipos navegáveis para produtos web e mobile.',
          location: 'São Paulo, SP',
          experienceLevel: 'Sênior',
          yearsExperience: 8,
          averagePrice: 1800,
          skills: ['Figma', 'Design System', 'UX Research', 'Prototipagem'],
          portfolio: basePortfolio('https://www.behance.net/'),
          avatarUrl:
            'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80',
          bannerUrl:
            'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80',
          linkedinUrl: 'https://www.linkedin.com/',
          websiteUrl: 'https://dribbble.com/',
          whatsapp: '5511999991111',
          verified: true,
          availability: 'Aceitando novos projetos para abril.',
          memberSince: '2024-04-18',
        },
        subscription: createSubscriptionPlan('normal', false, {
          status: 'active',
          startedAt: '2026-02-10',
          endsAt: '2026-03-10',
        }),
        metrics: {
          profileViews: 842,
          contactClicks: 118,
          messagesReceived: 17,
        },
      },
      {
        email: 'bruno@facofreela.com',
        hasCnpj: true,
        passwordHash: createPasswordHash('123456'),
        phone: '(21) 98888-2222',
        profile: {
          id: 'freelancer-2',
          slug: 'bruno-silva-desenvolvedor-full-stack',
          name: 'Bruno Silva',
          profession: 'Desenvolvedor Full Stack',
          category: 'Programação',
          summary: 'Construo aplicações web escaláveis com foco em performance, produto e deploy contínuo.',
          description:
            'Desenvolvedor com experiência em React, Node.js, APIs REST e arquitetura para produtos digitais. Trabalho em MVPs, painéis administrativos, integrações e manutenção evolutiva.',
          location: 'Rio de Janeiro, RJ',
          experienceLevel: 'Sênior',
          yearsExperience: 10,
          averagePrice: 2400,
          skills: ['React', 'TypeScript', 'Node.js', 'PostgreSQL'],
          portfolio: basePortfolio('https://github.com/'),
          avatarUrl:
            'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=400&q=80',
          bannerUrl:
            'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1600&q=80',
          linkedinUrl: 'https://www.linkedin.com/',
          websiteUrl: 'https://github.com/',
          whatsapp: '5521988882222',
          verified: true,
          availability: 'Disponível para squads de produto e entregas sob escopo fechado.',
          memberSince: '2023-11-02',
        },
        subscription: createSubscriptionPlan('booster', true, {
          status: 'active',
          startedAt: '2026-02-26',
          endsAt: '2026-03-26',
        }),
        metrics: {
          profileViews: 1246,
          contactClicks: 204,
          messagesReceived: 29,
        },
      },
      {
        email: 'camila@facofreela.com',
        hasCnpj: true,
        passwordHash: createPasswordHash('123456'),
        phone: '(31) 97777-3333',
        profile: {
          id: 'freelancer-3',
          slug: 'camila-souza-estrategista-de-marketing',
          name: 'Camila Souza',
          profession: 'Estrategista de Marketing Digital',
          category: 'Marketing Digital',
          summary: 'Planejamento, mídia e funil de aquisição para negócios que precisam crescer com previsibilidade.',
          description:
            'Atuo com diagnóstico de aquisição, campanhas de performance, estruturação de CRM e copy para landing pages. Meu foco é transformar tráfego em receita com clareza de métricas.',
          location: 'Belo Horizonte, MG',
          experienceLevel: 'Pleno',
          yearsExperience: 6,
          averagePrice: 1500,
          skills: ['Meta Ads', 'Google Ads', 'CRM', 'Copywriting'],
          portfolio: basePortfolio('https://www.notion.so/'),
          avatarUrl:
            'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=400&q=80',
          bannerUrl:
            'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&w=1600&q=80',
          linkedinUrl: 'https://www.linkedin.com/',
          websiteUrl: 'https://www.notion.so/',
          whatsapp: '5531977773333',
          verified: true,
          availability: 'Atendo lançamentos, e-commerce e negócios locais.',
          memberSince: '2025-01-14',
        },
        subscription: createSubscriptionPlan('booster', true, {
          status: 'active',
          startedAt: '2026-02-15',
          endsAt: '2026-03-15',
        }),
        metrics: {
          profileViews: 692,
          contactClicks: 86,
          messagesReceived: 13,
        },
      },
      {
        email: 'diego@facofreela.com',
        hasCnpj: false,
        passwordHash: createPasswordHash('123456'),
        phone: '(81) 96666-4444',
        profile: {
          id: 'freelancer-4',
          slug: 'diego-alves-editor-de-video',
          name: 'Diego Alves',
          profession: 'Editor de Vídeo',
          category: 'Edição de Vídeo',
          summary: 'Edição comercial para lançamentos, social media e vídeos institucionais com ritmo e clareza.',
          description:
            'Produzo vídeos orientados a resultado, com cortes estratégicos, motion leve e adaptação para múltiplos formatos. Trabalho com creators, infoprodutos e marcas em expansão.',
          location: 'Recife, PE',
          experienceLevel: 'Pleno',
          yearsExperience: 5,
          averagePrice: 1200,
          skills: ['Premiere', 'After Effects', 'CapCut', 'Storytelling'],
          portfolio: basePortfolio('https://vimeo.com/'),
          avatarUrl:
            'https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=400&q=80',
          bannerUrl:
            'https://images.unsplash.com/photo-1478720568477-152d9b164e26?auto=format&fit=crop&w=1600&q=80',
          linkedinUrl: 'https://www.linkedin.com/',
          websiteUrl: 'https://vimeo.com/',
          whatsapp: '5581966664444',
          verified: false,
          availability: 'Agenda com encaixe para pacotes recorrentes.',
          memberSince: '2025-06-08',
        },
        subscription: createSubscriptionPlan('normal', false, {
          status: 'active',
          startedAt: '2026-02-28',
          endsAt: '2026-03-28',
        }),
        metrics: {
          profileViews: 514,
          contactClicks: 55,
          messagesReceived: 9,
        },
      },
      {
        email: 'elis@facofreela.com',
        hasCnpj: true,
        passwordHash: createPasswordHash('123456'),
        phone: '(41) 95555-5555',
        profile: {
          id: 'freelancer-5',
          slug: 'elis-pereira-redatora-seo',
          name: 'Elis Pereira',
          profession: 'Redatora SEO',
          category: 'Redação',
          summary: 'Conteúdo que posiciona no Google e melhora a conversão da jornada comercial.',
          description:
            'Crio artigos, páginas estratégicas e materiais ricos com pesquisa de intenção de busca, arquitetura de conteúdo e linguagem adaptada ao público. Também reviso textos de vendas.',
          location: 'Curitiba, PR',
          experienceLevel: 'Pleno',
          yearsExperience: 7,
          averagePrice: 950,
          skills: ['SEO', 'Conteúdo', 'Pesquisa de Palavra-chave', 'Ghostwriting'],
          portfolio: basePortfolio('https://medium.com/'),
          avatarUrl:
            'https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=400&q=80',
          bannerUrl:
            'https://images.unsplash.com/photo-1521737604893-d14cc237f11d?auto=format&fit=crop&w=1600&q=80',
          linkedinUrl: 'https://www.linkedin.com/',
          websiteUrl: 'https://medium.com/',
          whatsapp: '5541955555555',
          verified: true,
          availability: 'Recebo demandas avulsas e calendários mensais.',
          memberSince: '2024-09-03',
        },
        subscription: createSubscriptionPlan('normal', true, {
          status: 'active',
          startedAt: '2026-02-18',
          endsAt: '2026-03-18',
        }),
        metrics: {
          profileViews: 477,
          contactClicks: 61,
          messagesReceived: 11,
        },
      },
      {
        email: 'fabio@facofreela.com',
        hasCnpj: true,
        passwordHash: createPasswordHash('123456'),
        phone: '(51) 94444-6666',
        profile: {
          id: 'freelancer-6',
          slug: 'fabio-lima-consultor-de-operacoes',
          name: 'Fábio Lima',
          profession: 'Consultor de Operações',
          category: 'Consultoria',
          summary: 'Organização de processos, indicadores e operação para empresas em fase de crescimento.',
          description:
            'Atuo com diagnóstico de gargalos, padronização operacional, construção de rituais de gestão e acompanhamento de indicadores para pequenos e médios negócios.',
          location: 'Porto Alegre, RS',
          experienceLevel: 'Sênior',
          yearsExperience: 12,
          averagePrice: 2800,
          skills: ['Processos', 'KPIs', 'Gestão', 'Planejamento'],
          portfolio: basePortfolio('https://www.notion.so/'),
          avatarUrl:
            'https://images.unsplash.com/photo-1504593811423-6dd665756598?auto=format&fit=crop&w=400&q=80',
          bannerUrl:
            'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1600&q=80',
          linkedinUrl: 'https://www.linkedin.com/',
          websiteUrl: 'https://www.notion.so/',
          whatsapp: '5551944446666',
          verified: true,
          availability: 'Atendimento por diagnóstico e implantação.',
          memberSince: '2023-06-21',
        },
        subscription: createSubscriptionPlan('normal', true, {
          status: 'expired',
          startedAt: '2026-01-01',
          endsAt: '2026-02-01',
        }),
        metrics: {
          profileViews: 301,
          contactClicks: 22,
          messagesReceived: 5,
        },
      },
    ],
    clients: [
      {
        profile: {
          id: 'client-1',
          name: 'Marina Costa',
          email: 'marina@cliente.com',
          phone: '(11) 97777-0000',
          location: 'Campinas, SP',
          createdAt: '2026-02-14',
        },
        passwordHash: createPasswordHash('123456'),
      },
    ],
    contacts: [
      createSeedContact({
        id: 'contact-1',
        freelancerId: 'freelancer-1',
        freelancerName: 'Aline Rocha',
        freelancerEmail: 'aline@facofreela.com',
        clientId: 'client-1',
        clientName: 'Marina Costa',
        clientLocation: 'Campinas, SP',
        clientEmail: 'marina@cliente.com',
        clientPhone: '(11) 97777-0000',
        subject: 'Landing page para SaaS B2B',
        message: 'Gostaria de entender como você estrutura um redesign com foco em conversão.',
        channel: 'Plataforma',
        createdAt: '2026-03-07T14:15:00.000Z',
        status: 'Novo',
      }),
      createSeedContact({
        id: 'contact-2',
        freelancerId: 'freelancer-1',
        freelancerName: 'Aline Rocha',
        freelancerEmail: 'aline@facofreela.com',
        clientName: 'Henrique Vidal',
        clientLocation: 'São Paulo, SP',
        subject: 'Sistema interno para operação',
        message: 'Preciso desenhar uma experiência mais simples para o painel da equipe comercial.',
        channel: 'E-mail',
        createdAt: '2026-03-05T11:20:00.000Z',
        status: 'Respondido',
      }),
      createSeedContact({
        id: 'contact-3',
        freelancerId: 'freelancer-2',
        freelancerName: 'Bruno Silva',
        freelancerEmail: 'bruno@facofreela.com',
        clientId: 'client-1',
        clientName: 'Marina Costa',
        clientLocation: 'Campinas, SP',
        clientEmail: 'marina@cliente.com',
        clientPhone: '(11) 97777-0000',
        subject: 'MVP em React e API',
        message: 'Procuro alguém para estruturar a primeira versão da nossa plataforma web.',
        channel: 'Plataforma',
        createdAt: '2026-03-02T09:00:00.000Z',
        status: 'Novo',
      }),
    ],
    sessions: [],
  };
}

function ensureStoreFile() {
  mkdirSync(DATA_DIR, { recursive: true });

  if (!existsSync(STORE_FILE)) {
    writeStore(createSeedStore());
  }
}

function removeExpiredSessions(store: AppStore): boolean {
  const nextSessions = store.sessions.filter((session) => !isSessionExpired(session.expiresAt));

  if (nextSessions.length === store.sessions.length) {
    return false;
  }

  store.sessions = nextSessions;
  return true;
}

function normalizeStore(store: AppStore): boolean {
  let changed = removeExpiredSessions(store);
  const normalizedFreelancers = store.freelancers.map((freelancer) => ({
    ...freelancer,
    hasCnpj: freelancer.hasCnpj === true,
    subscription: normalizeSubscriptionPlan(freelancer.subscription, freelancer.hasCnpj === true),
  }));
  const normalizedContacts = store.contacts.map((contact) => normalizeContactRecord(store, contact));

  if (JSON.stringify(normalizedFreelancers) !== JSON.stringify(store.freelancers)) {
    store.freelancers = normalizedFreelancers;
    changed = true;
  }

  if (JSON.stringify(normalizedContacts) !== JSON.stringify(store.contacts)) {
    store.contacts = normalizedContacts;
    changed = true;
  }

  return changed;
}

function readStore(): AppStore {
  ensureStoreFile();

  const store = JSON.parse(readFileSync(STORE_FILE, 'utf8')) as AppStore;
  const changed = normalizeStore(store);

  if (changed) {
    writeStore(store);
  }

  return store;
}

function writeStore(store: AppStore) {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(STORE_FILE, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

function mutateStore<T>(mutate: (store: AppStore) => T): T {
  const store = readStore();
  const result = mutate(store);

  writeStore(store);

  return result;
}

function nextId(prefix: string, ids: string[]): string {
  const maxId = ids.reduce((currentMax, id) => {
    const suffix = Number(id.replace(`${prefix}-`, ''));

    return Number.isInteger(suffix) ? Math.max(currentMax, suffix) : currentMax;
  }, 0);

  return `${prefix}-${maxId + 1}`;
}

export function getNextClientId(): string {
  const store = readStore();

  return nextId(
    'client',
    store.clients.map((client) => client.profile.id),
  );
}

export function getNextFreelancerId(): string {
  const store = readStore();

  return nextId(
    'freelancer',
    store.freelancers.map((freelancer) => freelancer.profile.id),
  );
}

export function ensureUniqueFreelancerSlug(baseSlug: string): string {
  const store = readStore();
  let nextSlug = baseSlug;
  let suffix = 2;

  while (store.freelancers.some((freelancer) => freelancer.profile.slug === nextSlug)) {
    nextSlug = `${baseSlug}-${suffix}`;
    suffix += 1;
  }

  return nextSlug;
}

export function listPublicFreelancers(): Freelancer[] {
  const store = readStore();

  // Compatibility-only public fallback for freelancer showcase cards.
  // Canonical user identity is already in Supabase; this remains only while
  // showcase/operational freelancer fields are still local.
  return store.freelancers
    .filter((item) => item.subscription.status === 'active')
    .sort((left, right) => {
      const leftRank = left.subscription.tier === 'booster' ? 0 : 1;
      const rightRank = right.subscription.tier === 'booster' ? 0 : 1;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.profile.name.localeCompare(right.profile.name, 'pt-BR');
    })
    .map((item) => ({
      ...item.profile,
      subscriptionTier: item.subscription.tier,
    }));
}

export function findFreelancerRecordById(id: string): StoredFreelancer | undefined {
  const store = readStore();

  return store.freelancers.find((item) => item.profile.id === id);
}

export function findFreelancerRecordByEmail(email: string): StoredFreelancer | undefined {
  const store = readStore();
  const normalizedEmail = email.trim().toLowerCase();

  return store.freelancers.find((item) => item.email.toLowerCase() === normalizedEmail);
}

export function findClientRecordById(id: string): StoredClient | undefined {
  const store = readStore();

  return store.clients.find((item) => item.profile.id === id);
}

export function findClientRecordByEmail(email: string): StoredClient | undefined {
  const store = readStore();
  const normalizedEmail = email.trim().toLowerCase();

  return store.clients.find((item) => item.profile.email.toLowerCase() === normalizedEmail);
}

export function findContactById(id: string): ContactMessage | undefined {
  const store = readStore();
  const contact = store.contacts.find((item) => item.id === id);

  return contact ? hydrateContact(store, contact) : undefined;
}

export function findSessionUserByEmail(
  email: string,
): (SessionUser & {
  passwordHash: string;
}) | undefined {
  // Compatibility-only password lookup for local shadows.
  // Triggered only when a user still exists locally but is not fully materialized
  // in Supabase auth/profile flow.
  const store = readStore();
  const normalizedEmail = email.trim().toLowerCase();

  const freelancer = store.freelancers.find((item) => item.email.toLowerCase() === normalizedEmail);
  if (freelancer) {
    return {
      id: freelancer.profile.id,
      name: freelancer.profile.name,
      role: 'freelancer',
      passwordHash: freelancer.passwordHash,
    };
  }

  const client = store.clients.find((item) => item.profile.email.toLowerCase() === normalizedEmail);
  if (client) {
    return {
      id: client.profile.id,
      name: client.profile.name,
      role: 'client',
      passwordHash: client.passwordHash,
    };
  }

  return undefined;
}

export function createSession(input: { userId: string; role: UserRole }): StoredSession {
  // Local app session store. This is operational state, not user identity.
  return mutateStore((store) => {
    const session: StoredSession = {
      token: createSessionToken(),
      userId: input.userId,
      role: input.role,
      expiresAt: createSessionExpiry(),
    };

    store.sessions.unshift(session);

    return session;
  });
}

export function findSession(token: string): StoredSession | undefined {
  const store = readStore();

  return store.sessions.find((session) => session.token === token);
}

export function deleteSession(token: string) {
  mutateStore((store) => {
    store.sessions = store.sessions.filter((session) => session.token !== token);
  });
}

export function deleteSessionsByUserId(userId: string) {
  mutateStore((store) => {
    store.sessions = store.sessions.filter((session) => session.userId !== userId);
  });
}

export function addClient(input: StoredClient): ClientProfile {
  // Writes a client compatibility shadow only. Not canonical user persistence.
  return mutateStore((store) => {
    store.clients.unshift(input);

    return input.profile;
  });
}

export function removeClientShadow(input: { id?: string; email?: string }) {
  const normalizedEmail = input.email?.trim().toLowerCase();

  mutateStore((store) => {
    store.clients = store.clients.filter((client) => {
      if (input.id && client.profile.id === input.id) {
        return false;
      }

      if (normalizedEmail && client.profile.email.toLowerCase() === normalizedEmail) {
        return false;
      }

      return true;
    });
  });
}

export function addFreelancer(input: StoredFreelancer): Freelancer {
  // Writes a freelancer operational/showcase shadow only. Not canonical user persistence.
  return mutateStore((store) => {
    store.freelancers.unshift(input);

    return input.profile;
  });
}

export function removeFreelancerShadow(input: { id?: string; email?: string }) {
  const normalizedEmail = input.email?.trim().toLowerCase();

  mutateStore((store) => {
    store.freelancers = store.freelancers.filter((freelancer) => {
      if (input.id && freelancer.profile.id === input.id) {
        return false;
      }

      if (normalizedEmail && freelancer.email.toLowerCase() === normalizedEmail) {
        return false;
      }

      return true;
    });
  });
}

export function addContact(input: ContactMessage): ContactMessage {
  return mutateStore((store) => {
    const normalizedContact = normalizeContactRecord(store, input);

    store.contacts.unshift(normalizedContact);

    const freelancer = findStoredFreelancerByContact(store, normalizedContact);
    if (freelancer) {
      freelancer.metrics.contactClicks += 1;
      freelancer.metrics.messagesReceived += 1;
    }

    return normalizedContact;
  });
}

export function appendContactMessage(input: {
  contactId: string;
  senderRole: 'client' | 'freelancer';
  senderName: string;
  message: string;
}): ContactMessage | undefined {
  return mutateStore((store) => {
    const currentIndex = store.contacts.findIndex((item) => item.id === input.contactId);
    const contact = currentIndex >= 0 ? store.contacts[currentIndex] : undefined;

    if (!contact) {
      return undefined;
    }

    const createdAt = new Date().toISOString();
    const nextMessage: ContactThreadMessage = {
      id: `${contact.id}-message-${contact.messages.length + 1}`,
      senderRole: input.senderRole,
      senderName: input.senderName,
      body: input.message,
      createdAt,
    };

    contact.messages.push(nextMessage);
    contact.message = input.message;
    contact.status = input.senderRole === 'freelancer' ? 'Respondido' : 'Novo';

    if (input.senderRole === 'client') {
      const freelancer = findStoredFreelancerByContact(store, contact);

      if (freelancer) {
        freelancer.metrics.messagesReceived += 1;
      }
    }

    if (currentIndex > 0) {
      store.contacts.splice(currentIndex, 1);
      store.contacts.unshift(contact);
    }

    return hydrateContact(store, contact);
  });
}

export function listContactsByFreelancerIdentity(input: {
  freelancerId?: string;
  freelancerEmail?: string;
  freelancerName?: string;
}): ContactMessage[] {
  // Contact persistence is still local in this phase.
  const store = readStore();

  return store.contacts
    .filter((contact) => {
      if (input.freelancerId && contact.freelancerId === input.freelancerId) {
        return true;
      }

      if (
        input.freelancerEmail &&
        contact.freelancerEmail?.toLowerCase() === input.freelancerEmail.toLowerCase()
      ) {
        return true;
      }

      if (input.freelancerName && contact.freelancerName === input.freelancerName) {
        return true;
      }

      return false;
    })
    .map((contact) => hydrateContact(store, contact));
}

export function listContactsByClientIdentity(input: {
  clientId?: string;
  clientEmail?: string;
  clientName?: string;
}): ContactMessage[] {
  // Contact persistence is still local in this phase.
  const store = readStore();

  return store.contacts
    .filter((contact) => {
      if (input.clientId && contact.clientId === input.clientId) {
        return true;
      }

      if (input.clientEmail && contact.clientEmail?.toLowerCase() === input.clientEmail.toLowerCase()) {
        return true;
      }

      if (input.clientName && contact.clientName === input.clientName) {
        return true;
      }

      return false;
    })
    .map((contact) => hydrateContact(store, contact));
}

export function recordFreelancerProfileViewByIdentity(input: {
  freelancerId?: string;
  freelancerEmail?: string;
  freelancerSlug?: string;
}): boolean {
  // Operational metric fallback for public profile views while freelancer metrics
  // still live in the local operational shadow.
  return mutateStore((store) => {
    const freelancer =
      store.freelancers.find((item) => item.profile.id === input.freelancerId) ??
      store.freelancers.find(
        (item) =>
          Boolean(input.freelancerEmail) &&
          item.email.toLowerCase() === input.freelancerEmail?.toLowerCase(),
      ) ??
      store.freelancers.find((item) => item.profile.slug === input.freelancerSlug);

    if (!freelancer) {
      return false;
    }

    freelancer.metrics.profileViews += 1;
    return true;
  });
}

export function getFreelancerDashboard(id: string): FreelancerDashboard | undefined {
  // Deprecated transition helper.
  // Current Block 1 flow no longer uses this function; dashboard assembly is now
  // centralized in user-store.ts using Supabase identity plus local operational residue.
  const store = readStore();
  const freelancer = store.freelancers.find((item) => item.profile.id === id);

  if (!freelancer) {
    return undefined;
  }

  return {
    profile: freelancer.profile,
    subscription: freelancer.subscription,
    metrics: freelancer.metrics,
    recentContacts: store.contacts
      .filter((contact) => contact.freelancerId === id)
      .slice(0, 5)
      .map((contact) => hydrateContact(store, contact)),
    account: {
      email: freelancer.email,
      phone: freelancer.phone,
      hasCnpj: freelancer.hasCnpj,
    },
  };
}

export function getClientDashboard(id: string): ClientDashboard | undefined {
  // Deprecated transition helper.
  // Current Block 1 flow no longer uses this function; dashboard assembly is now
  // centralized in user-store.ts using Supabase identity plus local operational residue.
  const store = readStore();
  const client = store.clients.find((item) => item.profile.id === id);

  if (!client) {
    return undefined;
  }

  return {
    profile: client.profile,
    favorites: store.freelancers
      .filter((item) => item.subscription.status === 'active')
      .slice(0, 3)
      .map((item) => item.profile),
    recentContacts: store.contacts
      .filter(
        (contact) =>
          contact.clientId === client.profile.id ||
          contact.clientEmail === client.profile.email ||
          contact.clientName === client.profile.name,
      )
      .slice(0, 5)
      .map((contact) => hydrateContact(store, contact)),
    notifications: [
      'Seu contato com Bruno Silva foi entregue com sucesso.',
      'Novos freelancers verificados entraram na categoria Programação.',
      'Você pode favoritar profissionais para comparar propostas depois.',
    ],
  };
}
