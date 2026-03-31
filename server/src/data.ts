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
  SubscriptionPlan,
  UserRole,
} from '../../shared/contracts.js';
import {
  freelancerPlanCatalog,
  getFreelancerPlanPrice,
  platformContactChannel,
} from '../../shared/contracts.js';
import {
  createSessionExpiry,
  createSessionToken,
  isSessionExpired,
} from './auth.js';

export interface StoredFreelancer {
  // Local freelancer residue only.
  // It is not used for cadastro or autenticação.
  // It survives temporarily for operational/showcase fields not present in Supabase yet.
  email: string;
  hasCnpj: boolean;
  phone: string;
  profile: Freelancer;
  subscription: SubscriptionPlan;
  metrics: FreelancerDashboard['metrics'];
}

export interface StoredClient {
  // Local client residue only.
  // It is no longer used for cadastro or autenticação.
  profile: ClientProfile;
}

export interface StoredSession {
  // HTTP-only app session kept locally for now.
  // This is operational state, not user identity source of truth.
  token: string;
  userId: string;
  role: UserRole;
  expiresAt: string;
  supabaseAccessToken?: string | null;
  supabaseRefreshToken?: string | null;
  supabaseAccessTokenExpiresAt?: string | null;
}

export interface AppStore {
  // Local freelancer residue for operational/showcase fields outside Supabase.
  freelancers: StoredFreelancer[];
  // Local client residue kept only while some operational flows still read it.
  clients: StoredClient[];
  // Operational contact persistence. This remains local until a later persistence block.
  contacts: ContactMessage[];
  // Operational HTTP-only sessions. This remains local until a later session block.
  sessions: StoredSession[];
}

const DATA_DIR = resolve(process.cwd(), 'server', 'data');
const STORE_FILE = resolve(DATA_DIR, 'store.json');
const supabaseUserIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
  void channel;
  return platformContactChannel;
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
    freelancers: [],
    clients: [],
    contacts: [],
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
  const normalizedSessions = store.sessions.filter((session) =>
    supabaseUserIdPattern.test(session.userId),
  );
  const normalizedFreelancers = store.freelancers
    .filter((freelancer) => supabaseUserIdPattern.test(freelancer.profile.id))
    .map((freelancer) => ({
      email: freelancer.email,
      hasCnpj: freelancer.hasCnpj === true,
      phone: freelancer.phone,
      profile: freelancer.profile,
      subscription: normalizeSubscriptionPlan(freelancer.subscription, freelancer.hasCnpj === true),
      metrics: freelancer.metrics,
    }));

  if (JSON.stringify(normalizedFreelancers) !== JSON.stringify(store.freelancers)) {
    store.freelancers = normalizedFreelancers;
    changed = true;
  }

  if (JSON.stringify(normalizedSessions) !== JSON.stringify(store.sessions)) {
    store.sessions = normalizedSessions;
    changed = true;
  }

  if (store.clients.length > 0) {
    store.clients = [];
    changed = true;
  }

  const normalizedContacts = store.contacts.map((contact) => normalizeContactRecord(store, contact));

  if (JSON.stringify(normalizedContacts) !== JSON.stringify(store.contacts)) {
    store.contacts = normalizedContacts;
    changed = true;
  }

  return changed;
}

