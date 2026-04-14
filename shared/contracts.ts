export const categories = [
  'Conserto em Casa',
  'Obra e Reforma',
  'Frete e Guincho',
  'Instalação e Manutenção',
  'Design e Vídeo',
  'Marketing e Redes',
  'Sites e Tecnologia',
  'Projetos e Consultoria',
] as const;

export const experienceLevels = ['Júnior', 'Pleno', 'Sênior'] as const;
export const userRoles = ['client', 'freelancer'] as const;
export const subscriptionStatuses = ['pending', 'active', 'past_due', 'expired', 'canceled'] as const;
export const freelancerPlanTiers = ['normal', 'booster'] as const;
export const paymentCheckoutStatuses = ['open', 'approved', 'pending', 'failed', 'expired'] as const;
export const paymentProviders = ['mock'] as const;
export const paymentCheckoutChangeTypes = ['activation', 'upgrade', 'renewal'] as const;
export const subscriptionFlowSources = ['signup', 'subscription_page', 'dashboard', 'retry'] as const;

export type Category = (typeof categories)[number];
export type ExperienceLevel = (typeof experienceLevels)[number];
export type UserRole = (typeof userRoles)[number];
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];
export type FreelancerPlanTier = (typeof freelancerPlanTiers)[number];
export type PaymentCheckoutStatus = (typeof paymentCheckoutStatuses)[number];
export type PaymentProvider = (typeof paymentProviders)[number];
export type PaymentCheckoutChangeType = (typeof paymentCheckoutChangeTypes)[number];
export type SubscriptionFlowSource = (typeof subscriptionFlowSources)[number];
export const digitalCategories = [
  'Design e Vídeo',
  'Marketing e Redes',
  'Sites e Tecnologia',
] as const satisfies readonly Category[];

const digitalCategorySet = new Set<Category>(digitalCategories);

export function isDigitalCategory(category?: string | null) {
  return digitalCategorySet.has(category as Category);
}

export function shouldUseRegionalSearch(category?: string | null) {
  if (!category || category === 'Todos') {
    return true;
  }

  return !isDigitalCategory(category);
}

export const platformContactChannel = 'Contato externo' as const;
export type ContactChannel = typeof platformContactChannel;
export const profileAssetKinds = ['avatar', 'banner'] as const;
export type ProfileAssetKind = (typeof profileAssetKinds)[number];

export const freelancerPlanCatalog: Record<
  FreelancerPlanTier,
  {
    name: string;
    priceMonthly: number;
    summary: string;
    features: string[];
  }
> = {
  normal: {
    name: 'Plano Freelancer Normal',
    priceMonthly: 6.5,
    summary: 'Entrada essencial para publicar o perfil e começar a receber contatos.',
    features: [
      'Perfil público listado na plataforma',
      'Painel com contatos e estatísticas',
      'Perfil público com saída para contato',
    ],
  },
  booster: {
    name: 'Plano Freelancer Booster',
    priceMonthly: 8.9,
    summary: 'Camada extra para quem quer operar com presença comercial reforçada.',
    features: [
      'Tudo do plano normal',
      'Identificação visual de plano booster no painel',
      'Estrutura pronta para evoluções de destaque',
    ],
  },
};

export function getFreelancerPlanPrice(tier: FreelancerPlanTier): number {
  return freelancerPlanCatalog[tier].priceMonthly;
}

export interface PortfolioItem {
  title: string;
  description: string;
  url: string;
}

export interface Freelancer {
  id: string;
  slug: string;
  name: string;
  profession: string;
  subscriptionTier?: FreelancerPlanTier;
  category: Category;
  summary: string;
  description: string;
  location: string;
  experienceLevel: ExperienceLevel;
  yearsExperience: number;
  skills: string[];
  portfolio: PortfolioItem[];
  avatarUrl: string;
  linkedinUrl?: string;
  websiteUrl?: string;
  whatsapp: string;
  verified: boolean;
  availability: string;
  memberSince: string;
  bannerUrl?: string;
}

export interface SubscriptionPlan {
  tier: FreelancerPlanTier;
  name: string;
  priceMonthly: number;
  status: SubscriptionStatus;
  startedAt: string;
  endsAt: string;
}

export interface ContactThreadMessage {
  id: string;
  senderRole: 'client' | 'freelancer';
  senderName: string;
  body: string;
  createdAt: string;
}

export interface ContactMessage {
  id: string;
  freelancerId: string;
  freelancerName: string;
  freelancerEmail?: string;
  clientId?: string;
  clientName: string;
  clientLocation: string;
  clientEmail?: string;
  clientPhone?: string;
  subject: string;
  message: string;
  channel: ContactChannel;
  createdAt: string;
  status: 'Novo' | 'Respondido' | 'Arquivado';
  messages: ContactThreadMessage[];
}

export interface ClientProfile {
  id: string;
  name: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  location: string;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  name: string;
  role: UserRole;
}

export interface AuthSessionPayload {
  user: SessionUser;
}

export interface EmailAvailabilityResponse {
  exists: boolean;
}

export interface SignupAvailabilityResponse {
  emailExists: boolean;
  phoneExists: boolean;
}

export interface RegistrationResponse {
  user: SessionUser | null;
  requiresEmailConfirmation: boolean;
}

export interface PaymentCheckoutContext {
  cnpjActive: boolean;
  changeType: PaymentCheckoutChangeType;
  source: SubscriptionFlowSource;
}

export interface PaymentCheckout {
  id: string;
  provider: PaymentProvider;
  status: PaymentCheckoutStatus;
  customerName: string;
  customerEmail: string;
  planTier: FreelancerPlanTier;
  planName: string;
  amountMonthly: number;
  currency: 'BRL';
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  context?: PaymentCheckoutContext | null;
}

export interface PaymentCheckoutStartResponse {
  checkout: PaymentCheckout;
  checkoutPath: string;
}

export interface PaymentCheckoutDecisionResponse {
  checkout: PaymentCheckout;
  redirectPath: string;
}

export interface FreelancerDashboard {
  profile: Freelancer;
  subscription: SubscriptionPlan;
  metrics: {
    profileViews: number;
    contactClicks: number;
    messagesReceived: number;
  };
  recentContacts: ContactMessage[];
  account: {
    email: string;
    phone: string;
  };
}

export interface FreelancerSubscriptionWorkspace {
  profile: Pick<Freelancer, 'name' | 'profession' | 'subscriptionTier'>;
  subscription: SubscriptionPlan;
  activeCheckout: PaymentCheckout | null;
  latestCheckout: PaymentCheckout | null;
}

export interface ClientDashboard {
  profile: ClientProfile;
  favorites: Freelancer[];
  recentContacts: ContactMessage[];
  notifications: string[];
}

export interface ConversationInbox {
  contacts: ContactMessage[];
  seenMessageIds: Record<string, string>;
}

export interface ApiEnvelope<T> {
  data: T;
  message?: string;
}

export interface ProfileAssetUploadResponse {
  kind: ProfileAssetKind;
  publicUrl: string;
  persisted: boolean;
}
