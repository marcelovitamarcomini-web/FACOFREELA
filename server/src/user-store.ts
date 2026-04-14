import type {
  ClientDashboard,
  ClientProfile,
  ConversationInbox,
  Freelancer,
  FreelancerDashboard,
  FreelancerPlanTier,
  PortfolioItem,
  SessionUser,
  SubscriptionPlan,
  SubscriptionStatus,
  UserRole,
} from '../../shared/contracts.js';
import {
  categories,
  freelancerPlanCatalog,
  getFreelancerPlanPrice,
} from '../../shared/contracts.js';
import {
  listContactsByClientIdentity,
  listContactsByFreelancerIdentity,
  recordFreelancerProfileViewByIdentity,
} from './data.js';
import { createSupabaseUserClient, getSupabaseServerReadClient } from './supabase.js';

type SupabaseProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  phone: string | null;
  phone_normalized?: string | null;
  user_type: UserRole | 'admin' | null;
  avatar_url: string | null;
  bio: string | null;
  city: string | null;
  state: string | null;
  created_at: string;
  updated_at: string;
};

type SupabaseClientProfileRow = {
  id: string;
  user_id: string;
  cep: string | null;
  company_name: string | null;
  document_number: string | null;
  contact_name: string | null;
  company_description: string | null;
  created_at: string;
  updated_at: string;
};

type DatabaseExperienceLevel = 'junior' | 'pleno' | 'senior' | 'especialista';
type DatabaseAvailabilityStatus = 'available' | 'busy' | 'unavailable';

type SupabaseFreelancerProfileRow = {
  id: string;
  user_id: string;
  cep: string | null;
  city: string | null;
  state: string | null;
  professional_title: string | null;
  skills: string[] | null;
  experience_level: DatabaseExperienceLevel | null;
  portfolio_url: string | null;
  banner_url: string | null;
  hourly_rate: number | null;
  availability_status: DatabaseAvailabilityStatus | null;
  rating_average: number | null;
  total_reviews: number | null;
  created_at: string;
  updated_at: string;
  category: string | null;
  summary: string | null;
  description: string | null;
  years_experience: number | null;
  linkedin_url: string | null;
  website_url: string | null;
  whatsapp: string | null;
  subscription_tier: FreelancerPlanTier | null;
  subscription_status: SubscriptionStatus | null;
  subscription_started_at: string | null;
  subscription_ends_at: string | null;
  profile_views: number | null;
};

type UserLookup = {
  user: SessionUser;
  email: string;
  source: 'supabase';
};

type ClientRecord = {
  profile: ClientProfile;
};

type FreelancerRecord = {
  email: string;
  phone: string;
  profile: Freelancer;
  subscription: SubscriptionPlan;
  metrics: FreelancerDashboard['metrics'];
};

export type ProfileWriteResult =
  | { ok: true }
  | {
      ok: false;
      message: string;
      reason: 'duplicate_email' | 'duplicate_phone' | 'unknown';
    };

type SupabaseUserBundle =
  | {
      profile: SupabaseProfileRow;
      clientProfile: SupabaseClientProfileRow | null;
      freelancerProfile: SupabaseFreelancerProfileRow | null;
    }
  | null;

const supabase = getSupabaseServerReadClient();
const defaultFreelancerAvatar =
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=400&q=80';
const defaultFreelancerBanner = '/banner_geral.png';
const legacyFreelancerBannerUrls = new Set([
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80',
  '/banner_geral.png',
]);