function stripUtf8Bom(value: string): string {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function readStore(): AppStore {
  ensureStoreFile();

  const rawStore = readFileSync(STORE_FILE, 'utf8');
  const store = JSON.parse(stripUtf8Bom(rawStore)) as AppStore;
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

export function createSession(input: {
  userId: string;
  role: UserRole;
  supabaseAccessToken?: string | null;
  supabaseRefreshToken?: string | null;
  supabaseAccessTokenExpiresAt?: string | null;
}): StoredSession {
  // Local app session store. This is operational state, not user identity.
  return mutateStore((store) => {
    const session: StoredSession = {
      token: createSessionToken(),
      userId: input.userId,
      role: input.role,
      expiresAt: createSessionExpiry(),
      supabaseAccessToken: input.supabaseAccessToken ?? null,
      supabaseRefreshToken: input.supabaseRefreshToken ?? null,
      supabaseAccessTokenExpiresAt: input.supabaseAccessTokenExpiresAt ?? null,
    };

    store.sessions.unshift(session);

    return session;
  });
}

export function findSession(token: string): StoredSession | undefined {
  const store = readStore();

  return store.sessions.find((session) => session.token === token);
}

export function updateSessionAuthState(
  token: string,
  input: {
    supabaseAccessToken?: string | null;
    supabaseRefreshToken?: string | null;
    supabaseAccessTokenExpiresAt?: string | null;
  },
): StoredSession | undefined {
  return mutateStore((store) => {
    const session = store.sessions.find((item) => item.token === token);
    if (!session) {
      return undefined;
    }

    session.supabaseAccessToken = input.supabaseAccessToken ?? null;
    session.supabaseRefreshToken = input.supabaseRefreshToken ?? null;
    session.supabaseAccessTokenExpiresAt = input.supabaseAccessTokenExpiresAt ?? null;

    return session;
  });
}

export function deleteSession(token: string) {
  mutateStore((store) => {
    store.sessions = store.sessions.filter((session) => session.token !== token);
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

function matchesConversationParty(
  contact: ContactMessage,
  input: {
    freelancerId?: string;
    freelancerEmail?: string;
    clientId?: string;
    clientEmail?: string;
  },
) {
  const sameFreelancer =
    (input.freelancerId && contact.freelancerId === input.freelancerId) ||
    (input.freelancerEmail &&
      contact.freelancerEmail?.toLowerCase() === input.freelancerEmail.toLowerCase());
  const sameClient =
    (input.clientId && contact.clientId === input.clientId) ||
    (input.clientEmail && contact.clientEmail?.toLowerCase() === input.clientEmail.toLowerCase());

  return Boolean(sameFreelancer && sameClient);
}

export function findConversationBetweenParties(input: {
  freelancerId?: string;
  freelancerEmail?: string;
  clientId?: string;
  clientEmail?: string;
}): ContactMessage | undefined {
  const store = readStore();
  const contact = store.contacts.find((item) => matchesConversationParty(item, input));

  return contact ? hydrateContact(store, contact) : undefined;
}

export function createOrContinueContact(input: Omit<ContactMessage, 'id' | 'createdAt' | 'messages'>): {
  contact: ContactMessage;
  created: boolean;
} {
  return mutateStore((store) => {
    const currentIndex = store.contacts.findIndex((item) =>
      matchesConversationParty(item, {
        freelancerId: input.freelancerId,
        freelancerEmail: input.freelancerEmail,
        clientId: input.clientId,
        clientEmail: input.clientEmail,
      }),
    );

    if (currentIndex >= 0) {
      const contact = store.contacts[currentIndex];
      const createdAt = new Date().toISOString();
      const nextMessage: ContactThreadMessage = {
        id: `${contact.id}-message-${contact.messages.length + 1}`,
        senderRole: 'client',
        senderName: input.clientName,
        body: input.message,
        createdAt,
      };

      contact.freelancerId = input.freelancerId;
      contact.freelancerName = input.freelancerName;
      contact.freelancerEmail = input.freelancerEmail;
      contact.clientId = input.clientId;
      contact.clientName = input.clientName;
      contact.clientLocation = input.clientLocation;
      contact.clientEmail = input.clientEmail;
      contact.clientPhone = input.clientPhone;
      contact.subject = input.subject;
      contact.message = input.message;
      contact.channel = input.channel;
      contact.status = 'Novo';
      contact.messages.push(nextMessage);

      const freelancer = findStoredFreelancerByContact(store, contact);
      if (freelancer) {
        freelancer.metrics.messagesReceived += 1;
      }

      if (currentIndex > 0) {
        store.contacts.splice(currentIndex, 1);
        store.contacts.unshift(contact);
      }

      return {
        contact: hydrateContact(store, contact),
        created: false,
      };
    }

    const contactId = `contact-${Date.now()}`;
    const createdAt = new Date().toISOString();
    const contact: ContactMessage = {
      id: contactId,
      createdAt,
      messages: [
        {
          id: `${contactId}-message-1`,
          senderRole: 'client',
          senderName: input.clientName,
          body: input.message,
          createdAt,
        },
      ],
      ...input,
    };

    const normalizedContact = normalizeContactRecord(store, contact);
    store.contacts.unshift(normalizedContact);

    const freelancer = findStoredFreelancerByContact(store, normalizedContact);
    if (freelancer) {
      freelancer.metrics.contactClicks += 1;
      freelancer.metrics.messagesReceived += 1;
    }

    return {
      contact: normalizedContact,
      created: true,
    };
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
      'Novos profissionais verificados entraram em áreas de serviços e atendimento.',
      'Você pode favoritar profissionais para comparar propostas depois.',
    ],
  };
}

