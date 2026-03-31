import type { User } from '@supabase/supabase-js';

import type {
  AuthSessionPayload,
  ClientDashboard,
  ContactMessage,
  ContactThreadMessage,
  ConversationInbox,
  Freelancer,
  FreelancerDashboard,
  FreelancerPlanTier,
  ProfileAssetKind,
  ProfileAssetUploadResponse,
  RegistrationResponse,
  SessionUser,
  SubscriptionStatus,
  UserRole,
} from '../../shared/contracts';
import {
  categories,
  freelancerPlanCatalog,
  getFreelancerPlanPrice,
  platformContactChannel,
} from '../../shared/contracts';
import { sanitizeCep } from './cep';
import { supabase } from './supabase';

interface SearchFilters {
  search?: string;
  category?: string;
  location?: string;
  experience?: string;
}

type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  user_type: UserRole | 'admin' | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  updated_at: string;
};

type ClientProfileRow = {
  id?: string;
  user_id: string;
  cep?: string | null;
  company_name?: string | null;
  document_number?: string | null;
  contact_name?: string | null;
  company_description?: string | null;
  created_at?: string;
  updated_at?: string;
};

type DatabaseExperienceLevel = 'junior' | 'pleno' | 'senior' | 'especialista';
type DatabaseAvailabilityStatus = 'available' | 'busy' | 'unavailable';

type FreelancerProfileRow = {
  id?: string;
  user_id: string;
  cep?: string | null;
  city?: string | null;
  state?: string | null;
  professional_title?: string | null;
  skills?: string[] | null;
  experience_level?: DatabaseExperienceLevel | null;
  portfolio_url?: string | null;
  banner_url?: string | null;
  hourly_rate?: number | null;
  availability_status?: DatabaseAvailabilityStatus | null;
  rating_average?: number | null;
  total_reviews?: number | null;
  created_at?: string;
  updated_at?: string;
  category?: string | null;
  summary?: string | null;
  description?: string | null;
  years_experience?: number | null;
  linkedin_url?: string | null;
  website_url?: string | null;
  whatsapp?: string | null;
  has_cnpj?: boolean | null;
  subscription_tier?: FreelancerPlanTier | null;
  subscription_status?: SubscriptionStatus | null;
  subscription_started_at?: string | null;
  subscription_ends_at?: string | null;
  profile_views?: number | null;
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

type AuthSeed = {
  avatarUrl?: string | null;
  bannerUrl?: string | null;
  bio?: string | null;
  category?: string | null;
  cep?: string | null;
  city?: string | null;
  description?: string | null;
  email?: string | null;
  experienceLevel?: string | null;
  fullName?: string | null;
  hasCnpj?: boolean | null;
  linkedinUrl?: string | null;
  name?: string | null;
  phone?: string | null;
  portfolioUrl?: string | null;
  profession?: string | null;
  role?: UserRole | null;
  state?: string | null;
  subscriptionTier?: FreelancerPlanTier | null;
  summary?: string | null;
  websiteUrl?: string | null;
  whatsapp?: string | null;
  yearsExperience?: number | null;
};

const DATABASE_SETUP_HINT =
  'A estrutura de dados da plataforma ainda não foi preparada para publicação. Conclua a configuração inicial antes de publicar.';
const defaultFreelancerAvatar =
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=400&q=80';
const defaultFreelancerBanner = `${import.meta.env.BASE_URL}banner_geral.png`;
const legacyFreelancerBannerUrls = new Set([
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80',
  '/banner_geral.png',
  defaultFreelancerBanner,
]);
const profileAssetMimeTypes = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/avif': 'avif',
} as const;
const profileAssetBuckets: Record<ProfileAssetKind, 'avatars' | 'banners'> = {
  avatar: 'avatars',
  banner: 'banners',
};

function normalizeText(value?: string | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function normalizeEmail(value?: string | null): string | undefined {
  const normalized = normalizeText(value);
  return normalized?.toLowerCase();
}

function normalizeDigits(value?: string | null): string | undefined {
  const normalized = value?.replace(/\D/g, '');
  return normalized ? normalized : undefined;
}

function normalizeFreelancerBannerUrl(value?: string | null): string | undefined {
  const normalized = normalizeText(value);
  if (!normalized || legacyFreelancerBannerUrls.has(normalized)) {
    return undefined;
  }

  return normalized;
}

function readMetadataValue(metadata: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function readMetadataBoolean(metadata: Record<string, unknown>, keys: string[]): boolean | null {
  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === 'boolean') {
      return value;
    }

    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (normalized === 'true' || normalized === 'sim') {
        return true;
      }

      if (normalized === 'false' || normalized === 'nao' || normalized === 'não') {
        return false;
      }
    }
  }

  return null;
}

function readMetadataNumber(metadata: Record<string, unknown>, keys: string[]): number | null {
  for (const key of keys) {
    const value = metadata[key];

    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }

  return null;
}

function readMetadataRole(metadata: Record<string, unknown>): UserRole | null {
  const value = readMetadataValue(metadata, ['user_type', 'role']);
  return value === 'client' || value === 'freelancer' ? value : null;
}

function readMetadataSubscriptionTier(
  metadata: Record<string, unknown>,
): FreelancerPlanTier | null {
  const value = readMetadataValue(metadata, ['subscription_tier', 'subscriptionTier']);
  return value === 'booster' || value === 'normal' ? value : null;
}

