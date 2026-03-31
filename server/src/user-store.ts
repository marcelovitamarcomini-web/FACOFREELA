import type {
  ClientDashboard,
  ClientProfile,
  ConversationInbox,
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
  findClientRecordByEmail as findLegacyClientRecordByEmail,
  findClientRecordById as findLegacyClientRecordById,
  findFreelancerRecordByEmail as findLegacyFreelancerRecordByEmail,
  findFreelancerRecordById as findLegacyFreelancerRecordById,
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
};

type UserLookup = {
  user: SessionUser;
  email: string;
  source: 'supabase';
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

// Block 1 canonical source of truth for user identity:
// - public.profiles
// - public.client_profiles
// - public.freelancer_profiles
//
// Any local data touched below is residue only. It is never used for cadastro or autenticação.
// It remains temporarily only for freelancer operational/showcase fields that do not belong
// to the current Block 1 schema.

type FreelancerOperationalResidue = Pick<
  StoredFreelancer,
  'email' | 'hasCnpj' | 'phone' | 'subscription' | 'metrics'
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

function normalizeOptionalText(value?: string | null): string | undefined {
  if (typeof value !== 'string') {
    return undefined;
  }

  const normalized = value.trim();
  return normalized ? normalized : undefined;
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

function fallbackName(profile: SupabaseProfileRow): string {
  return profile.full_name?.trim() || profile.email;
}

function getExplicitUserRole(profile: SupabaseProfileRow): UserRole | undefined {
  if (profile.user_type === 'client' || profile.user_type === 'freelancer') {
    return profile.user_type;
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

  return fallbackRole;
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
  const normalizedLegacyCategory = normalizeLegacyCategory(legacyCategory);
  if (normalizedLegacyCategory) {
    return normalizedLegacyCategory;
  }

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
    haystack.includes('técnic') ||
    haystack.includes('tecnic') ||
    haystack.includes('instala') ||
    haystack.includes('vistoria') ||
    haystack.includes('refrigera') ||
    haystack.includes('ar-condicionado') ||
    haystack.includes('solda')
  ) {
    return 'Instalação e Manutenção';
  }

  if (
    haystack.includes('design') ||
    haystack.includes('ux') ||
    haystack.includes('ui') ||
    haystack.includes('vídeo') ||
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
    haystack.includes('reda') ||
    haystack.includes('conteúdo') ||
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

  if (
    haystack.includes('consult') ||
    haystack.includes('mentoria') ||
    haystack.includes('aula') ||
    haystack.includes('planeja') ||
    haystack.includes('financeir') ||
    haystack.includes('contáb') ||
    haystack.includes('contab') ||
    haystack.includes('juríd') ||
    haystack.includes('jurid')
  ) {
    return 'Projetos e Consultoria';
  }

  return categories[0];
}

function normalizeLegacyCategory(
  legacyCategory?: string,
): Freelancer['category'] | undefined {
  if (!legacyCategory) {
    return undefined;
  }

  switch (legacyCategory) {
    case 'Conserto em Casa':
    case 'Obra e Reforma':
    case 'Frete e Guincho':
    case 'Instalação e Manutenção':
    case 'Design e Vídeo':
    case 'Marketing e Redes':
    case 'Sites e Tecnologia':
    case 'Projetos e Consultoria':
      return legacyCategory;
    case 'Casa e Reparos':
      return 'Conserto em Casa';
    case 'Obras e Reformas':
      return 'Obra e Reforma';
    case 'Transporte e Assistência':
      return 'Frete e Guincho';
    case 'Serviços Técnicos':
      return 'Instalação e Manutenção';
    case 'Design e Audiovisual':
      return 'Design e Vídeo';
    case 'Marketing e Conteúdo':
      return 'Marketing e Redes';
    case 'Tecnologia e Sites':
      return 'Sites e Tecnologia';
    case 'Consultoria e Projetos':
      return 'Projetos e Consultoria';
    case 'Design':
    case 'Edição de Vídeo':
      return 'Design e Vídeo';
    case 'Programação':
      return 'Sites e Tecnologia';
    case 'Marketing Digital':
    case 'Redação':
    case 'Tradução':
      return 'Marketing e Redes';
    case 'Consultoria':
      return 'Projetos e Consultoria';
    default:
      return undefined;
  }
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
    .select('id,full_name,email,phone,user_type,avatar_url,bio,city,state,created_at,updated_at')
    .eq('email', normalizeEmail(email))
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
}

async function selectProfileById(id: string, accessToken?: string): Promise<SupabaseProfileRow | null> {
  const client = getSupabaseQueryClient(accessToken);
  if (!client) {
    return null;
  }

  const { data, error } = await client
    .from('profiles')
    .select('id,full_name,email,phone,user_type,avatar_url,bio,city,state,created_at,updated_at')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    return null;
  }

  return data;
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

  return data;
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
      'id,user_id,professional_title,skills,experience_level,portfolio_url,banner_url,hourly_rate,availability_status,rating_average,total_reviews,created_at,updated_at',
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
      'id,user_id,professional_title,skills,experience_level,portfolio_url,banner_url,hourly_rate,availability_status,rating_average,total_reviews,created_at,updated_at',
    )
    .in('user_id', userIds);

  if (error || !data) {
    return new Map();
  }

  return new Map(data.map((item) => [item.user_id, item]));
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
      avatarUrl: bundle.profile.avatar_url ?? undefined,
      location,
      createdAt:
        bundle.clientProfile?.created_at ??
        bundle.profile.created_at ??
        legacy?.profile.createdAt ??
        new Date().toISOString(),
    },
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
    bannerUrl:
      normalizeFreelancerBannerUrl(freelancerProfile?.banner_url) ??
      normalizeFreelancerBannerUrl(legacy?.profile.bannerUrl) ??
      defaultFreelancerBanner,
  };
}

