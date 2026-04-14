import type {
  ContactMessage,
  ContactThreadMessage,
  UserRole,
} from '../../shared/contracts.js';
import { platformContactChannel } from '../../shared/contracts.js';
import {
  createSessionExpiry,
  createSessionToken,
  decryptSessionSecret,
  encryptSessionSecret,
  hashSessionToken,
  isSessionExpired,
} from './auth.js';
import { getSupabaseServerReadClient } from './supabase.js';

export interface StoredSession {
  token: string;
  userId: string;
  role: UserRole;
  expiresAt: string;
  supabaseAccessToken?: string | null;
  supabaseRefreshToken?: string | null;
  supabaseAccessTokenExpiresAt?: string | null;
}

type AppSessionRow = {
  token: string;
  user_id: string;
  role: UserRole;
  expires_at: string;
  supabase_access_token: string | null;
  supabase_refresh_token: string | null;
  supabase_access_token_expires_at: string | null;
};

type ContactRow = {
  id: string;
  client_user_id: string;
  freelancer_user_id: string;
  subject: string;
  status: ContactMessage['status'] | null;
  created_at: string;
  updated_at: string | null;
};

type ContactMessageRow = {
  id: string;
  contact_id: string;
  sender_user_id: string;
  sender_role: ContactThreadMessage['senderRole'];
  body: string;
  created_at: string;
};

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  city: string | null;
  state: string | null;
  user_type: UserRole | 'admin' | null;
};

const supabase = getSupabaseServerReadClient();

function requireSupabase() {
  if (!supabase) {
    throw new Error('Infraestrutura do Supabase indisponivel no servidor.');
  }

  return supabase;
}

function normalizeEmail(value?: string | null): string | undefined {
  const normalized = value?.trim().toLowerCase();
  return normalized ? normalized : undefined;
}

function buildDisplayName(profile?: ProfileRow | null) {
  return profile?.full_name?.trim() || profile?.email || 'Usuario';
}

function buildLocation(city?: string | null, state?: string | null) {
  return [city?.trim(), state?.trim()].filter(Boolean).join(', ');
}

function mapSessionRow(row: AppSessionRow, rawToken?: string): StoredSession {
  return {
    token: rawToken ?? row.token,
    userId: row.user_id,
    role: row.role,
    expiresAt: row.expires_at,
    supabaseAccessToken: decryptSessionSecret(row.supabase_access_token),
    supabaseRefreshToken: decryptSessionSecret(row.supabase_refresh_token),
    supabaseAccessTokenExpiresAt: row.supabase_access_token_expires_at,
  };
}

function sessionTokenCandidates(token: string): string[] {
  return [...new Set([token, hashSessionToken(token)])];
}

async function deleteExpiredSessionIfNeeded(row: AppSessionRow) {
  if (!isSessionExpired(row.expires_at)) {
    return false;
  }

  await requireSupabase().from('app_sessions').delete().eq('token', row.token);
  return true;
}

async function selectProfilesByIds(userIds: string[]): Promise<ProfileRow[]> {
  if (userIds.length === 0) {
    return [];
  }

  const { data, error } = await requireSupabase()
    .from('profiles')
    .select('id,full_name,email,phone,city,state,user_type')
    .in('id', userIds);

  if (error || !data) {
    return [];
  }

  return data as ProfileRow[];
}

async function hydrateContacts(contactRows: ContactRow[]): Promise<ContactMessage[]> {
  if (contactRows.length === 0) {
    return [];
  }

  const contactIds = contactRows.map((contact) => contact.id);
  const participantIds = [
    ...new Set(
      contactRows.flatMap((contact) => [contact.client_user_id, contact.freelancer_user_id]),
    ),
  ];

  const [messageResult, profiles] = await Promise.all([
    requireSupabase()
      .from('contact_messages')
      .select('id,contact_id,sender_user_id,sender_role,body,created_at')
      .in('contact_id', contactIds)
      .order('created_at', { ascending: true }),
    selectProfilesByIds(participantIds),
  ]);

  const messageRows = !messageResult.error && messageResult.data
    ? (messageResult.data as ContactMessageRow[])
    : [];
  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const messagesByContact = new Map<string, ContactMessageRow[]>();

  messageRows.forEach((message) => {
    const currentMessages = messagesByContact.get(message.contact_id) ?? [];
    currentMessages.push(message);
    messagesByContact.set(message.contact_id, currentMessages);
  });

  return contactRows.map((contact) => {
    const freelancerProfile = profileMap.get(contact.freelancer_user_id) ?? null;
    const clientProfile = profileMap.get(contact.client_user_id) ?? null;
    const threadRows = messagesByContact.get(contact.id) ?? [];
    const messages: ContactThreadMessage[] = threadRows.map((message) => ({
      id: message.id,
      senderRole: message.sender_role,
      senderName:
        buildDisplayName(profileMap.get(message.sender_user_id) ?? null) ||
        (message.sender_role === 'freelancer' ? 'Freelancer' : 'Cliente'),
      body: message.body,
      createdAt: message.created_at,
    }));
    const latestMessage = messages[messages.length - 1];

    return {
      id: contact.id,
      freelancerId: contact.freelancer_user_id,
      freelancerName: buildDisplayName(freelancerProfile),
      freelancerEmail: freelancerProfile?.email,
      clientId: contact.client_user_id,
      clientName: buildDisplayName(clientProfile),
      clientLocation: buildLocation(clientProfile?.city, clientProfile?.state),
      clientEmail: clientProfile?.email,
      clientPhone: clientProfile?.phone ?? undefined,
      subject: contact.subject,
      message: latestMessage?.body ?? '',
      channel: platformContactChannel,
      createdAt: contact.created_at,
      status: contact.status ?? 'Novo',
      messages,
    };
  });
}