function readAuthSeed(user: User): AuthSeed {
  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;

  return {
    avatarUrl: readMetadataValue(metadata, ['avatar_url', 'avatarUrl']),
    bannerUrl: readMetadataValue(metadata, ['banner_url', 'bannerUrl']),
    bio: readMetadataValue(metadata, ['bio', 'summary']),
    category: readMetadataValue(metadata, ['category']),
    cep: readMetadataValue(metadata, ['cep']),
    city: readMetadataValue(metadata, ['city']),
    description: readMetadataValue(metadata, ['description']),
    email: normalizeEmail(readMetadataValue(metadata, ['email']) ?? user.email ?? null) ?? null,
    experienceLevel: readMetadataValue(metadata, ['experience_level', 'experienceLevel']),
    fullName: readMetadataValue(metadata, ['full_name']),
    hasCnpj: readMetadataBoolean(metadata, ['has_cnpj', 'hasCnpj']),
    linkedinUrl: readMetadataValue(metadata, ['linkedin_url', 'linkedinUrl']),
    name: readMetadataValue(metadata, ['name']),
    phone: readMetadataValue(metadata, ['phone']),
    portfolioUrl: readMetadataValue(metadata, ['portfolio_url', 'portfolioUrl']),
    profession: readMetadataValue(metadata, ['professional_title', 'profession']),
    role: readMetadataRole(metadata),
    state: readMetadataValue(metadata, ['state']),
    subscriptionTier: readMetadataSubscriptionTier(metadata),
    summary: readMetadataValue(metadata, ['summary', 'bio']),
    websiteUrl: readMetadataValue(metadata, ['website_url', 'websiteUrl']),
    whatsapp: readMetadataValue(metadata, ['whatsapp']),
    yearsExperience: readMetadataNumber(metadata, ['years_experience', 'yearsExperience']),
  };
}

function createPublicSlug(name: string, id: string) {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return `${base || 'freelancer'}-${id.slice(0, 8)}`;
}

function buildLocation(city?: string | null, state?: string | null) {
  return [normalizeText(city), normalizeText(state)].filter(Boolean).join(', ');
}

function defaultPortfolio(url: string) {
  return [
    {
      title: 'Portfolio principal',
      description: 'Link principal informado no perfil do freelancer.',
      url,
    },
  ];
}

function defaultYearsExperience(level: Freelancer['experienceLevel']) {
  return level === 'Júnior' ? 2 : level === 'Sênior' ? 8 : 5;
}

function normalizeExperienceLabel(value?: string | null): Freelancer['experienceLevel'] | undefined {
  const normalized = value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (normalized === 'junior') return 'Júnior';
  if (normalized === 'pleno') return 'Pleno';
  if (normalized === 'senior' || normalized === 'especialista') return 'Sênior';
  return undefined;
}

function fromDatabaseExperienceLevel(value?: DatabaseExperienceLevel | null): Freelancer['experienceLevel'] {
  return value === 'junior' ? 'Júnior' : value === 'senior' || value === 'especialista' ? 'Sênior' : 'Pleno';
}

function toDatabaseExperienceLevel(value?: string | Freelancer['experienceLevel'] | null): DatabaseExperienceLevel | null {
  const normalized = normalizeExperienceLabel(value);
  if (normalized === 'Júnior') return 'junior';
  if (normalized === 'Sênior') return 'senior';
  if (normalized === 'Pleno') return 'pleno';
  return null;
}

function availabilityTextFromStatus(value?: DatabaseAvailabilityStatus | null) {
  if (value === 'available') return 'Disponível para novos projetos.';
  if (value === 'busy') return 'Agenda ocupada no momento.';
  if (value === 'unavailable') return 'Indisponível para novos projetos.';
  return 'Perfil ativo na plataforma.';
}

function normalizeCategory(value?: string | null): Freelancer['category'] | undefined {
  return categories.includes(value as Freelancer['category']) ? (value as Freelancer['category']) : undefined;
}

function normalizeSubscriptionTier(value?: string | null): FreelancerPlanTier {
  return value === 'booster' ? 'booster' : 'normal';
}

function normalizeSubscriptionStatus(value?: string | null): SubscriptionStatus {
  return value === 'past_due' || value === 'expired' || value === 'active' ? value : 'active';
}

function buildDisplayName(profile?: ProfileRow | null) {
  return normalizeText(profile?.full_name) ?? profile?.email ?? 'Usuário';
}

function normalizeUserRole(profile?: ProfileRow | null): UserRole | undefined {
  return profile?.user_type === 'client' || profile?.user_type === 'freelancer' ? profile.user_type : undefined;
}

function uniqueTextList(values: Array<string | undefined | null>) {
  return [...new Set(values.map((value) => normalizeText(value)).filter(Boolean))] as string[];
}

function inferCategory(profession: string, skills: string[]): Freelancer['category'] {
  const haystack = `${profession} ${skills.join(' ')}`.toLowerCase();

  if (
    haystack.includes('chaveiro') ||
    haystack.includes('encan') ||
    haystack.includes('eletric') ||
    haystack.includes('montador') ||
    haystack.includes('marcene') ||
    haystack.includes('jardin') ||
    haystack.includes('limpeza') ||
    haystack.includes('manuten')
  ) {
    return 'Conserto em Casa';
  }

  if (
    haystack.includes('pedreiro') ||
    haystack.includes('obra') ||
    haystack.includes('reforma') ||
    haystack.includes('pintor') ||
    haystack.includes('gesso') ||
    haystack.includes('constru') ||
    haystack.includes('arquit') ||
    haystack.includes('engenh')
  ) {
    return 'Obra e Reforma';
  }

  if (
    haystack.includes('guincho') ||
    haystack.includes('frete') ||
    haystack.includes('mudan') ||
    haystack.includes('entrega') ||
    haystack.includes('motorista') ||
    haystack.includes('transporte') ||
    haystack.includes('reboque')
  ) {
    return 'Frete e Guincho';
  }

  if (
    haystack.includes('tecnic') ||
    haystack.includes('instala') ||
    haystack.includes('vistoria') ||
    haystack.includes('refrigera') ||
    haystack.includes('solda')
  ) {
    return 'Instalação e Manutenção';
  }

  if (
    haystack.includes('design') ||
    haystack.includes('ux') ||
    haystack.includes('ui') ||
    haystack.includes('video') ||
    haystack.includes('vídeo') ||
    haystack.includes('motion') ||
    haystack.includes('foto')
  ) {
    return 'Design e Vídeo';
  }

  if (
    haystack.includes('marketing') ||
    haystack.includes('ads') ||
    haystack.includes('copy') ||
    haystack.includes('seo') ||
    haystack.includes('conteudo') ||
    haystack.includes('conteúdo') ||
    haystack.includes('reda') ||
    haystack.includes('trad')
  ) {
    return 'Marketing e Redes';
  }

  if (
    haystack.includes('react') ||
    haystack.includes('node') ||
    haystack.includes('site') ||
    haystack.includes('app') ||
    haystack.includes('software') ||
    haystack.includes('sistema') ||
    haystack.includes('program') ||
    haystack.includes('automa')
  ) {
    return 'Sites e Tecnologia';
  }

  return 'Projetos e Consultoria';
}

