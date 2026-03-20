import type {
  ClientDashboard,
  ClientProfile,
  Freelancer,
  FreelancerDashboard,
  PortfolioItem,
  SessionUser,
  SubscriptionPlan,
  UserRole,
} from '../../shared/contracts.js';
import {
  categories,
  freelancerPlanCatalog,
  getFreelancerPlanPrice,
} from '../../shared/contracts.js';
import type { StoredClient, StoredFreelancer } from './data.js';
import {
  addClient as addLocalClientShadow,
  addFreelancer as addLocalFreelancerShadow,
  deleteSessionsByUserId,
  ensureUniqueFreelancerSlug as ensureLegacyFreelancerSlug,
  findClientRecordByEmail as findLegacyClientRecordByEmail,
  findClientRecordById as findLegacyClientRecordById,
  findFreelancerRecordByEmail as findLegacyFreelancerRecordByEmail,
  findFreelancerRecordById as findLegacyFreelancerRecordById,
  findSessionUserByEmail as findLegacySessionUserByEmail,
  getNextClientId as getLegacyNextClientId,
  getNextFreelancerId as getLegacyNextFreelancerId,
  listContactsByClientIdentity,
  listContactsByFreelancerIdentity,
  listPublicFreelancers as listLegacyPublicFreelancers,
  recordFreelancerProfileViewByIdentity,
  removeClientShadow as removeLocalClientShadow,
  removeFreelancerShadow as removeLocalFreelancerShadow,
} from './data.js';
import { createSupabaseUserClient, getSupabaseClient } from './supabase.js';