function getSupabaseQueryClient(accessToken?: string) {
  if (accessToken) {
    return createSupabaseUserClient(accessToken) ?? supabase;
  }

  return supabase;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePhoneDigits(phone: string): string {
  return phone.replace(/\D/g, '');
}

function normalizeOptionalText(value?: string | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
}

function uniqueTextList(values: Array<string | undefined | null>) {
  return [...new Set(values.map((value) => normalizeOptionalText(value)).filter(Boolean))] as string[];
}

function normalizeCategory(value?: string | null): Freelancer['category'] | undefined {
  return categories.includes(value as Freelancer['category']) ? (value as Freelancer['category']) : undefined;
}

function normalizeSubscriptionTier(value?: string | null): FreelancerPlanTier {
  return value === 'booster' ? 'booster' : 'normal';
}

function normalizeSubscriptionStatus(value?: string | null): SubscriptionStatus {
  return value === 'pending' ||
    value === 'past_due' ||
    value === 'expired' ||
    value === 'canceled' ||
    value === 'active'
    ? value
    : 'active';
}

function mapProfileWriteError(
  error: { code?: string | null; message?: string | null } | null | undefined,
): ProfileWriteResult {
  const message = error?.message ?? 'Nao foi possivel salvar os dados principais da conta.';
  if (error?.code === '23505') {
    const normalizedMessage = message.toLowerCase();
    if (normalizedMessage.includes('profiles_email_key')) {
      return {
        ok: false,
        message: 'Ja existe uma conta com este e-mail.',
        reason: 'duplicate_email',
      };
    }

    if (normalizedMessage.includes('profiles_phone_normalized_key')) {
      return {
        ok: false,
        message: 'Ja existe uma conta com este telefone.',
        reason: 'duplicate_phone',
      };
    }
  }

  return {
    ok: false,
    message,
    reason: 'unknown',
  };
}

function normalizeFreelancerBannerUrl(value?: string | null): string | undefined {
  const normalized = normalizeOptionalText(value);
  if (!normalized || legacyFreelancerBannerUrls.has(normalized)) {
    return undefined;
  }

  return normalized;
}

function buildLocation(city?: string | null, state?: string | null): string {
  return [city?.trim(), state?.trim()].filter(Boolean).join(', ');
}

function buildDisplayName(profile?: SupabaseProfileRow | null): string {
  return profile?.full_name?.trim() || profile?.email || 'Usuario';
}

function normalizeUserRole(profile?: SupabaseProfileRow | null): UserRole | undefined {
  return profile?.user_type === 'client' || profile?.user_type === 'freelancer'
    ? profile.user_type
    : undefined;
}

function inferUserRoleFromBundle(
  bundle: Exclude<SupabaseUserBundle, null>,
  fallbackRole?: UserRole,
): UserRole | undefined {
  const explicitRole = normalizeUserRole(bundle.profile);
  if (explicitRole) {
    return explicitRole;
  }

  if (bundle.clientProfile && !bundle.freelancerProfile) {
    return 'client';
  }

  if (bundle.freelancerProfile && !bundle.clientProfile) {
    return 'freelancer';
  }

  return fallbackRole;
}

function buildSessionUser(profile: SupabaseProfileRow, role: UserRole): SessionUser {
  return {
    id: profile.id,
    name: buildDisplayName(profile),
    role,
  };
}

function buildSessionUserFromBundle(
  bundle: Exclude<SupabaseUserBundle, null>,
  fallbackRole?: UserRole,
): SessionUser | undefined {
  const role = inferUserRoleFromBundle(bundle, fallbackRole);
  if (!role) {
    return undefined;
  }

  return buildSessionUser(bundle.profile, role);
}

export function createPublicSlug(name: string, id: string): string {
  const base = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  return `${base || 'freelancer'}-${id.slice(0, 8)}`;
}

function defaultPortfolio(url: string, title = 'Portfolio principal'): PortfolioItem[] {
  return [
    {
      title,
      description: 'Link principal informado no perfil do freelancer.',
      url,
    },
  ];
}

function defaultYearsExperience(experienceLevel: Freelancer['experienceLevel']): number {
  switch (experienceLevel) {
    case 'Júnior':
      return 2;
    case 'Sênior':
      return 8;
    case 'Pleno':
    default:
      return 5;
  }
}

function normalizeExperienceLabel(
  value?: string | Freelancer['experienceLevel'] | null,
): Freelancer['experienceLevel'] | undefined {
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

function fromDatabaseExperienceLevel(
  value: DatabaseExperienceLevel | null | undefined,
): Freelancer['experienceLevel'] {
  return value === 'junior' ? 'Júnior' : value === 'senior' || value === 'especialista' ? 'Sênior' : 'Pleno';
}

function toDatabaseExperienceLevel(
  value: Freelancer['experienceLevel'] | undefined,
): DatabaseExperienceLevel | null {
  const normalized = normalizeExperienceLabel(value);
  if (normalized === 'Júnior') return 'junior';
  if (normalized === 'Sênior') return 'senior';
  if (normalized === 'Pleno') return 'pleno';
  return null;
}

function availabilityTextFromStatus(value: DatabaseAvailabilityStatus | null | undefined): string {
  if (value === 'available') return 'Disponivel para novos projetos.';
  if (value === 'busy') return 'Agenda ocupada no momento.';
  if (value === 'unavailable') return 'Indisponivel para novos projetos.';
  return 'Perfil ativo na plataforma.';
}

function toDatabaseAvailabilityStatus(value?: string): DatabaseAvailabilityStatus | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  if (normalized.includes('indispon')) return 'unavailable';
  if (normalized.includes('ocupad') || normalized.includes('agenda')) return 'busy';
  return 'available';
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
    haystack.includes('motion') ||
    haystack.includes('foto') ||
    haystack.includes('social')
  ) {
    return 'Design e Vídeo';
  }

  if (
    haystack.includes('marketing') ||
    haystack.includes('ads') ||
    haystack.includes('copy') ||
    haystack.includes('seo') ||
    haystack.includes('conteudo') ||
    haystack.includes('reda') ||
    haystack.includes('trad') ||
    haystack.includes('vendas')
  ) {
    return 'Marketing e Redes';
  }

  if (
    haystack.includes('react') ||
    haystack.includes('node') ||
    haystack.includes('dev') ||
    haystack.includes('program') ||
    haystack.includes('site') ||
    haystack.includes('app') ||
    haystack.includes('software') ||
    haystack.includes('sistema') ||
    haystack.includes('automa')
  ) {
    return 'Sites e Tecnologia';
  }

  return 'Projetos e Consultoria';
}