function inferProfileAssetExtension(file: File): string | null {
  const normalizedType = file.type.trim().toLowerCase();
  if (normalizedType in profileAssetMimeTypes) {
    return profileAssetMimeTypes[normalizedType as keyof typeof profileAssetMimeTypes];
  }

  const match = /\.([a-z0-9]+)$/i.exec(file.name);
  if (!match) {
    return null;
  }

  switch (match[1].toLowerCase()) {
    case 'jpg':
    case 'jpeg':
      return 'jpg';
    case 'png':
    case 'webp':
    case 'avif':
      return match[1].toLowerCase();
    default:
      return null;
  }
}

function buildProfileAssetPath(userId: string, kind: ProfileAssetKind, extension: string) {
  return `${userId}/${kind}.${extension}`;
}

function buildFreelancer(profile: ProfileRow, freelancerRow?: FreelancerProfileRow | null): Freelancer {
  const profession = normalizeText(freelancerRow?.professional_title) ?? 'Freelancer';
  const storedCategory = normalizeCategory(freelancerRow?.category);
  const category = storedCategory ?? inferCategory(profession, freelancerRow?.skills ?? []);
  const experienceLevel = fromDatabaseExperienceLevel(freelancerRow?.experience_level ?? null);
  const portfolioUrl =
    normalizeText(freelancerRow?.portfolio_url) ??
    normalizeText(freelancerRow?.website_url) ??
    'https://www.linkedin.com/';
  const subscriptionTier = normalizeSubscriptionTier(freelancerRow?.subscription_tier);

  return {
    id: profile.id,
    slug: createPublicSlug(buildDisplayName(profile), profile.id),
    name: buildDisplayName(profile),
    profession,
    subscriptionTier,
    category,
    summary:
      normalizeText(freelancerRow?.summary) ??
      normalizeText(profile.bio) ??
      'Perfil profissional em configura??o.',
    description:
      normalizeText(freelancerRow?.description) ??
      normalizeText(freelancerRow?.summary) ??
      normalizeText(profile.bio) ??
      'O perfil ainda est? sendo completado com mais detalhes de atua??o.',
    location: buildLocation(freelancerRow?.city ?? profile.city, freelancerRow?.state ?? profile.state),
    experienceLevel,
    yearsExperience:
      typeof freelancerRow?.years_experience === 'number'
        ? freelancerRow.years_experience
        : defaultYearsExperience(experienceLevel),
    skills: uniqueTextList([
      ...(freelancerRow?.skills ?? []),
      profession,
      category,
      'Atendimento direto',
    ]),
    portfolio: defaultPortfolio(portfolioUrl),
    avatarUrl: normalizeText(profile.avatar_url) ?? defaultFreelancerAvatar,
    linkedinUrl: normalizeText(freelancerRow?.linkedin_url),
    websiteUrl:
      normalizeText(freelancerRow?.website_url) ??
      normalizeText(freelancerRow?.portfolio_url),
    whatsapp:
      normalizeText(freelancerRow?.whatsapp) ??
      normalizeDigits(profile.phone) ??
      '',
    verified: subscriptionTier === 'booster',
    availability: availabilityTextFromStatus(freelancerRow?.availability_status),
    memberSince: profile.created_at,
    bannerUrl: normalizeFreelancerBannerUrl(freelancerRow?.banner_url) ?? defaultFreelancerBanner,
  };
}

function buildClientProfile(profile: ProfileRow) {
  return {
    id: profile.id,
    name: buildDisplayName(profile),
    email: profile.email,
    phone: normalizeText(profile.phone) ?? '',
    avatarUrl: normalizeText(profile.avatar_url),
    location: buildLocation(profile.city, profile.state),
    createdAt: profile.created_at,
  };
}

function buildSessionUser(profile: ProfileRow): SessionUser {
  const role = normalizeUserRole(profile);
  if (!role) {
    throw new Error('N?o foi poss?vel identificar o tipo da sua conta.');
  }

  return {
    id: profile.id,
    name: buildDisplayName(profile),
    role,
  };
}