async function resolveProfileId(input: {
  role: UserRole;
  userId?: string;
  email?: string;
}): Promise<string | undefined> {
  if (input.userId) {
    return input.userId;
  }

  const normalizedEmail = normalizeEmail(input.email);
  if (normalizedEmail) {
    const { data, error } = await requireSupabase()
      .from('profiles')
      .select('id')
      .eq('email', normalizedEmail)
      .maybeSingle<{ id: string }>();

    if (!error && data?.id) {
      return data.id;
    }
  }

  return undefined;
}

export async function createSession(input: {
  userId: string;
  role: UserRole;
  supabaseAccessToken?: string | null;
  supabaseRefreshToken?: string | null;
  supabaseAccessTokenExpiresAt?: string | null;
}): Promise<StoredSession> {
  const session: StoredSession = {
    token: createSessionToken(),
    userId: input.userId,
    role: input.role,
    expiresAt: createSessionExpiry(),
    supabaseAccessToken: input.supabaseAccessToken ?? null,
    supabaseRefreshToken: input.supabaseRefreshToken ?? null,
    supabaseAccessTokenExpiresAt: input.supabaseAccessTokenExpiresAt ?? null,
  };

  const { error } = await requireSupabase().from('app_sessions').insert({
    token: hashSessionToken(session.token),
    user_id: session.userId,
    role: session.role,
    expires_at: session.expiresAt,
    supabase_access_token: encryptSessionSecret(session.supabaseAccessToken),
    supabase_refresh_token: encryptSessionSecret(session.supabaseRefreshToken),
    supabase_access_token_expires_at: session.supabaseAccessTokenExpiresAt,
  });

  if (error) {
    throw new Error(error.message || 'Nao foi possivel criar a sessao do servidor.');
  }

  return session;
}

export async function findSession(token: string): Promise<StoredSession | undefined> {
  const { data, error } = await requireSupabase()
    .from('app_sessions')
    .select(
      'token,user_id,role,expires_at,supabase_access_token,supabase_refresh_token,supabase_access_token_expires_at',
    )
    .in('token', sessionTokenCandidates(token))
    .maybeSingle<AppSessionRow>();

  if (error || !data) {
    return undefined;
  }

  if (await deleteExpiredSessionIfNeeded(data)) {
    return undefined;
  }

  return mapSessionRow(data, token);
}

export async function updateSessionAuthState(
  token: string,
  input: {
    supabaseAccessToken?: string | null;
    supabaseRefreshToken?: string | null;
    supabaseAccessTokenExpiresAt?: string | null;
  },
): Promise<StoredSession | undefined> {
  const { data, error } = await requireSupabase()
    .from('app_sessions')
    .update({
      supabase_access_token: encryptSessionSecret(input.supabaseAccessToken),
      supabase_refresh_token: encryptSessionSecret(input.supabaseRefreshToken),
      supabase_access_token_expires_at: input.supabaseAccessTokenExpiresAt ?? null,
      updated_at: new Date().toISOString(),
    })
    .in('token', sessionTokenCandidates(token))
    .select(
      'token,user_id,role,expires_at,supabase_access_token,supabase_refresh_token,supabase_access_token_expires_at',
    )
    .maybeSingle<AppSessionRow>();

  if (error || !data) {
    return undefined;
  }

  return mapSessionRow(data, token);
}

export async function deleteSession(token: string): Promise<void> {
  await requireSupabase().from('app_sessions').delete().in('token', sessionTokenCandidates(token));
}

export async function findContactById(id: string): Promise<ContactMessage | undefined> {
  const { data, error } = await requireSupabase()
    .from('contacts')
    .select('id,client_user_id,freelancer_user_id,subject,status,created_at,updated_at')
    .eq('id', id)
    .maybeSingle<ContactRow>();

  if (error || !data) {
    return undefined;
  }

  const [contact] = await hydrateContacts([data]);
  return contact;
}