type SupabaseProfileRow = {
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

type SupabaseClientProfileRow = {
  id: string;
  user_id: string;
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
  professional_title: string | null;
  skills: string[] | null;
  experience_level: DatabaseExperienceLevel | null;
  portfolio_url: string | null;
  hourly_rate: number | null;
  availability_status: DatabaseAvailabilityStatus | null;
  rating_average: number | null;
  total_reviews: number | null;
  created_at: string;
  updated_at: string;
};

type UserLookup = {
  user: SessionUser;
  email: string;
  source: 'supabase' | 'legacy';
  passwordHash?: string;
};

type SupabaseUserBundle =
  | {
      profile: SupabaseProfileRow;
      clientProfile: SupabaseClientProfileRow | null;
      freelancerProfile: SupabaseFreelancerProfileRow | null;
    }
  | null;

const supabase = getSupabaseClient();
const defaultFreelancerAvatar =
  'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=400&q=80';
const defaultFreelancerBanner =
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80';
const supabaseManagedUserIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Block 1 canonical source of truth for user identity:
// - public.profiles
// - public.client_profiles
// - public.freelancer_profiles
//
// Any local data touched below is compatibility residue only. It remains for:
// - accounts blocked by email confirmation from getting an authenticated access token at sign-up
// - freelancer operational/showcase fields that do not belong to the Block 1 schema

type FreelancerOperationalResidue = Pick<
  StoredFreelancer,
  'email' | 'hasCnpj' | 'passwordHash' | 'phone' | 'subscription' | 'metrics'
>;

type FreelancerPresentationResidue = Pick<
  Freelancer,
  | 'slug'
  | 'category'
  | 'summary'
  | 'description'
  | 'yearsExperience'
  | 'portfolio'
  | 'linkedinUrl'
  | 'websiteUrl'
  | 'whatsapp'
  | 'availability'
  | 'memberSince'
  | 'bannerUrl'
>;

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isSupabaseManagedUserId(id: string): boolean {
  return supabaseManagedUserIdPattern.test(id);
}

function buildLocation(city?: string | null, state?: string | null): string {
  return [city?.trim(), state?.trim()].filter(Boolean).join(', ');
}

function fallbackName(profile: SupabaseProfileRow): string {
  return profile.full_name?.trim() || profile.email;
}

function getExplicitUserRole(profile: SupabaseProfileRow): UserRole | undefined {
  if (profile.user_type === 'client' || profile.user_type === 'freelancer') {
    return profile.user_type;
  }

  return undefined;
}

function inferLegacyUserRoleByEmail(email: string): UserRole | undefined {
  if (findLegacyClientRecordByEmail(email)) {
    return 'client';
  }

  if (findLegacyFreelancerRecordByEmail(email)) {
    return 'freelancer';
  }

  return undefined;
}

function inferUserRoleFromBundle(
  bundle: Exclude<SupabaseUserBundle, null>,
  fallbackRole?: UserRole,
): UserRole | undefined {
  const explicitRole = getExplicitUserRole(bundle.profile);
  if (explicitRole) {
    return explicitRole;
  }

  if (bundle.clientProfile && !bundle.freelancerProfile) {
    return 'client';
  }

  if (bundle.freelancerProfile && !bundle.clientProfile) {
    return 'freelancer';
  }

  return fallbackRole ?? inferLegacyUserRoleByEmail(bundle.profile.email);
}

function buildSessionUser(
  profile: SupabaseProfileRow,
  role: UserRole,
): SessionUser {
  return {
    id: profile.id,
    name: fallbackName(profile),
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

function defaultPortfolio(url: string, title = 'Portfólio principal'): PortfolioItem[] {
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
    case 'Pleno':
      return 5;
    case 'Sênior':
      return 8;
    default:
      return 0;
  }
}

function fromDatabaseExperienceLevel(
  value: DatabaseExperienceLevel | null | undefined,
): Freelancer['experienceLevel'] {
  switch (value) {
    case 'junior':
      return 'Júnior';
    case 'senior':
    case 'especialista':
      return 'Sênior';
    case 'pleno':
    default:
      return 'Pleno';
  }
}

function toDatabaseExperienceLevel(
  value: Freelancer['experienceLevel'] | undefined,
): DatabaseExperienceLevel | null {
  switch (value) {
    case 'Júnior':
      return 'junior';
    case 'Sênior':
      return 'senior';
    case 'Pleno':
      return 'pleno';
    default:
      return null;
  }
}

function availabilityTextFromStatus(
  value: DatabaseAvailabilityStatus | null | undefined,
): string {
  switch (value) {
    case 'available':
      return 'Disponível para novos projetos.';
    case 'busy':
      return 'Agenda ocupada no momento.';
    case 'unavailable':
      return 'Indisponível para novos projetos.';
    default:
      return 'Perfil ativo na plataforma.';
  }
}

function toDatabaseAvailabilityStatus(
  value?: string,
): DatabaseAvailabilityStatus | null {
  if (!value) {
    return null;
  }

  const normalized = value.toLowerCase();
  if (normalized.includes('indispon')) {
    return 'unavailable';
  }

  if (normalized.includes('ocupad') || normalized.includes('agenda')) {
    return 'busy';
  }

  return 'available';
}

function inferCategory(
  profession: string,
  skills: string[],
  legacyCategory?: Freelancer['category'],
): Freelancer['category'] {
  if (legacyCategory) {
    return legacyCategory;
  }

  const haystack = `${profession} ${skills.join(' ')}`.toLowerCase();
  if (haystack.includes('design') || haystack.includes('ux') || haystack.includes('ui')) {
    return 'Design';
  }

  if (
    haystack.includes('react') ||
    haystack.includes('node') ||
    haystack.includes('dev') ||
    haystack.includes('program')
  ) {
    return 'Programação';
  }

  if (haystack.includes('marketing') || haystack.includes('ads') || haystack.includes('copy')) {
    return 'Marketing Digital';
  }

  if (haystack.includes('vídeo') || haystack.includes('video') || haystack.includes('motion')) {
    return 'Edição de Vídeo';
  }

  if (haystack.includes('seo') || haystack.includes('reda') || haystack.includes('conteúdo')) {
    return 'Redação';
  }

  return categories[0];
}

function createDefaultSubscription(hasCnpj: boolean, tier: 'normal' | 'booster' = 'normal'): SubscriptionPlan {
  return {
    tier,
    name: freelancerPlanCatalog[tier].name,
    priceMonthly: getFreelancerPlanPrice(tier, hasCnpj),
    status: 'active',
    startedAt: new Date().toISOString(),
    endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

async function selectProfileByEmail(email: string): Promise<SupabaseProfileRow | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,email,phone,user_type,avatar_url,bio,city,state,created_at,updated_at')
    .eq('email', normalizeEmail(email))
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}

async function selectProfileById(id: string): Promise<SupabaseProfileRow | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,email,phone,user_type,avatar_url,bio,city,state,created_at,updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}

async function selectClientProfileByUserId(userId: string): Promise<SupabaseClientProfileRow | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('client_profiles')
    .select(
      'id,user_id,company_name,document_number,contact_name,company_description,created_at,updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}

async function selectFreelancerProfileByUserId(
  userId: string,
): Promise<SupabaseFreelancerProfileRow | null> {
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from('freelancer_profiles')
    .select(
      'id,user_id,professional_title,skills,experience_level,portfolio_url,hourly_rate,availability_status,rating_average,total_reviews,created_at,updated_at',
    )
    .eq('user_id', userId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}

async function selectProfilesByUserType(role: UserRole): Promise<SupabaseProfileRow[]> {
  if (!supabase) {
    return [];
  }

  const { data, error } = await supabase
    .from('profiles')
    .select('id,full_name,email,phone,user_type,avatar_url,bio,city,state,created_at,updated_at')
    .eq('user_type', role)
    .order('created_at', { ascending: true });

  if (error || !data) {
    return [];
  }

  return data;
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
      'id,user_id,professional_title,skills,experience_level,portfolio_url,hourly_rate,availability_status,rating_average,total_reviews,created_at,updated_at',
    )
    .in('user_id', userIds);

  if (error || !data) {
    return new Map();
  }

  return new Map(data.map((item) => [item.user_id, item]));
}

async function loadSupabaseUserBundle(id: string): Promise<SupabaseUserBundle> {
  const profile = await selectProfileById(id);
  if (!profile) {
    return null;
  }

  return {
    profile,
    clientProfile: await selectClientProfileByUserId(profile.id),
    freelancerProfile: await selectFreelancerProfileByUserId(profile.id),
  };
}

async function loadSupabaseUserBundleByEmail(email: string): Promise<SupabaseUserBundle> {
  const profile = await selectProfileByEmail(email);
  if (!profile) {
    return null;
  }

  return loadSupabaseUserBundle(profile.id);
}

function findClientCompatibilityShadow(idOrEmail: string): StoredClient | undefined {
  return (
    findLegacyClientRecordById(idOrEmail) ??
    findLegacyClientRecordByEmail(idOrEmail)
  );
}

function findFreelancerLocalShadow(idOrEmail: string): StoredFreelancer | undefined {
  return (
    findLegacyFreelancerRecordById(idOrEmail) ??
    findLegacyFreelancerRecordByEmail(idOrEmail)
  );
}

function mergeClientFromSupabase(
  bundle: Exclude<SupabaseUserBundle, null>,
  legacy?: StoredClient,
): StoredClient {
  const location = buildLocation(bundle.profile.city, bundle.profile.state) || legacy?.profile.location || '';

  return {
    profile: {
      id: bundle.profile.id,
      name: fallbackName(bundle.profile),
      email: bundle.profile.email,
      phone: bundle.profile.phone ?? legacy?.profile.phone ?? '',
      location,
      createdAt:
        bundle.clientProfile?.created_at ??
        bundle.profile.created_at ??
        legacy?.profile.createdAt ??
        new Date().toISOString(),
    },
    passwordHash: legacy?.passwordHash ?? '',
  };
}

function buildFreelancerPresentationResidue(
  bundle: Exclude<SupabaseUserBundle, null>,
  legacy?: StoredFreelancer,
): FreelancerPresentationResidue {
  const freelancerProfile = bundle.freelancerProfile;
  const profession = freelancerProfile?.professional_title ?? legacy?.profile.profession ?? 'Freelancer';
  const skills = freelancerProfile?.skills ?? legacy?.profile.skills ?? [];
  const experienceLevel = fromDatabaseExperienceLevel(freelancerProfile?.experience_level);
  const portfolioUrl =
    freelancerProfile?.portfolio_url ??
    legacy?.profile.portfolio[0]?.url ??
    legacy?.profile.websiteUrl ??
    'https://www.linkedin.com/';
  const category = inferCategory(profession, skills, legacy?.profile.category);

  return {
    slug: legacy?.profile.slug ?? createPublicSlug(fallbackName(bundle.profile), bundle.profile.id),
    category,
    summary: bundle.profile.bio?.trim() || legacy?.profile.summary || 'Perfil profissional em configuração.',
    description:
      bundle.profile.bio?.trim() ||
      legacy?.profile.description ||
      'O perfil ainda está sendo completado com mais detalhes de atuação.',
    yearsExperience: legacy?.profile.yearsExperience ?? defaultYearsExperience(experienceLevel),
    portfolio:
      legacy?.profile.portfolio && legacy.profile.portfolio.length > 0
        ? legacy.profile.portfolio
        : defaultPortfolio(portfolioUrl),
    linkedinUrl: legacy?.profile.linkedinUrl,
    websiteUrl: legacy?.profile.websiteUrl ?? freelancerProfile?.portfolio_url ?? undefined,
    whatsapp: legacy?.profile.whatsapp ?? '',
    availability:
      legacy?.profile.availability ?? availabilityTextFromStatus(freelancerProfile?.availability_status),
    memberSince: legacy?.profile.memberSince ?? bundle.profile.created_at,
    bannerUrl: legacy?.profile.bannerUrl ?? defaultFreelancerBanner,
  };
}

function buildFreelancerOperationalResidue(
  bundle: Exclude<SupabaseUserBundle, null>,
  legacy?: StoredFreelancer,
): FreelancerOperationalResidue {
  return {
    email: bundle.profile.email,
    hasCnpj: legacy?.hasCnpj ?? false,
    // Compatibility-only password fallback:
    // active while a local/demo account still exists without a confirmed Supabase session.
    // This should disappear when local user shadows are retired after the migration window.
    passwordHash: legacy?.passwordHash ?? '',
    phone: bundle.profile.phone ?? legacy?.phone ?? '',
    // Operational residue outside Block 1 schema.
    // Subscription and metrics must move only in a later operational persistence block.
    subscription: legacy?.subscription ?? createDefaultSubscription(legacy?.hasCnpj ?? false),
    metrics: legacy?.metrics ?? {
      profileViews: 0,
      contactClicks: 0,
      messagesReceived: 0,
    },
  };
}

function mergeFreelancerFromSupabase(
  bundle: Exclude<SupabaseUserBundle, null>,
  legacy?: StoredFreelancer,
): StoredFreelancer {
  const freelancerProfile = bundle.freelancerProfile;
  const profession = freelancerProfile?.professional_title ?? legacy?.profile.profession ?? 'Freelancer';
  const skills = freelancerProfile?.skills ?? legacy?.profile.skills ?? [];
  const experienceLevel = fromDatabaseExperienceLevel(freelancerProfile?.experience_level);
  const location = buildLocation(bundle.profile.city, bundle.profile.state) || legacy?.profile.location || '';
  const presentation = buildFreelancerPresentationResidue(bundle, legacy);
  const operational = buildFreelancerOperationalResidue(bundle, legacy);
  const profile: Freelancer = {
    id: bundle.profile.id,
    slug: presentation.slug,
    name: fallbackName(bundle.profile),
    profession,
    subscriptionTier: operational.subscription.tier,
    category: presentation.category,
    summary: presentation.summary,
    description: presentation.description,
    location,
    experienceLevel,
    yearsExperience: presentation.yearsExperience,
    averagePrice:
      typeof freelancerProfile?.hourly_rate === 'number'
        ? freelancerProfile.hourly_rate
        : legacy?.profile.averagePrice ?? null,
    skills,
    portfolio: presentation.portfolio,
    avatarUrl: bundle.profile.avatar_url ?? legacy?.profile.avatarUrl ?? defaultFreelancerAvatar,
    linkedinUrl: presentation.linkedinUrl,
    websiteUrl: presentation.websiteUrl,
    whatsapp: presentation.whatsapp,
    verified: operational.subscription.tier === 'booster',
    availability: presentation.availability,
    memberSince: presentation.memberSince,
    bannerUrl: presentation.bannerUrl,
  };

  return {
    ...operational,
    profile,
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
    professionalTitle?: string;
    experienceLevel?: Freelancer['experienceLevel'];
    skills?: string[];
    hourlyRate?: number | null;
    portfolioUrl?: string;
    availabilityStatus?: string;
    ratingAverage?: number | null;
    totalReviews?: number | null;
  };
  client?: {
    companyName?: string;
    documentNumber?: string;
    contactName?: string;
    companyDescription?: string;
  };
}): Promise<boolean> {
  const client = createSupabaseUserClient(input.accessToken);
  if (!client) {
    return false;
  }

  const profileResult = await client.from('profiles').upsert(
    {
      id: input.id,
      full_name: input.fullName,
      email: normalizeEmail(input.email),
      phone: input.phone ?? null,
      user_type: input.role,
      avatar_url: input.avatarUrl ?? null,
      bio: input.bio ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
    },
    { onConflict: 'id' },
  );

  if (profileResult.error) {
    return false;
  }

  if (input.role === 'client') {
    const clientResult = await client.from('client_profiles').upsert(
      {
        user_id: input.id,
        company_name: input.client?.companyName ?? null,
        document_number: input.client?.documentNumber ?? null,
        contact_name: input.client?.contactName ?? null,
        company_description: input.client?.companyDescription ?? null,
      },
      { onConflict: 'user_id' },
    );

    return !clientResult.error;
  }

  const freelancerResult = await client.from('freelancer_profiles').upsert(
    {
      user_id: input.id,
      professional_title: input.freelancer?.professionalTitle ?? null,
      skills: input.freelancer?.skills ?? [],
      experience_level: toDatabaseExperienceLevel(input.freelancer?.experienceLevel),
      portfolio_url: input.freelancer?.portfolioUrl ?? null,
      hourly_rate: input.freelancer?.hourlyRate ?? null,
      availability_status: toDatabaseAvailabilityStatus(input.freelancer?.availabilityStatus),
      rating_average: input.freelancer?.ratingAverage ?? 0,
      total_reviews: input.freelancer?.totalReviews ?? 0,
    },
    { onConflict: 'user_id' },
  );

  return !freelancerResult.error;
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
    .select('id,full_name,email,phone,user_type,avatar_url,bio,city,state,created_at,updated_at')
    .eq('id', input.userId)
    .maybeSingle<SupabaseProfileRow>();

  if (profileError || !profile) {
    return input.fallbackRole;
  }

  const resolvedRole = getExplicitUserRole(profile) ?? input.fallbackRole;
  if (!resolvedRole) {
    return undefined;
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

  const legacyFreelancer =
    findFreelancerLocalShadow(input.userId) ??
    findFreelancerLocalShadow(profile.email) ??
    (input.fallbackEmail ? findFreelancerLocalShadow(input.fallbackEmail) : undefined);
  const { data: freelancerProfile, error: freelancerProfileError } = await client
    .from('freelancer_profiles')
    .select('id')
    .eq('user_id', input.userId)
    .maybeSingle<{ id: string }>();

  if (!freelancerProfileError && !freelancerProfile) {
    // This runs after a real authenticated login and only fills the missing subtype row.
    // It is safe to retry because the write is an upsert on user_id.
    await client.from('freelancer_profiles').upsert(
      {
        user_id: input.userId,
        professional_title: legacyFreelancer?.profile.profession ?? null,
        skills: legacyFreelancer?.profile.skills ?? [],
        experience_level: toDatabaseExperienceLevel(legacyFreelancer?.profile.experienceLevel),
        portfolio_url:
          legacyFreelancer?.profile.portfolio[0]?.url ??
          legacyFreelancer?.profile.websiteUrl ??
          null,
        hourly_rate: legacyFreelancer?.profile.averagePrice ?? null,
        availability_status: toDatabaseAvailabilityStatus(legacyFreelancer?.profile.availability),
        rating_average: 0,
        total_reviews: 0,
      },
      { onConflict: 'user_id' },
    );
  }

  return resolvedRole;
}

export async function findSessionUserByEmail(email: string): Promise<UserLookup | undefined> {
  const bundle = await loadSupabaseUserBundleByEmail(email);
  const sessionUser = bundle ? buildSessionUserFromBundle(bundle) : undefined;
  if (bundle && sessionUser) {
    return {
      user: sessionUser,
      email: bundle.profile.email,
      source: 'supabase',
    };
  }

  // Compatibility-only fallback:
  // active when the account still exists only in the local shadow store.
  const legacy = findLegacySessionUserByEmail(email);
  if (!legacy) {
    return undefined;
  }

  return {
    user: {
      id: legacy.id,
      name: legacy.name,
      role: legacy.role,
    },
    email: normalizeEmail(email),
    source: 'legacy',
    passwordHash: legacy.passwordHash,
  };
}

export async function findSessionUserById(id: string, role?: UserRole): Promise<SessionUser | undefined> {
  const bundle = await loadSupabaseUserBundle(id);
  const sessionUser = bundle ? buildSessionUserFromBundle(bundle, role) : undefined;
  if (sessionUser) {
    return sessionUser;
  }

  // Supabase-managed ids must not keep authenticating from a local shadow
  // once the canonical profile bundle is gone. This prevents deleted Auth users
  // from surviving through a stale HTTP-only app session.
  if (!bundle && isSupabaseManagedUserId(id)) {
    return undefined;
  }

  if (!role) {
    return undefined;
  }

  if (role === 'client') {
    // Compatibility-only local lookup for older client accounts not yet resolved by Supabase id.
    const legacyClient = findClientCompatibilityShadow(id);
    if (!legacyClient) {
      return undefined;
    }

    const bundleByEmail = await loadSupabaseUserBundleByEmail(legacyClient.profile.email);
    const sessionUserByEmail = bundleByEmail
      ? buildSessionUserFromBundle(bundleByEmail, role)
      : undefined;
    if (sessionUserByEmail) {
      return sessionUserByEmail;
    }

    return {
      id: legacyClient.profile.id,
      name: legacyClient.profile.name,
      role,
    };
  }

  const legacyFreelancer = findFreelancerLocalShadow(id);
  if (!legacyFreelancer) {
    return undefined;
  }

  const bundleByEmail = await loadSupabaseUserBundleByEmail(legacyFreelancer.email);
  const sessionUserByEmail = bundleByEmail
    ? buildSessionUserFromBundle(bundleByEmail, role)
    : undefined;
  if (sessionUserByEmail) {
    return sessionUserByEmail;
  }

  return {
    id: legacyFreelancer.profile.id,
    name: legacyFreelancer.profile.name,
    role,
  };
}

export async function findClientRecordById(id: string): Promise<StoredClient | undefined> {
  // Client compatibility shadow is consulted only when Supabase cannot yet resolve
  // the account directly by canonical id.
  const legacy = findClientCompatibilityShadow(id);
  const bundle =
    (await loadSupabaseUserBundle(id)) ??
    (legacy ? await loadSupabaseUserBundleByEmail(legacy.profile.email) : null);

  if (bundle && inferUserRoleFromBundle(bundle, legacy ? 'client' : undefined) === 'client') {
    return mergeClientFromSupabase(bundle, legacy);
  }

  return legacy;
}

export async function findFreelancerRecordById(id: string): Promise<StoredFreelancer | undefined> {
  // Freelancer local shadow is consulted only for compatibility residue and
  // showcase/operational fields outside Block 1 schema.
  const legacy = findFreelancerLocalShadow(id);
  const bundle =
    (await loadSupabaseUserBundle(id)) ??
    (legacy ? await loadSupabaseUserBundleByEmail(legacy.email) : null);

  if (bundle && inferUserRoleFromBundle(bundle, legacy ? 'freelancer' : undefined) === 'freelancer') {
    return mergeFreelancerFromSupabase(bundle, legacy);
  }

  return legacy;
}

export async function listPublicFreelancers(): Promise<Freelancer[]> {
  const profiles = await selectProfilesByUserType('freelancer');
  const legacyPublicFreelancers = listLegacyPublicFreelancers();
  if (profiles.length === 0) {
    // Public fallback while there are still local demo/showcase freelancers
    // not materialized in Supabase. Remove in the later showcase persistence block.
    return legacyPublicFreelancers;
  }

  const subtypeMap = await selectFreelancerProfilesByUserIds(profiles.map((profile) => profile.id));
  const supabaseEmailSet = new Set(profiles.map((profile) => profile.email.toLowerCase()));
  const supabaseIdSet = new Set(profiles.map((profile) => profile.id));
  const supabaseFreelancers = profiles
    .map((profile) => {
      const legacyShadow = findFreelancerLocalShadow(profile.id) ?? findFreelancerLocalShadow(profile.email);
      const bundle: Exclude<SupabaseUserBundle, null> = {
        profile,
        clientProfile: null,
        freelancerProfile: subtypeMap.get(profile.id) ?? null,
      };

      return mergeFreelancerFromSupabase(bundle, legacyShadow);
    })
    .filter((freelancer) => {
      return freelancer.subscription.status === 'active';
    })
    .sort((left, right) => {
      const leftRank = left.profile.subscriptionTier === 'booster' ? 0 : 1;
      const rightRank = right.profile.subscriptionTier === 'booster' ? 0 : 1;

      if (leftRank !== rightRank) {
        return leftRank - rightRank;
      }

      return left.profile.name.localeCompare(right.profile.name, 'pt-BR');
    })
    .map((freelancer) => freelancer.profile);
  const legacyOnlyFreelancers = legacyPublicFreelancers.filter((freelancer) => {
    const legacyShadow = findFreelancerLocalShadow(freelancer.id);
    if (!legacyShadow) {
      return true;
    }

    return (
      !supabaseIdSet.has(legacyShadow.profile.id) &&
      !supabaseEmailSet.has(legacyShadow.email.toLowerCase())
    );
  });

  return [...supabaseFreelancers, ...legacyOnlyFreelancers].sort((left, right) => {
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

  recordFreelancerProfileViewByIdentity({
    freelancerId: freelancer.id,
    freelancerSlug: freelancer.slug,
  });

  return freelancer;
}

export async function getClientDashboard(id: string): Promise<ClientDashboard | undefined> {
  // Dashboard assembly is intentionally split:
  // - identity/profile comes from Supabase
  // - contacts and UI conveniences remain local operational data for now
  const client = await findClientRecordById(id);
  if (!client) {
    return undefined;
  }

  return {
    profile: client.profile,
    favorites: (await listPublicFreelancers()).slice(0, 3),
    recentContacts: listContactsByClientIdentity({
      clientId: client.profile.id,
      clientEmail: client.profile.email,
      clientName: client.profile.name,
    }).slice(0, 5),
    notifications: [
      'Seu contato com freelancers foi registrado com sucesso.',
      'Perfis booster aparecem primeiro nas pesquisas.',
      'Você pode acompanhar o histórico das conversas sem sair da plataforma.',
    ],
  };
}

export async function getFreelancerDashboard(id: string): Promise<FreelancerDashboard | undefined> {
  // Dashboard assembly is intentionally split:
  // - identity/profile comes from Supabase
  // - subscription/metrics/recent contacts remain local operational residue for now
  const freelancer = await findFreelancerRecordById(id);
  if (!freelancer) {
    return undefined;
  }

  return {
    profile: freelancer.profile,
    subscription: freelancer.subscription,
    metrics: freelancer.metrics,
    recentContacts: listContactsByFreelancerIdentity({
      freelancerId: freelancer.profile.id,
      freelancerEmail: freelancer.email,
      freelancerName: freelancer.profile.name,
    }).slice(0, 5),
    account: {
      email: freelancer.email,
      phone: freelancer.phone,
      hasCnpj: freelancer.hasCnpj,
    },
  };
}

export function createLegacyClientShadow(input: StoredClient): ClientProfile {
  // Client compatibility shadow:
  // active only when sign-up cannot write client_profiles immediately because
  // email confirmation prevents getting an authenticated access token.
  // Resolve by retiring local user shadows after the migration compatibility window.
  return addLocalClientShadow(input);
}

export function createLegacyFreelancerShadow(input: StoredFreelancer): Freelancer {
  // Freelancer operational shadow:
  // active when either:
  // 1. sign-up cannot write freelancer_profiles immediately because email confirmation
  //    prevents an authenticated access token
  // 2. the profile still needs showcase/operational fields outside Block 1 schema
  // Resolve item 1 after compatibility retirement.
  // Resolve item 2 in the later operational/showcase persistence block.
  return addLocalFreelancerShadow(input);
}

export function purgeLegacyUserShadow(input: {
  id: string;
  email: string;
  role: UserRole;
}) {
  deleteSessionsByUserId(input.id);

  if (input.role === 'client') {
    removeLocalClientShadow({
      id: input.id,
      email: input.email,
    });
    return;
  }

  removeLocalFreelancerShadow({
    id: input.id,
    email: input.email,
  });
}

export function getNextClientId(): string {
  // Local-only id reservation for the fallback path where Supabase Auth is unavailable.
  return getLegacyNextClientId();
}

export function getNextFreelancerId(): string {
  // Local-only id reservation for the fallback path where Supabase Auth is unavailable.
  return getLegacyNextFreelancerId();
}

export function ensureUniqueFreelancerSlug(baseSlug: string): string {
  // Slug uniqueness is still local because slug is a showcase concern outside Block 1 schema.
  return ensureLegacyFreelancerSlug(baseSlug);
}