function buildFreelancerSubscription(freelancerRow?: FreelancerProfileRow | null) {
  const tier = normalizeSubscriptionTier(freelancerRow?.subscription_tier);
  const hasCnpj = freelancerRow?.has_cnpj === true;

  return {
    tier,
    name: freelancerPlanCatalog[tier].name,
    priceMonthly: getFreelancerPlanPrice(tier, hasCnpj),
    status: normalizeSubscriptionStatus(freelancerRow?.subscription_status),
    startedAt: freelancerRow?.subscription_started_at ?? new Date().toISOString(),
    endsAt:
      freelancerRow?.subscription_ends_at ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function isSetupError(message: string) {
  const normalized = message.toLowerCase();

  return (
    normalized.includes('schema cache') ||
    normalized.includes('could not find the table') ||
    normalized.includes('does not exist') ||
    normalized.includes('row-level security') ||
    normalized.includes('permission denied') ||
    normalized.includes('policy')
  );
}

function normalizeErrorMessage(message: string, fallback: string) {
  if (!message) {
    return fallback;
  }

  const normalized = message.toLowerCase();

  if (isSetupError(message)) {
    return DATABASE_SETUP_HINT;
  }

  if (normalized.includes('auth session missing')) {
    return 'Fa?a login para continuar.';
  }

  if (
    normalized.includes('invalid login credentials') ||
    normalized.includes('invalid email or password') ||
    normalized.includes('email or password')
  ) {
    return 'E-mail ou senha inv?lidos.';
  }

  if (normalized.includes('email not confirmed')) {
    return 'Confirme seu e-mail antes de fazer login.';
  }

  if (
    normalized.includes('already registered') ||
    normalized.includes('already been registered') ||
    normalized.includes('user already exists')
  ) {
    return 'J? existe uma conta com este e-mail.';
  }

  return message;
}

function toError(error: unknown, fallback: string) {
  if (error instanceof Error) {
    return new Error(normalizeErrorMessage(error.message, fallback));
  }

  const maybeMessage =
    typeof error === 'object' && error && 'message' in error
      ? String((error as { message: unknown }).message)
      : '';

  return new Error(normalizeErrorMessage(maybeMessage, fallback));
}

async function unwrap<T>(
  promise: PromiseLike<{ data: T; error: { message: string } | null }>,
  fallback: string,
): Promise<T> {
  const { data, error } = await promise;

  if (error) {
    throw toError(error, fallback);
  }

  return data;
}

async function selectProfileById(id: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from('profiles').select('*').eq('id', id).maybeSingle();

  if (error) {
    throw toError(error, 'N?o foi poss?vel carregar o perfil.');
  }

  return (data as ProfileRow | null) ?? null;
}

async function selectProfilesByIds(ids: string[]): Promise<ProfileRow[]> {
  if (ids.length === 0) {
    return [];
  }

  const { data, error } = await supabase.from('profiles').select('*').in('id', ids);

  if (error) {
    throw toError(error, 'N?o foi poss?vel carregar os perfis relacionados.');
  }

  return (data ?? []) as ProfileRow[];
}

async function selectClientProfileByUserId(userId: string): Promise<ClientProfileRow | null> {
  const { data, error } = await supabase
    .from('client_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw toError(error, 'N?o foi poss?vel carregar a conta de cliente.');
  }

  return (data as ClientProfileRow | null) ?? null;
}

async function selectFreelancerProfileByUserId(
  userId: string,
): Promise<FreelancerProfileRow | null> {
  const { data, error } = await supabase
    .from('freelancer_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    throw toError(error, 'N?o foi poss?vel carregar a conta freelancer.');
  }

  return (data as FreelancerProfileRow | null) ?? null;
}

async function selectAuthenticatedUser(): Promise<User | null> {
  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError) {
    throw toError(sessionError, 'N?o foi poss?vel validar sua sess?o.');
  }

  if (!sessionData.session) {
    return null;
  }

  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) {
    throw toError(userError, 'N?o foi poss?vel validar sua sess?o.');
  }

  return userData.user ?? null;
}