function buildClientProfile(profile: SupabaseProfileRow): ClientProfile {
  return {
    id: profile.id,
    name: buildDisplayName(profile),
    email: profile.email,
    phone: normalizeOptionalText(profile.phone) ?? '',
    avatarUrl: normalizeOptionalText(profile.avatar_url),
    location: buildLocation(profile.city, profile.state),
    createdAt: profile.created_at,
  };
}

function buildFreelancerSubscription(
  freelancerProfile?: SupabaseFreelancerProfileRow | null,
): SubscriptionPlan {
  const tier = normalizeSubscriptionTier(freelancerProfile?.subscription_tier);

  return {
    tier,
    name: freelancerPlanCatalog[tier].name,
    priceMonthly: getFreelancerPlanPrice(tier),
    status: normalizeSubscriptionStatus(freelancerProfile?.subscription_status),
    startedAt: freelancerProfile?.subscription_started_at ?? new Date().toISOString(),
    endsAt:
      freelancerProfile?.subscription_ends_at ??
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

function buildFreelancer(
  profile: SupabaseProfileRow,
  freelancerProfile?: SupabaseFreelancerProfileRow | null,
): Freelancer {
  const profession = normalizeOptionalText(freelancerProfile?.professional_title) ?? 'Freelancer';
  const storedCategory = normalizeCategory(freelancerProfile?.category);
  const category = storedCategory ?? inferCategory(profession, freelancerProfile?.skills ?? []);
  const experienceLevel = fromDatabaseExperienceLevel(freelancerProfile?.experience_level);
  const portfolioUrl =
    normalizeOptionalText(freelancerProfile?.portfolio_url) ??
    normalizeOptionalText(freelancerProfile?.website_url) ??
    'https://www.linkedin.com/';
  const subscriptionTier = normalizeSubscriptionTier(freelancerProfile?.subscription_tier);

  return {
    id: profile.id,
    slug: createPublicSlug(buildDisplayName(profile), profile.id),
    name: buildDisplayName(profile),
    profession,
    subscriptionTier,
    category,
    summary:
      normalizeOptionalText(freelancerProfile?.summary) ??
      normalizeOptionalText(profile.bio) ??
      'Perfil profissional em configuracao.',
    description:
      normalizeOptionalText(freelancerProfile?.description) ??
      normalizeOptionalText(freelancerProfile?.summary) ??
      normalizeOptionalText(profile.bio) ??
      'O perfil ainda esta sendo completado com mais detalhes de atuacao.',
    location: buildLocation(
      freelancerProfile?.city ?? profile.city,
      freelancerProfile?.state ?? profile.state,
    ),
    experienceLevel,
    yearsExperience:
      typeof freelancerProfile?.years_experience === 'number'
        ? freelancerProfile.years_experience
        : defaultYearsExperience(experienceLevel),
    skills: uniqueTextList([
      ...(freelancerProfile?.skills ?? []),
      profession,
      category,
      'Atendimento direto',
    ]),
    portfolio: defaultPortfolio(portfolioUrl),
    avatarUrl: normalizeOptionalText(profile.avatar_url) ?? defaultFreelancerAvatar,
    linkedinUrl: normalizeOptionalText(freelancerProfile?.linkedin_url),
    websiteUrl:
      normalizeOptionalText(freelancerProfile?.website_url) ??
      normalizeOptionalText(freelancerProfile?.portfolio_url),
    whatsapp:
      normalizeOptionalText(freelancerProfile?.whatsapp) ??
      normalizePhoneDigits(profile.phone ?? '') ??
      '',
    verified: subscriptionTier === 'booster',
    availability: availabilityTextFromStatus(freelancerProfile?.availability_status),
    memberSince: profile.created_at,
    bannerUrl: normalizeFreelancerBannerUrl(freelancerProfile?.banner_url) ?? defaultFreelancerBanner,
  };
}

async function selectProfileByEmail(
  email: string,
  accessToken?: string,
): Promise<SupabaseProfileRow | null> {
  const client = getSupabaseQueryClient(accessToken);
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from('profiles')
    .select('id,full_name,email,phone,phone_normalized,user_type,avatar_url,bio,city,state,created_at,updated_at')
    .eq('email', normalizeEmail(email))
    .maybeSingle();

  if (error) {
    return null;
  }

  return data as SupabaseProfileRow | null;
}

async function selectProfileByPhone(
  phone: string,
  accessToken?: string,
): Promise<SupabaseProfileRow | null> {
  const client = getSupabaseQueryClient(accessToken);
  const normalizedPhone = normalizePhoneDigits(phone);
  if (!client || !normalizedPhone) {
    return null;
  }

  const byNormalized = await client
    .from('profiles')
    .select('id,full_name,email,phone,phone_normalized,user_type,avatar_url,bio,city,state,created_at,updated_at')
    .eq('phone_normalized', normalizedPhone)
    .maybeSingle();

  if (!byNormalized.error) {
    return byNormalized.data as SupabaseProfileRow | null;
  }

  const fallback = await client
    .from('profiles')
    .select('id,full_name,email,phone,user_type,avatar_url,bio,city,state,created_at,updated_at')
    .not('phone', 'is', null);

  if (fallback.error || !fallback.data) {
    return null;
  }

  const matched = (fallback.data as SupabaseProfileRow[]).find(
    (profile) => normalizePhoneDigits(profile.phone ?? '') === normalizedPhone,
  );

  return matched ?? null;
}

async function selectProfileById(
  id: string,
  accessToken?: string,
): Promise<SupabaseProfileRow | null> {
  const client = getSupabaseQueryClient(accessToken);
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from('profiles')
    .select('id,full_name,email,phone,phone_normalized,user_type,avatar_url,bio,city,state,created_at,updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data as SupabaseProfileRow | null;
}

async function selectClientProfileByUserId(
  userId: string,
  accessToken?: string,
): Promise<SupabaseClientProfileRow | null> {
  const client = getSupabaseQueryClient(accessToken);
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from('client_profiles')
    .select(
      'id,user_id,cep,company_name,document_number,contact_name,company_description,created_at,updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data as SupabaseClientProfileRow | null;
}

async function selectFreelancerProfileByUserId(
  userId: string,
  accessToken?: string,
): Promise<SupabaseFreelancerProfileRow | null> {
  const client = getSupabaseQueryClient(accessToken);
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from('freelancer_profiles')
    .select(
      'id,user_id,cep,city,state,professional_title,skills,experience_level,portfolio_url,banner_url,hourly_rate,availability_status,rating_average,total_reviews,created_at,updated_at,category,summary,description,years_experience,linkedin_url,website_url,whatsapp,subscription_tier,subscription_status,subscription_started_at,subscription_ends_at,profile_views',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data as SupabaseFreelancerProfileRow | null;
}

async function selectProfilesByUserType(role: UserRole): Promise<SupabaseProfileRow[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,email,phone,phone_normalized,user_type,avatar_url,bio,city,state,created_at,updated_at')
    .eq('user_type', role)
    .order('created_at', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data as SupabaseProfileRow[];
}

async function selectFreelancerProfilesByUserIds(
  userIds: string[],
): Promise<Map<string, SupabaseFreelancerProfileRow>> {
  if (!supabase || userIds.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('freelancer_profiles')
    .select(
      'id,user_id,cep,city,state,professional_title,skills,experience_level,portfolio_url,banner_url,hourly_rate,availability_status,rating_average,total_reviews,created_at,updated_at,category,summary,description,years_experience,linkedin_url,website_url,whatsapp,subscription_tier,subscription_status,subscription_started_at,subscription_ends_at,profile_views',
    )
    .in('user_id', userIds);

  if (error || !data) {
    return new Map();
  }

  return new Map((data as SupabaseFreelancerProfileRow[]).map((item) => [item.user_id, item]));
}

async function loadSupabaseUserBundle(id: string, accessToken?: string): Promise<SupabaseUserBundle> {
  const profile = await selectProfileById(id, accessToken);
  if (!profile) {
    return null;
  }

  return {
    profile,
    clientProfile: await selectClientProfileByUserId(profile.id, accessToken),
    freelancerProfile: await selectFreelancerProfileByUserId(profile.id, accessToken),
  };
}

async function loadSupabaseUserBundleByEmail(
  email: string,
  accessToken?: string,
): Promise<SupabaseUserBundle> {
  const profile = await selectProfileByEmail(email, accessToken);
  if (!profile) {
    return null;
  }

  return loadSupabaseUserBundle(profile.id, accessToken);
}

async function loadSupabaseUserBundleByPhone(
  phone: string,
  accessToken?: string,
): Promise<SupabaseUserBundle> {
  const profile = await selectProfileByPhone(phone, accessToken);
  if (!profile) {
    return null;
  }

  return loadSupabaseUserBundle(profile.id, accessToken);
}

async function buildFreelancerRecord(
  bundle: Exclude<SupabaseUserBundle, null>,
): Promise<FreelancerRecord> {
  const contacts = await listContactsByFreelancerIdentity({
    freelancerId: bundle.profile.id,
  });
  const subscription = buildFreelancerSubscription(bundle.freelancerProfile);

  return {
    email: bundle.profile.email,
    phone: normalizeOptionalText(bundle.profile.phone) ?? '',
    profile: buildFreelancer(bundle.profile, bundle.freelancerProfile),
    subscription,
    metrics: {
      profileViews:
        typeof bundle.freelancerProfile?.profile_views === 'number'
          ? bundle.freelancerProfile.profile_views
          : 0,
      contactClicks: contacts.length,
      messagesReceived: contacts.reduce((total, contact) => {
        return total + contact.messages.filter((message) => message.senderRole === 'client').length;
      }, 0),
    },
  };
}

export async function createSupabaseUserProfiles(input: {
  id: string;
  email: string;
  role: UserRole;
  fullName: string;
  accessToken: string;
  avatarUrl?: string;
  phone?: string;
  city?: string;
  state?: string;
  bio?: string;
  freelancer?: {
    cep?: string;
    professionalTitle?: string;
    experienceLevel?: Freelancer['experienceLevel'];
    skills?: string[];
    portfolioUrl?: string;
    bannerUrl?: string;
    availabilityStatus?: string;
    ratingAverage?: number | null;
    totalReviews?: number | null;
    category?: string;
    summary?: string;
    description?: string;
    yearsExperience?: number;
    linkedinUrl?: string;
    websiteUrl?: string;
    whatsapp?: string;
    subscriptionTier?: FreelancerPlanTier;
    subscriptionStatus?: SubscriptionStatus;
  };
  client?: {
    cep?: string;
    companyName?: string;
    documentNumber?: string;
    contactName?: string;
    companyDescription?: string;
  };
}): Promise<ProfileWriteResult> {
  const client = createSupabaseUserClient(input.accessToken);
  if (!client) {
    return {
      ok: false,
      message: 'Contexto autenticado indisponivel para materializar o perfil.',
      reason: 'unknown',
    };
  }

  const profilePayload: Record<string, unknown> = {
    id: input.id,
    full_name: input.fullName,
    email: normalizeEmail(input.email),
    user_type: input.role,
  };

  const normalizedPhone = normalizeOptionalText(input.phone);
  if (normalizedPhone) profilePayload.phone = normalizedPhone;

  const normalizedAvatarUrl = normalizeOptionalText(input.avatarUrl);
  if (normalizedAvatarUrl) profilePayload.avatar_url = normalizedAvatarUrl;

  const normalizedBio = normalizeOptionalText(input.bio);
  if (normalizedBio) profilePayload.bio = normalizedBio;

  const normalizedCity = normalizeOptionalText(input.city);
  if (normalizedCity) profilePayload.city = normalizedCity;

  const normalizedState = normalizeOptionalText(input.state);
  if (normalizedState) profilePayload.state = normalizedState;

  const profileResult = await client.from('profiles').upsert(profilePayload, { onConflict: 'id' });
  if (profileResult.error) {
    return mapProfileWriteError(profileResult.error);
  }

  if (input.role === 'client') {
    const clientPayload: Record<string, unknown> = {
      user_id: input.id,
      contact_name: normalizeOptionalText(input.client?.contactName) ?? input.fullName,
    };

    const normalizedCep = normalizeOptionalText(input.client?.cep)?.replace(/\D/g, '');
    if (normalizedCep) clientPayload.cep = normalizedCep;

    const normalizedCompanyName = normalizeOptionalText(input.client?.companyName);
    if (normalizedCompanyName) clientPayload.company_name = normalizedCompanyName;

    const normalizedDocumentNumber = normalizeOptionalText(input.client?.documentNumber);
    if (normalizedDocumentNumber) clientPayload.document_number = normalizedDocumentNumber;

    const normalizedCompanyDescription = normalizeOptionalText(input.client?.companyDescription);
    if (normalizedCompanyDescription) clientPayload.company_description = normalizedCompanyDescription;

    const clientResult = await client
      .from('client_profiles')
      .upsert(clientPayload, { onConflict: 'user_id' });

    if (clientResult.error) {
      return {
        ok: false,
        message: clientResult.error.message,
        reason: 'unknown',
      };
    }

    return { ok: true };
  }

  const experienceLevel = input.freelancer?.experienceLevel ?? 'Pleno';
  const profession = normalizeOptionalText(input.freelancer?.professionalTitle) ?? 'Freelancer';
  const category =
    normalizeCategory(input.freelancer?.category) ??
    inferCategory(profession, input.freelancer?.skills ?? []);
  const summary =
    normalizeOptionalText(input.freelancer?.summary) ??
    normalizedBio ??
    'Perfil profissional em configuracao.';
  const description = normalizeOptionalText(input.freelancer?.description) ?? summary;
  const portfolioUrl =
    normalizeOptionalText(input.freelancer?.portfolioUrl) ??
    normalizeOptionalText(input.freelancer?.websiteUrl) ??
    'https://www.linkedin.com/';
  const freelancerPayload: Record<string, unknown> = {
    user_id: input.id,
    professional_title: profession,
    skills:
      Array.isArray(input.freelancer?.skills) && input.freelancer.skills.length > 0
        ? input.freelancer.skills
        : uniqueTextList([profession, category, 'Atendimento direto']),
    experience_level: toDatabaseExperienceLevel(experienceLevel),
    portfolio_url: portfolioUrl,
    availability_status: toDatabaseAvailabilityStatus(input.freelancer?.availabilityStatus) ?? 'available',
    rating_average: typeof input.freelancer?.ratingAverage === 'number' ? input.freelancer.ratingAverage : 0,
    total_reviews: typeof input.freelancer?.totalReviews === 'number' ? input.freelancer.totalReviews : 0,
    category,
    summary,
    description,
    years_experience:
      typeof input.freelancer?.yearsExperience === 'number'
        ? input.freelancer.yearsExperience
        : defaultYearsExperience(experienceLevel),
    linkedin_url: normalizeOptionalText(input.freelancer?.linkedinUrl),
    website_url: normalizeOptionalText(input.freelancer?.websiteUrl),
    whatsapp: normalizeOptionalText(input.freelancer?.whatsapp) ?? normalizePhoneDigits(normalizedPhone ?? ''),
    subscription_tier: input.freelancer?.subscriptionTier ?? 'normal',
    subscription_status: input.freelancer?.subscriptionStatus ?? 'active',
  };

  const normalizedFreelancerCep = normalizeOptionalText(input.freelancer?.cep)?.replace(/\D/g, '');
  if (normalizedFreelancerCep) freelancerPayload.cep = normalizedFreelancerCep;
  if (normalizedCity) freelancerPayload.city = normalizedCity;
  if (normalizedState) freelancerPayload.state = normalizedState;

  const normalizedBannerUrl = normalizeOptionalText(input.freelancer?.bannerUrl);
  if (normalizedBannerUrl) freelancerPayload.banner_url = normalizedBannerUrl;

  const freelancerResult = await client
    .from('freelancer_profiles')
    .upsert(freelancerPayload, { onConflict: 'user_id' });

  if (freelancerResult.error) {
    return {
      ok: false,
      message: freelancerResult.error.message,
      reason: 'unknown',
    };
  }

  return { ok: true };
}

export async function updateFreelancerSubscriptionState(input: {
  endsAt?: string;
  startedAt?: string;
  status: SubscriptionStatus;
  tier?: FreelancerPlanTier;
  userId: string;
}) {
  const client = getSupabaseServerReadClient();
  if (!client) {
    return false;
  }

  const patch: Record<string, unknown> = {
    subscription_status: input.status,
    updated_at: new Date().toISOString(),
  };

  if (input.startedAt) {
    patch.subscription_started_at = input.startedAt;
  }

  if (input.endsAt) {
    patch.subscription_ends_at = input.endsAt;
  }

  if (input.tier) {
    patch.subscription_tier = input.tier;
  }

  const { error } = await client
    .from('freelancer_profiles')
    .update(patch)
    .eq('user_id', input.userId);

  return !error;
}

export async function updateSupabaseProfileAvatarUrl(input: {
  userId: string;
  accessToken: string;
  avatarUrl: string;
}): Promise<boolean> {
  const client = createSupabaseUserClient(input.accessToken);
  if (!client) {
    return false;
  }

  const normalizedAvatarUrl = normalizeOptionalText(input.avatarUrl);
  if (!normalizedAvatarUrl) {
    return false;
  }

  const { error } = await client
    .from('profiles')
    .update({ avatar_url: normalizedAvatarUrl })
    .eq('id', input.userId);

  return !error;
}

export async function updateSupabaseFreelancerBannerUrl(input: {
  userId: string;
  accessToken: string;
  bannerUrl: string;
}): Promise<boolean> {
  const client = createSupabaseUserClient(input.accessToken);
  if (!client) {
    return false;
  }

  const normalizedBannerUrl = normalizeOptionalText(input.bannerUrl);
  if (!normalizedBannerUrl) {
    return false;
  }

  const { error } = await client
    .from('freelancer_profiles')
    .update({ banner_url: normalizedBannerUrl })
    .eq('user_id', input.userId);

  return !error;
}

export async function ensureSupabaseUserSubtypeMaterialized(input: {
  userId: string;
  accessToken: string;
  fallbackRole?: UserRole;
  fallbackName?: string;
  fallbackEmail?: string;
}): Promise<UserRole | undefined> {
  const client = createSupabaseUserClient(input.accessToken);
  if (!client) {
    return input.fallbackRole;
  }

  const { data: profile, error: profileError } = await client
    .from('profiles')
    .select('id,full_name,email,phone,phone_normalized,user_type,avatar_url,bio,city,state,created_at,updated_at')
    .eq('id', input.userId)
    .maybeSingle<SupabaseProfileRow>();

  if (profileError || !profile) {
    return input.fallbackRole;
  }

  const resolvedRole = normalizeUserRole(profile) ?? input.fallbackRole;
  if (!resolvedRole) {
    return undefined;
  }

  const profilePatch: Record<string, unknown> = {};
  if (!normalizeUserRole(profile)) {
    profilePatch.user_type = resolvedRole;
  }
  if (!profile.full_name?.trim() && input.fallbackName) {
    profilePatch.full_name = input.fallbackName;
  }
  if (!profile.email?.trim() && input.fallbackEmail) {
    profilePatch.email = normalizeEmail(input.fallbackEmail);
  }

  if (Object.keys(profilePatch).length > 0) {
    await client.from('profiles').update(profilePatch).eq('id', input.userId);
  }

  if (resolvedRole === 'client') {
    const { data: clientProfile, error: clientProfileError } = await client
      .from('client_profiles')
      .select('id')
      .eq('user_id', input.userId)
      .maybeSingle<{ id: string }>();

    if (!clientProfileError && !clientProfile) {
      await client.from('client_profiles').upsert(
        {
          user_id: input.userId,
          contact_name: profile.full_name?.trim() || input.fallbackName || null,
        },
        { onConflict: 'user_id' },
      );
    }

    return resolvedRole;
  }

  const { data: freelancerProfile, error: freelancerProfileError } = await client
    .from('freelancer_profiles')
    .select('id')
    .eq('user_id', input.userId)
    .maybeSingle<{ id: string }>();

  if (!freelancerProfileError && !freelancerProfile) {
    await client.from('freelancer_profiles').upsert(
      {
        user_id: input.userId,
        professional_title: 'Freelancer',
        skills: ['Atendimento direto'],
        experience_level: 'pleno',
        portfolio_url: 'https://www.linkedin.com/',
        availability_status: 'available',
        rating_average: 0,
        total_reviews: 0,
        category: 'Projetos e Consultoria',
        summary: 'Perfil profissional em configuracao.',
        description: 'Perfil profissional em configuracao.',
        years_experience: 5,
        subscription_tier: 'normal',
        subscription_status: 'active',
      },
      { onConflict: 'user_id' },
    );
  }

  return resolvedRole;
}

export async function findSessionUserByEmail(
  email: string,
  accessToken?: string,
): Promise<UserLookup | undefined> {
  const bundle = await loadSupabaseUserBundleByEmail(email, accessToken);
  const sessionUser = bundle ? buildSessionUserFromBundle(bundle) : undefined;
  if (!bundle || !sessionUser) {
    return undefined;
  }

  return {
    user: sessionUser,
    email: bundle.profile.email,
    source: 'supabase',
  };
}

export async function findSessionUserByPhone(
  phone: string,
  accessToken?: string,
): Promise<UserLookup | undefined> {
  const bundle = await loadSupabaseUserBundleByPhone(phone, accessToken);
  const sessionUser = bundle ? buildSessionUserFromBundle(bundle) : undefined;
  if (!bundle || !sessionUser) {
    return undefined;
  }

  return {
    user: sessionUser,
    email: bundle.profile.email,
    source: 'supabase',
  };
}

export async function findSessionUserById(
  id: string,
  role?: UserRole,
  accessToken?: string,
): Promise<SessionUser | undefined> {
  const bundle = await loadSupabaseUserBundle(id, accessToken);
  return bundle ? buildSessionUserFromBundle(bundle, role) : undefined;
}

export async function findClientRecordById(
  id: string,
  accessToken?: string,
): Promise<ClientRecord | undefined> {
  const bundle = await loadSupabaseUserBundle(id, accessToken);
  if (!bundle || inferUserRoleFromBundle(bundle, 'client') !== 'client') {
    return undefined;
  }

  return {
    profile: buildClientProfile(bundle.profile),
  };
}

export async function findFreelancerRecordById(
  id: string,
  accessToken?: string,
): Promise<FreelancerRecord | undefined> {
  const bundle = await loadSupabaseUserBundle(id, accessToken);
  if (!bundle || inferUserRoleFromBundle(bundle, 'freelancer') !== 'freelancer') {
    return undefined;
  }

  return buildFreelancerRecord(bundle);
}

export async function listPublicFreelancers(): Promise<Freelancer[]> {
  const profiles = await selectProfilesByUserType('freelancer');
  if (profiles.length === 0) {
    return [];
  }

  const subtypeMap = await selectFreelancerProfilesByUserIds(profiles.map((profile) => profile.id));
  return profiles
    .map((profile) => buildFreelancer(profile, subtypeMap.get(profile.id) ?? null))
    .filter((freelancer) => {
      const row = subtypeMap.get(freelancer.id);
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

export async function recordFreelancerProfileView(slug: string): Promise<Freelancer | undefined> {
  const freelancers = await listPublicFreelancers();
  const freelancer = freelancers.find((item) => item.slug === slug);
  if (!freelancer) {
    return undefined;
  }

  await recordFreelancerProfileViewByIdentity({
    freelancerId: freelancer.id,
    freelancerSlug: freelancer.slug,
  });

  return freelancer;
}

export async function getClientDashboard(
  id: string,
  accessToken?: string,
): Promise<ClientDashboard | undefined> {
  const client = await findClientRecordById(id, accessToken);
  if (!client) {
    return undefined;
  }

  return {
    profile: client.profile,
    favorites: (await listPublicFreelancers()).slice(0, 3),
    recentContacts: [],
    notifications: [
      'O perfil agora e o ponto principal para avaliar o profissional antes do contato.',
      'O primeiro contato pode seguir por WhatsApp, site ou LinkedIn conforme o perfil.',
      'Sua conta continua util para organizar busca, favoritos e proximos passos.',
    ],
  };
}

export async function getFreelancerDashboard(
  id: string,
  accessToken?: string,
): Promise<FreelancerDashboard | undefined> {
  const freelancer = await findFreelancerRecordById(id, accessToken);
  if (!freelancer) {
    return undefined;
  }

  const recentContacts = (await listContactsByFreelancerIdentity({
    freelancerId: freelancer.profile.id,
    freelancerEmail: freelancer.email,
    freelancerName: freelancer.profile.name,
  })).slice(0, 5);

  return {
    profile: freelancer.profile,
    subscription: freelancer.subscription,
    metrics: {
      profileViews: freelancer.metrics.profileViews,
      contactClicks: freelancer.metrics.contactClicks,
      messagesReceived: freelancer.metrics.messagesReceived,
    },
    recentContacts,
    account: {
      email: freelancer.email,
      phone: freelancer.phone,
    },
  };
}

export async function getConversationInbox(
  id: string,
  role: UserRole,
  _accessToken?: string,
): Promise<ConversationInbox | undefined> {
  if (role === 'client') {
    const client = await findClientRecordById(id);
    if (!client) {
      return undefined;
    }

    return {
      contacts: await listContactsByClientIdentity({
        clientId: client.profile.id,
        clientEmail: client.profile.email,
        clientName: client.profile.name,
      }),
      seenMessageIds: {},
    };
  }

  const freelancer = await findFreelancerRecordById(id);
  if (!freelancer) {
    return undefined;
  }

  return {
    contacts: await listContactsByFreelancerIdentity({
      freelancerId: freelancer.profile.id,
      freelancerEmail: freelancer.email,
      freelancerName: freelancer.profile.name,
    }),
    seenMessageIds: {},
  };
}