function buildFreelancerOperationalResidue(
  bundle: Exclude<SupabaseUserBundle, null>,
  legacy?: StoredFreelancer,
): FreelancerOperationalResidue {
  return {
    email: bundle.profile.email,
    hasCnpj: legacy?.hasCnpj ?? false,
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
    portfolioUrl?: string;
    bannerUrl?: string;
    availabilityStatus?: string;
    ratingAverage?: number | null;
    totalReviews?: number | null;
  };
  client?: {
    cep?: string;
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

  const profilePayload: Record<string, unknown> = {
    id: input.id,
    full_name: input.fullName,
    email: normalizeEmail(input.email),
    user_type: input.role,
  };

  const normalizedPhone = normalizeOptionalText(input.phone);
  if (normalizedPhone) {
    profilePayload.phone = normalizedPhone;
  }

  const normalizedAvatarUrl = normalizeOptionalText(input.avatarUrl);
  if (normalizedAvatarUrl) {
    profilePayload.avatar_url = normalizedAvatarUrl;
  }

  const normalizedBio = normalizeOptionalText(input.bio);
  if (normalizedBio) {
    profilePayload.bio = normalizedBio;
  }

  const normalizedCity = normalizeOptionalText(input.city);
  if (normalizedCity) {
    profilePayload.city = normalizedCity;
  }

  const normalizedState = normalizeOptionalText(input.state);
  if (normalizedState) {
    profilePayload.state = normalizedState;
  }

  const profileResult = await client.from('profiles').upsert(
    profilePayload,
    { onConflict: 'id' },
  );

  if (profileResult.error) {
    return false;
  }

  if (input.role === 'client') {
    const clientPayload: Record<string, unknown> = {
      user_id: input.id,
    };

    const normalizedCep = normalizeOptionalText(input.client?.cep)?.replace(/\D/g, '');
    if (normalizedCep) {
      clientPayload.cep = normalizedCep;
    }

    const normalizedCompanyName = normalizeOptionalText(input.client?.companyName);
    if (normalizedCompanyName) {
      clientPayload.company_name = normalizedCompanyName;
    }

    const normalizedDocumentNumber = normalizeOptionalText(input.client?.documentNumber);
    if (normalizedDocumentNumber) {
      clientPayload.document_number = normalizedDocumentNumber;
    }

    const normalizedContactName = normalizeOptionalText(input.client?.contactName);
    if (normalizedContactName) {
      clientPayload.contact_name = normalizedContactName;
    } else {
      clientPayload.contact_name = input.fullName;
    }

    const normalizedCompanyDescription = normalizeOptionalText(input.client?.companyDescription);
    if (normalizedCompanyDescription) {
      clientPayload.company_description = normalizedCompanyDescription;
    }

    const clientResult = await client.from('client_profiles').upsert(
      clientPayload,
      { onConflict: 'user_id' },
    );

    return !clientResult.error;
  }

  const freelancerPayload: Record<string, unknown> = {
    user_id: input.id,
  };

  const normalizedProfessionalTitle = normalizeOptionalText(input.freelancer?.professionalTitle);
  if (normalizedProfessionalTitle) {
    freelancerPayload.professional_title = normalizedProfessionalTitle;
  }

  if (Array.isArray(input.freelancer?.skills)) {
    freelancerPayload.skills = input.freelancer.skills;
  }

  if (input.freelancer?.experienceLevel) {
    freelancerPayload.experience_level = toDatabaseExperienceLevel(input.freelancer.experienceLevel);
  }

  const normalizedPortfolioUrl = normalizeOptionalText(input.freelancer?.portfolioUrl);
  if (normalizedPortfolioUrl) {
    freelancerPayload.portfolio_url = normalizedPortfolioUrl;
  }

  const normalizedBannerUrl = normalizeOptionalText(input.freelancer?.bannerUrl);
  if (normalizedBannerUrl) {
    freelancerPayload.banner_url = normalizedBannerUrl;
  }

  if (typeof input.freelancer?.availabilityStatus === 'string') {
    freelancerPayload.availability_status = toDatabaseAvailabilityStatus(
      input.freelancer.availabilityStatus,
    );
  }

  if (typeof input.freelancer?.ratingAverage === 'number') {
    freelancerPayload.rating_average = input.freelancer.ratingAverage;
  }

  if (typeof input.freelancer?.totalReviews === 'number') {
    freelancerPayload.total_reviews = input.freelancer.totalReviews;
  }

  const freelancerResult = await client.from('freelancer_profiles').upsert(freelancerPayload, {
    onConflict: 'user_id',
  });

  return !freelancerResult.error;
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

  const profilePatch: Record<string, unknown> = {};
  if (!getExplicitUserRole(profile)) {
    profilePatch.user_type = resolvedRole;
  }

  if (!profile.full_name?.trim() && input.fallbackName) {
    profilePatch.full_name = input.fallbackName;
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
        availability_status: toDatabaseAvailabilityStatus(legacyFreelancer?.profile.availability),
        rating_average: 0,
        total_reviews: 0,
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
  if (bundle && sessionUser) {
    return {
      user: sessionUser,
      email: bundle.profile.email,
      source: 'supabase',
    };
  }

  return undefined;
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
): Promise<StoredClient | undefined> {
  const bundle = await loadSupabaseUserBundle(id, accessToken);
  if (!bundle) {
    return undefined;
  }

  const legacy =
    findLegacyClientRecordById(id) ??
    findLegacyClientRecordByEmail(bundle.profile.email);
  if (inferUserRoleFromBundle(bundle, 'client') === 'client') {
    return mergeClientFromSupabase(bundle, legacy);
  }

  return undefined;
}

export async function findFreelancerRecordById(
  id: string,
  accessToken?: string,
): Promise<StoredFreelancer | undefined> {
  const bundle = await loadSupabaseUserBundle(id, accessToken);
  if (!bundle) {
    return undefined;
  }

  const legacy =
    findFreelancerLocalShadow(id) ??
    findFreelancerLocalShadow(bundle.profile.email);
  if (inferUserRoleFromBundle(bundle, 'freelancer') === 'freelancer') {
    return mergeFreelancerFromSupabase(bundle, legacy);
  }

  return undefined;
}

export async function listPublicFreelancers(): Promise<Freelancer[]> {
  const profiles = await selectProfilesByUserType('freelancer');
  if (profiles.length === 0) {
    return [];
  }

  const subtypeMap = await selectFreelancerProfilesByUserIds(profiles.map((profile) => profile.id));
  return profiles
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

export async function getClientDashboard(
  id: string,
  accessToken?: string,
): Promise<ClientDashboard | undefined> {
  // Dashboard assembly is intentionally split:
  // - identity/profile comes from Supabase
  // - contacts and UI conveniences remain local operational data for now
  const client = await findClientRecordById(id, accessToken);
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
      'Sua conversa foi registrada no chat interno da plataforma.',
      'Novas respostas aparecem direto na central de mensagens.',
      'Toda a comunicação oficial entre cliente e freelancer fica dentro do site.',
    ],
  };
}

export async function getFreelancerDashboard(
  id: string,
  accessToken?: string,
): Promise<FreelancerDashboard | undefined> {
  // Dashboard assembly is intentionally split:
  // - identity/profile comes from Supabase
  // - subscription/metrics/recent contacts remain local operational residue for now
  const freelancer = await findFreelancerRecordById(id, accessToken);
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

export async function getConversationInbox(
  id: string,
  role: UserRole,
  accessToken?: string,
): Promise<ConversationInbox | undefined> {
  if (role === 'client') {
    const client = await findClientRecordById(id, accessToken);
    if (!client) {
      return undefined;
    }

    return {
      contacts: listContactsByClientIdentity({
        clientId: client.profile.id,
        clientEmail: client.profile.email,
        clientName: client.profile.name,
      }),
    };
  }

  const freelancer = await findFreelancerRecordById(id, accessToken);
  if (!freelancer) {
    return undefined;
  }

  return {
    contacts: listContactsByFreelancerIdentity({
      freelancerId: freelancer.profile.id,
      freelancerEmail: freelancer.email,
      freelancerName: freelancer.profile.name,
    }),
  };
}