async function materializeAuthUser(user: User): Promise<SessionUser> {
  const currentProfile = await selectProfileById(user.id);
  const currentClientProfile = await selectClientProfileByUserId(user.id).catch(() => null);
  const currentFreelancerProfile = await selectFreelancerProfileByUserId(user.id).catch(() => null);
  const seed = readAuthSeed(user);
  const role = seed.role ?? normalizeUserRole(currentProfile) ?? null;

  if (!role) {
    throw new Error('N?o foi poss?vel identificar o tipo da sua conta.');
  }

  const fullName =
    normalizeText(currentProfile?.full_name) ??
    normalizeText(seed.fullName) ??
    normalizeText(seed.name) ??
    user.email ??
    'Usuario';
  const phone = normalizeText(currentProfile?.phone) ?? normalizeText(seed.phone);
  const avatarUrl = normalizeText(currentProfile?.avatar_url) ?? normalizeText(seed.avatarUrl);
  const bio =
    normalizeText(currentProfile?.bio) ??
    normalizeText(seed.bio) ??
    normalizeText(seed.summary);
  const clientCep = sanitizeCep(currentClientProfile?.cep ?? seed.cep);
  const cep = sanitizeCep(currentFreelancerProfile?.cep ?? seed.cep);
  const city =
    normalizeText(currentFreelancerProfile?.city) ??
    normalizeText(currentProfile?.city) ??
    normalizeText(seed.city);
  const state =
    normalizeText(currentFreelancerProfile?.state) ??
    normalizeText(currentProfile?.state) ??
    normalizeText(seed.state);
  const profilePayload: Record<string, unknown> = {
    id: user.id,
    email: normalizeEmail(user.email) ?? normalizeEmail(seed.email) ?? '',
    full_name: fullName,
    user_type: role,
  };

  if (phone) profilePayload.phone = phone;
  if (avatarUrl) profilePayload.avatar_url = avatarUrl;
  if (bio) profilePayload.bio = bio;
  if (city) profilePayload.city = city;
  if (state) profilePayload.state = state;

  await unwrap(
    supabase.from('profiles').upsert(profilePayload, { onConflict: 'id' }),
    'N?o foi poss?vel sincronizar o perfil principal.',
  );

  if (role === 'client') {
    await unwrap(
      supabase.from('client_profiles').upsert(
        {
          user_id: user.id,
          contact_name: normalizeText(seed.fullName) ?? normalizeText(seed.name) ?? fullName,
          ...(clientCep ? { cep: clientCep } : {}),
        },
        { onConflict: 'user_id' },
      ),
      'N?o foi poss?vel sincronizar a conta de cliente.',
    );

    const nextProfile = await selectProfileById(user.id);
    if (!nextProfile) {
      throw new Error('N?o foi poss?vel carregar sua conta ap?s a sincroniza??o.');
    }

    return buildSessionUser(nextProfile);
  }

  const experienceLevel =
    normalizeExperienceLabel(currentFreelancerProfile?.experience_level ?? null) ??
    normalizeExperienceLabel(seed.experienceLevel) ??
    'Pleno';
  const profession =
    normalizeText(currentFreelancerProfile?.professional_title) ??
    normalizeText(seed.profession) ??
    'Freelancer';
  const category =
    normalizeCategory(currentFreelancerProfile?.category) ??
    normalizeCategory(seed.category) ??
    inferCategory(profession, currentFreelancerProfile?.skills ?? []);
  const summary =
    normalizeText(currentFreelancerProfile?.summary) ??
    normalizeText(seed.summary) ??
    normalizeText(seed.bio) ??
    'Perfil profissional em configura??o.';
  const description =
    normalizeText(currentFreelancerProfile?.description) ??
    normalizeText(seed.description) ??
    summary;
  const portfolioUrl =
    normalizeText(currentFreelancerProfile?.portfolio_url) ??
    normalizeText(seed.portfolioUrl) ??
    normalizeText(seed.websiteUrl) ??
    'https://www.linkedin.com/';
  const websiteUrl =
    normalizeText(currentFreelancerProfile?.website_url) ??
    normalizeText(seed.websiteUrl) ??
    normalizeText(currentFreelancerProfile?.portfolio_url) ??
    normalizeText(seed.portfolioUrl);
  const freelancerPayload: Record<string, unknown> = {
    user_id: user.id,
    professional_title: profession,
    skills:
      currentFreelancerProfile?.skills && currentFreelancerProfile.skills.length > 0
        ? currentFreelancerProfile.skills
        : uniqueTextList([profession, category, 'Atendimento direto']),
    experience_level:
      currentFreelancerProfile?.experience_level ?? toDatabaseExperienceLevel(experienceLevel),
    portfolio_url: portfolioUrl,
    availability_status: currentFreelancerProfile?.availability_status ?? 'available',
    rating_average:
      typeof currentFreelancerProfile?.rating_average === 'number'
        ? currentFreelancerProfile.rating_average
        : 0,
    total_reviews:
      typeof currentFreelancerProfile?.total_reviews === 'number'
        ? currentFreelancerProfile.total_reviews
        : 0,
    category,
    summary,
    description,
    years_experience:
      typeof currentFreelancerProfile?.years_experience === 'number'
        ? currentFreelancerProfile.years_experience
        : seed.yearsExperience ?? defaultYearsExperience(experienceLevel),
    linkedin_url:
      normalizeText(currentFreelancerProfile?.linkedin_url) ?? normalizeText(seed.linkedinUrl),
    website_url: websiteUrl,
    whatsapp:
      normalizeText(currentFreelancerProfile?.whatsapp) ??
      normalizeText(seed.whatsapp) ??
      normalizeDigits(phone),
    has_cnpj: currentFreelancerProfile?.has_cnpj ?? seed.hasCnpj ?? false,
    subscription_tier:
      currentFreelancerProfile?.subscription_tier ?? seed.subscriptionTier ?? 'normal',
    subscription_status: currentFreelancerProfile?.subscription_status ?? 'active',
  };

  const bannerUrl =
    normalizeText(currentFreelancerProfile?.banner_url) ?? normalizeText(seed.bannerUrl);
  if (bannerUrl) freelancerPayload.banner_url = bannerUrl;
  if (cep) freelancerPayload.cep = cep;
  if (city) freelancerPayload.city = city;
  if (state) freelancerPayload.state = state;

  if (!currentFreelancerProfile?.subscription_started_at) {
    freelancerPayload.subscription_started_at = new Date().toISOString();
  }

  if (!currentFreelancerProfile?.subscription_ends_at) {
    freelancerPayload.subscription_ends_at = new Date(
      Date.now() + 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
  }

  if (typeof currentFreelancerProfile?.profile_views !== 'number') {
    freelancerPayload.profile_views = 0;
  }

  await unwrap(
    supabase.from('freelancer_profiles').upsert(freelancerPayload, { onConflict: 'user_id' }),
    'N?o foi poss?vel sincronizar a conta freelancer.',
  );

  const nextProfile = await selectProfileById(user.id);
  if (!nextProfile) {
    throw new Error('N?o foi poss?vel carregar sua conta ap?s a sincroniza??o.');
  }

  return buildSessionUser(nextProfile);
}

async function requireSessionUser(role?: UserRole): Promise<SessionUser> {
  const authUser = await selectAuthenticatedUser();
  if (!authUser) {
    throw new Error('Fa?a login para continuar.');
  }

  const sessionUser = await materializeAuthUser(authUser);
  if (role && sessionUser.role !== role) {
    throw new Error(
      role === 'client'
        ? 'Apenas clientes podem acessar esta ?rea.'
        : 'Apenas freelancers podem acessar esta ?rea.',
    );
  }

  return sessionUser;
}

async function listPublicFreelancers(init?: RequestInit): Promise<Freelancer[]> {
  let profileQuery = supabase.from('profiles').select('*').eq('user_type', 'freelancer');
  if (init?.signal) {
    profileQuery = profileQuery.abortSignal(init.signal);
  }

  const profiles = (await unwrap(
    profileQuery,
    'N?o foi poss?vel carregar os profissionais.',
  )) as ProfileRow[];

  if (profiles.length === 0) {
    return [];
  }

  let freelancerQuery = supabase
    .from('freelancer_profiles')
    .select('*')
    .in('user_id', profiles.map((profile) => profile.id));
  if (init?.signal) {
    freelancerQuery = freelancerQuery.abortSignal(init.signal);
  }

  const freelancerRows = (await unwrap(
    freelancerQuery,
    'N?o foi poss?vel carregar os detalhes dos profissionais.',
  )) as FreelancerProfileRow[];
  const freelancerMap = new Map(freelancerRows.map((row) => [row.user_id, row]));

  return profiles
    .map((profile) => buildFreelancer(profile, freelancerMap.get(profile.id) ?? null))
    .filter((freelancer) => {
      const row = freelancerMap.get(freelancer.id);
      return normalizeSubscriptionStatus(row?.subscription_status) === 'active';
    })
    .sort((left, right) => {
      const leftRank = left.subscriptionTier === 'booster' ? 0 : 1;
      const rightRank = right.subscriptionTier === 'booster' ? 0 : 1;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.name.localeCompare(right.name, 'pt-BR');
    });
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
  const [messageRows, profiles] = await Promise.all([
    unwrap(
      supabase
        .from('contact_messages')
        .select('*')
        .in('contact_id', contactIds)
        .order('created_at', { ascending: true }),
      'N?o foi poss?vel carregar as mensagens.',
    ) as Promise<ContactMessageRow[]>,
    selectProfilesByIds(participantIds),
  ]);

  const profileMap = new Map(profiles.map((profile) => [profile.id, profile]));
  const messagesByContact = new Map<string, ContactMessageRow[]>();

  messageRows.forEach((message) => {
    const currentList = messagesByContact.get(message.contact_id) ?? [];
    currentList.push(message);
    messagesByContact.set(message.contact_id, currentList);
  });

  return contactRows.map((contact) => {
    const freelancerProfile = profileMap.get(contact.freelancer_user_id) ?? null;
    const clientProfile = profileMap.get(contact.client_user_id) ?? null;
    const threadRows = messagesByContact.get(contact.id) ?? [];
    const threadMessages: ContactThreadMessage[] = threadRows.map((message) => ({
      id: message.id,
      senderRole: message.sender_role,
      senderName:
        buildDisplayName(profileMap.get(message.sender_user_id) ?? null) ??
        (message.sender_role === 'freelancer' ? 'Freelancer' : 'Cliente'),
      body: message.body,
      createdAt: message.created_at,
    }));
    const latestMessage = threadMessages[threadMessages.length - 1];

    return {
      id: contact.id,
      freelancerId: contact.freelancer_user_id,
      freelancerName: buildDisplayName(freelancerProfile),
      freelancerEmail: freelancerProfile?.email,
      clientId: contact.client_user_id,
      clientName: buildDisplayName(clientProfile),
      clientLocation: buildLocation(clientProfile?.city, clientProfile?.state),
      clientEmail: clientProfile?.email,
      clientPhone: normalizeText(clientProfile?.phone),
      subject: contact.subject,
      message: latestMessage?.body ?? '',
      channel: platformContactChannel,
      createdAt: contact.created_at,
      status: contact.status ?? 'Novo',
      messages: threadMessages,
    };
  });
}

async function loadContactById(contactId: string): Promise<ContactMessage> {
  const { data, error } = await supabase
    .from('contacts')
    .select('*')
    .eq('id', contactId)
    .maybeSingle();

  if (error) {
    throw toError(error, 'N?o foi poss?vel carregar a conversa.');
  }

  if (!data) {
    throw new Error('Conversa n?o encontrada.');
  }

  const [contact] = await hydrateContacts([data as ContactRow]);
  if (!contact) {
    throw new Error('Conversa n?o encontrada.');
  }

  return contact;
}

async function loadContactsForUser(userId: string): Promise<ContactMessage[]> {
  const rows = (await unwrap(
    supabase
      .from('contacts')
      .select('*')
      .or(`client_user_id.eq.${userId},freelancer_user_id.eq.${userId}`)
      .order('updated_at', { ascending: false }),
    'N?o foi poss?vel carregar sua central de mensagens.',
  )) as ContactRow[];

  return hydrateContacts(rows);
}

export const api = {
  async getFreelancers(filters: SearchFilters, init?: RequestInit) {
    const freelancers = await listPublicFreelancers(init);
    const normalizedSearch = filters.search?.trim().toLowerCase() ?? '';
    const normalizedLocation = filters.location?.trim().toLowerCase() ?? '';

    return freelancers.filter((freelancer) => {
      const matchesSearch =
        !normalizedSearch ||
        freelancer.name.toLowerCase().includes(normalizedSearch) ||
        freelancer.profession.toLowerCase().includes(normalizedSearch) ||
        freelancer.skills.some((skill) => skill.toLowerCase().includes(normalizedSearch));
      const matchesCategory =
        !filters.category || filters.category === 'Todos' || freelancer.category === filters.category;
      const matchesLocation =
        !normalizedLocation || freelancer.location.toLowerCase().includes(normalizedLocation);
      const matchesExperience =
        !filters.experience ||
        filters.experience === 'Todos' ||
        freelancer.experienceLevel === filters.experience;

      return matchesSearch && matchesCategory && matchesLocation && matchesExperience;
    });
  },

  async getFreelancer(slug: string, init?: RequestInit) {
    const freelancers = await listPublicFreelancers(init);
    const freelancer = freelancers.find((item) => item.slug === slug);

    if (!freelancer) {
      throw new Error('Freelancer n?o encontrado.');
    }

    void supabase.rpc('increment_freelancer_profile_views', {
      target_user_id: freelancer.id,
    });

    return freelancer;
  },

  async registerClient(payload: {
    cep: string;
    email: string;
    location: string;
    name: string;
    password: string;
    phone: string;
  }) {
    const normalizedCep = sanitizeCep(payload.cep);
    if (normalizedCep.length !== 8) {
      throw new Error('Informe um CEP válido com 8 dígitos.');
    }

    const [city, state] = payload.location.split(',').map((part) => part?.trim() ?? '');
    const { data, error } = await supabase.auth.signUp({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      options: {
        data: {
          cep: normalizedCep,
          city,
          email: payload.email.trim().toLowerCase(),
          full_name: payload.name,
          name: payload.name,
          phone: payload.phone,
          role: 'client',
          state,
          user_type: 'client',
        },
      },
    });

    if (error) {
      throw toError(error, 'N?o foi poss?vel criar a conta.');
    }

    if (data.user && data.session) {
      const user = await materializeAuthUser(data.user);
      return {
        user,
        requiresEmailConfirmation: false,
      } satisfies RegistrationResponse;
    }

    return {
      user: null,
      requiresEmailConfirmation: true,
    } satisfies RegistrationResponse;
  },

  async registerFreelancer(payload: {
    avatarUrl?: string;
    bannerUrl?: string;
    category: string;
    cep: string;
    description: string;
    email: string;
    experienceLevel: string;
    hasCnpj: string;
    linkedinUrl?: string;
    location: string;
    name: string;
    password: string;
    phone: string;
    portfolioUrl?: string;
    profession: string;
    subscriptionTier: FreelancerPlanTier;
    summary: string;
    websiteUrl?: string;
    yearsExperience: number;
  }) {
    const normalizedCep = sanitizeCep(payload.cep);
    if (normalizedCep.length !== 8) {
      throw new Error('Informe um CEP v?lido com 8 d?gitos.');
    }

    const [city, state] = payload.location.split(',').map((part) => part?.trim() ?? '');
    const hasCnpj = payload.hasCnpj.trim().toLowerCase().startsWith('s');
    const { data, error } = await supabase.auth.signUp({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
      options: {
        data: {
          avatar_url: normalizeText(payload.avatarUrl),
          banner_url: normalizeText(payload.bannerUrl),
          category: payload.category,
          cep: normalizedCep,
          city,
          description: payload.description,
          email: payload.email.trim().toLowerCase(),
          experience_level: payload.experienceLevel,
          full_name: payload.name,
          has_cnpj: hasCnpj,
          linkedin_url: normalizeText(payload.linkedinUrl),
          name: payload.name,
          phone: payload.phone,
          portfolio_url: normalizeText(payload.portfolioUrl),
          profession: payload.profession,
          role: 'freelancer',
          state,
          subscription_tier: payload.subscriptionTier,
          summary: payload.summary,
          user_type: 'freelancer',
          website_url: normalizeText(payload.websiteUrl),
          years_experience: payload.yearsExperience,
        },
      },
    });

    if (error) {
      throw toError(error, 'N?o foi poss?vel concluir o cadastro.');
    }

    if (data.user && data.session) {
      const user = await materializeAuthUser(data.user);
      return {
        user,
        requiresEmailConfirmation: false,
      } satisfies RegistrationResponse;
    }

    return {
      user: null,
      requiresEmailConfirmation: true,
    } satisfies RegistrationResponse;
  },

  async login(payload: { email: string; password: string }) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: payload.email.trim().toLowerCase(),
      password: payload.password,
    });

    if (error) {
      throw toError(error, 'N?o foi poss?vel entrar.');
    }

    if (!data.user) {
      throw new Error('N?o foi poss?vel validar sua conta.');
    }

    const user = await materializeAuthUser(data.user);
    return {
      user,
    } satisfies AuthSessionPayload;
  },

  async getSession() {
    const authUser = await selectAuthenticatedUser();
    if (!authUser) {
      throw new Error('Fa?a login para continuar.');
    }

    const user = await materializeAuthUser(authUser);
    return {
      user,
    } satisfies AuthSessionPayload;
  },

  async logout() {
    const { error } = await supabase.auth.signOut();
    if (error) {
      throw toError(error, 'N?o foi poss?vel encerrar a sess?o.');
    }

    return null;
  },

  async createContact(
    payload: Pick<ContactMessage, 'freelancerId' | 'freelancerName' | 'subject' | 'message'>,
  ) {
    const sessionUser = await requireSessionUser('client');
    const freelancerProfile = await selectProfileById(payload.freelancerId);
    if (!freelancerProfile || normalizeUserRole(freelancerProfile) !== 'freelancer') {
      throw new Error('Freelancer n?o encontrado.');
    }

    const freelancerDetails = await selectFreelancerProfileByUserId(payload.freelancerId);
    if (normalizeSubscriptionStatus(freelancerDetails?.subscription_status) !== 'active') {
      throw new Error('Este freelancer n?o est? dispon?vel para novos contatos.');
    }

    const existing = await unwrap(
      supabase
        .from('contacts')
        .select('*')
        .eq('client_user_id', sessionUser.id)
        .eq('freelancer_user_id', payload.freelancerId)
        .maybeSingle(),
      'N?o foi poss?vel localizar a conversa.',
    );

    let contactId: string;
    if (existing) {
      const existingContact = existing as ContactRow;

      await unwrap(
        supabase
          .from('contacts')
          .update({
            subject: payload.subject,
            status: 'Novo',
            updated_at: new Date().toISOString(),
          })
          .eq('id', existingContact.id),
        'N?o foi poss?vel atualizar a conversa.',
      );

      contactId = existingContact.id;
    } else {
      const inserted = (await unwrap(
        supabase
          .from('contacts')
          .insert({
            client_user_id: sessionUser.id,
            freelancer_user_id: payload.freelancerId,
            subject: payload.subject,
            status: 'Novo',
          })
          .select('*')
          .single(),
        'N?o foi poss?vel iniciar a conversa.',
      )) as ContactRow;

      contactId = inserted.id;
    }

    await unwrap(
      supabase.from('contact_messages').insert({
        body: payload.message,
        contact_id: contactId,
        sender_role: 'client',
        sender_user_id: sessionUser.id,
      }),
      'N?o foi poss?vel enviar sua mensagem.',
    );

    return loadContactById(contactId);
  },

  async sendContactMessage(contactId: string, payload: Pick<ContactMessage, 'message'>) {
    const sessionUser = await requireSessionUser();
    const contact = await loadContactById(contactId);
    const isParticipant =
      contact.clientId === sessionUser.id || contact.freelancerId === sessionUser.id;

    if (!isParticipant) {
      throw new Error('Voc? n?o pode responder esta conversa.');
    }

    await unwrap(
      supabase.from('contact_messages').insert({
        body: payload.message,
        contact_id: contactId,
        sender_role: sessionUser.role,
        sender_user_id: sessionUser.id,
      }),
      'N?o foi poss?vel enviar sua mensagem.',
    );

    await unwrap(
      supabase
        .from('contacts')
        .update({
          status: sessionUser.role === 'freelancer' ? 'Respondido' : 'Novo',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contactId),
      'N?o foi poss?vel atualizar a conversa.',
    );

    return loadContactById(contactId);
  },

  async uploadProfileAsset(kind: ProfileAssetKind, file: File) {
    const sessionUser = await requireSessionUser();
    const extension = inferProfileAssetExtension(file);
    if (!extension) {
      throw new Error('Envie uma imagem JPG, PNG, WEBP ou AVIF.');
    }

    const bucket = profileAssetBuckets[kind];
    const path = buildProfileAssetPath(sessionUser.id, kind, extension);

    await unwrap(
      supabase.storage.from(bucket).upload(path, file, {
        cacheControl: '3600',
        contentType: file.type || `image/${extension === 'jpg' ? 'jpeg' : extension}`,
        upsert: true,
      }),
      'N?o foi poss?vel enviar a imagem para o Storage.',
    );

    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    const publicUrl = data.publicUrl;

    if (kind === 'avatar') {
      await unwrap(
        supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', sessionUser.id),
        'A imagem foi enviada, mas n?o foi poss?vel atualizar o avatar.',
      );
    } else {
      await unwrap(
        supabase
          .from('freelancer_profiles')
          .update({ banner_url: publicUrl })
          .eq('user_id', sessionUser.id),
        'A imagem foi enviada, mas n?o foi poss?vel atualizar o banner.',
      );
    }

    return {
      kind,
      publicUrl,
      persisted: true,
    } satisfies ProfileAssetUploadResponse;
  },

  async getInbox() {
    const sessionUser = await requireSessionUser();
    const contacts = await loadContactsForUser(sessionUser.id);

    return {
      contacts,
    } satisfies ConversationInbox;
  },

  async getFreelancerDashboard(_init?: RequestInit) {
    const sessionUser = await requireSessionUser('freelancer');
    const [profile, freelancerRow, contacts] = await Promise.all([
      selectProfileById(sessionUser.id),
      selectFreelancerProfileByUserId(sessionUser.id),
      loadContactsForUser(sessionUser.id),
    ]);

    if (!profile) {
      throw new Error('Conta freelancer n?o encontrada.');
    }

    const messagesReceived = contacts.reduce((total, contact) => {
      return total + contact.messages.filter((message) => message.senderRole === 'client').length;
    }, 0);

    return {
      profile: buildFreelancer(profile, freelancerRow),
      subscription: buildFreelancerSubscription(freelancerRow),
      metrics: {
        profileViews:
          typeof freelancerRow?.profile_views === 'number' ? freelancerRow.profile_views : 0,
        contactClicks: contacts.length,
        messagesReceived,
      },
      recentContacts: contacts.slice(0, 5),
      account: {
        email: profile.email,
        phone: normalizeText(profile.phone) ?? '',
        hasCnpj: freelancerRow?.has_cnpj === true,
      },
    } satisfies FreelancerDashboard;
  },

  async getOwnFreelancerLocation() {
    const sessionUser = await requireSessionUser('freelancer');
    const [profile, freelancerRow] = await Promise.all([
      selectProfileById(sessionUser.id),
      selectFreelancerProfileByUserId(sessionUser.id),
    ]);

    return {
      cep: sanitizeCep(freelancerRow?.cep ?? ''),
      city:
        normalizeText(freelancerRow?.city) ??
        normalizeText(profile?.city) ??
        '',
      state:
        normalizeText(freelancerRow?.state) ??
        normalizeText(profile?.state) ??
        '',
    };
  },

  async getOwnClientLocation() {
    const sessionUser = await requireSessionUser('client');
    const [profile, clientRow] = await Promise.all([
      selectProfileById(sessionUser.id),
      selectClientProfileByUserId(sessionUser.id),
    ]);

    return {
      cep: sanitizeCep(clientRow?.cep ?? ''),
      city: normalizeText(profile?.city) ?? '',
      state: normalizeText(profile?.state) ?? '',
    };
  },

  async updateFreelancerLocation(payload: { cep: string; city: string; state: string }) {
    const sessionUser = await requireSessionUser('freelancer');
    const cep = sanitizeCep(payload.cep);
    const city = normalizeText(payload.city);
    const state = normalizeText(payload.state)?.toUpperCase();

    if (cep.length !== 8) {
      throw new Error('Informe um CEP v?lido com 8 d?gitos.');
    }

    if (!city || !state) {
      throw new Error('Estado e cidade precisam estar preenchidos para salvar o CEP.');
    }

    await unwrap(
      supabase
        .from('freelancer_profiles')
        .update({
          cep,
          city,
          state,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', sessionUser.id),
      'N?o foi poss?vel salvar a localiza??o do freelancer.',
    );

    await unwrap(
      supabase
        .from('profiles')
        .update({
          city,
          state,
          updated_at: new Date().toISOString(),
        })
        .eq('id', sessionUser.id),
      'Não foi possível atualizar o estado e a cidade do perfil principal.',
    );

    return {
      cep,
      city,
      state,
    };
  },

  async getClientDashboard(init?: RequestInit) {
    const sessionUser = await requireSessionUser('client');
    const [profile, contacts, freelancers] = await Promise.all([
      selectProfileById(sessionUser.id),
      loadContactsForUser(sessionUser.id),
      listPublicFreelancers(init),
    ]);

    if (!profile) {
      throw new Error('Conta de cliente n?o encontrada.');
    }

    await selectClientProfileByUserId(sessionUser.id);

    return {
      profile: buildClientProfile(profile),
      favorites: freelancers.slice(0, 3),
      recentContacts: contacts.slice(0, 5),
      notifications: [
        'Sua conversa foi registrada no chat interno da plataforma.',
        'Novas respostas aparecem direto na central de mensagens.',
        'Toda a comunica??o oficial entre cliente e freelancer fica dentro do site.',
      ],
    } satisfies ClientDashboard;
  },
};