export async function createOrContinueContact(
  input: Omit<ContactMessage, 'id' | 'createdAt' | 'messages'>,
): Promise<{
  contact: ContactMessage;
  created: boolean;
}> {
  const clientId = await resolveProfileId({
    role: 'client',
    userId: input.clientId,
    email: input.clientEmail,
  });
  const freelancerId = await resolveProfileId({
    role: 'freelancer',
    userId: input.freelancerId,
    email: input.freelancerEmail,
  });

  if (!clientId || !freelancerId) {
    throw new Error('Nao foi possivel identificar os participantes da conversa.');
  }

  const supabaseClient = requireSupabase();
  const existingResult = await supabaseClient
    .from('contacts')
    .select('id,client_user_id,freelancer_user_id,subject,status,created_at,updated_at')
    .eq('client_user_id', clientId)
    .eq('freelancer_user_id', freelancerId)
    .maybeSingle<ContactRow>();

  let created = false;
  let contactRow: ContactRow | null = null;

  if (!existingResult.error && existingResult.data) {
    const updateResult = await supabaseClient
      .from('contacts')
      .update({
        subject: input.subject,
        status: 'Novo',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existingResult.data.id)
      .select('id,client_user_id,freelancer_user_id,subject,status,created_at,updated_at')
      .single<ContactRow>();

    if (updateResult.error || !updateResult.data) {
      throw new Error(updateResult.error?.message || 'Nao foi possivel atualizar a conversa.');
    }

    contactRow = updateResult.data;
  } else {
    const insertResult = await supabaseClient
      .from('contacts')
      .insert({
        client_user_id: clientId,
        freelancer_user_id: freelancerId,
        subject: input.subject,
        status: 'Novo',
      })
      .select('id,client_user_id,freelancer_user_id,subject,status,created_at,updated_at')
      .single<ContactRow>();

    if (insertResult.error || !insertResult.data) {
      throw new Error(insertResult.error?.message || 'Nao foi possivel iniciar a conversa.');
    }

    created = true;
    contactRow = insertResult.data;
  }

  const messageResult = await supabaseClient.from('contact_messages').insert({
    contact_id: contactRow.id,
    sender_user_id: clientId,
    sender_role: 'client',
    body: input.message,
  });

  if (messageResult.error) {
    throw new Error(messageResult.error.message || 'Nao foi possivel enviar a mensagem.');
  }

  const contact = await findContactById(contactRow.id);
  if (!contact) {
    throw new Error('Nao foi possivel carregar a conversa apos salvar a mensagem.');
  }

  return { contact, created };
}

export async function appendContactMessage(input: {
  contactId: string;
  senderRole: 'client' | 'freelancer';
  senderUserId: string;
  senderName: string;
  message: string;
}): Promise<ContactMessage | undefined> {
  void input.senderName;

  const insertResult = await requireSupabase().from('contact_messages').insert({
    contact_id: input.contactId,
    sender_user_id: input.senderUserId,
    sender_role: input.senderRole,
    body: input.message,
  });

  if (insertResult.error) {
    return undefined;
  }

  return findContactById(input.contactId);
}

export async function listContactsByFreelancerIdentity(input: {
  freelancerId?: string;
  freelancerEmail?: string;
  freelancerName?: string;
}): Promise<ContactMessage[]> {
  const freelancerId = await resolveProfileId({
    role: 'freelancer',
    userId: input.freelancerId,
    email: input.freelancerEmail,
  });
  if (!freelancerId) {
    return [];
  }

  const { data, error } = await requireSupabase()
    .from('contacts')
    .select('id,client_user_id,freelancer_user_id,subject,status,created_at,updated_at')
    .eq('freelancer_user_id', freelancerId)
    .order('updated_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return hydrateContacts(data as ContactRow[]);
}

export async function listContactsByClientIdentity(input: {
  clientId?: string;
  clientEmail?: string;
  clientName?: string;
}): Promise<ContactMessage[]> {
  const clientId = await resolveProfileId({
    role: 'client',
    userId: input.clientId,
    email: input.clientEmail,
  });
  if (!clientId) {
    return [];
  }

  const { data, error } = await requireSupabase()
    .from('contacts')
    .select('id,client_user_id,freelancer_user_id,subject,status,created_at,updated_at')
    .eq('client_user_id', clientId)
    .order('updated_at', { ascending: false });

  if (error || !data) {
    return [];
  }

  return hydrateContacts(data as ContactRow[]);
}

export async function recordFreelancerProfileViewByIdentity(input: {
  freelancerId?: string;
  freelancerEmail?: string;
  freelancerSlug?: string;
}): Promise<boolean> {
  void input.freelancerSlug;

  const freelancerId = await resolveProfileId({
    role: 'freelancer',
    userId: input.freelancerId,
    email: input.freelancerEmail,
  });
  if (!freelancerId) {
    return false;
  }

  const { error } = await requireSupabase().rpc('increment_freelancer_profile_views', {
    target_user_id: freelancerId,
  });

  return !error;
}
