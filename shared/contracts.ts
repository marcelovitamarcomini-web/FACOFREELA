export const categories = [
  'Design',
  'Programação',
  'Marketing Digital',
  'Edição de Vídeo',
  'Redação',
  'Tradução',
  'Consultoria',
] as const;

export const experienceLevels = ['Júnior', 'Pleno', 'Sênior'] as const;
export const userRoles = ['client', 'freelancer'] as const;
export const subscriptionStatuses = ['active', 'past_due', 'expired'] as const;
export const freelancerPlanTiers = ['normal', 'booster'] as const;

export type Category = (typeof categories)[number];
export type ExperienceLevel = (typeof experienceLevels)[number];
export type UserRole = (typeof userRoles)[number];
export type SubscriptionStatus = (typeof subscriptionStatuses)[number];
export type ContactChannel = 'Plataforma' | 'E-mail';
export type FreelancerPlanTier = (typeof freelancerPlanTiers)[number];
export const freelancerBoosterCnpjPrice = 5.99;

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
    priceMonthly: 5.49,
    summary: 'Entrada essencial para publicar o perfil e começar a receber contatos.',
    features: [
      'Perfil público listado na plataforma',
      'Painel com contatos e estatísticas',
      'Fluxo de mensagem protegido',
    ],
  },
  booster: {
    name: 'Plano Freelancer Booster',
    priceMonthly: 7.99,
    summary: 'Camada extra para quem quer operar com presença comercial reforçada.',
    features: [
      'Tudo do plano normal',
      'Identificação visual de plano booster no painel',
      'Estrutura pronta para evoluções de destaque',
    ],
  },
};

export function getFreelancerPlanPrice(
  tier: FreelancerPlanTier,
  hasCnpj = false,
): number {
  if (tier === 'booster' && hasCnpj) {
    return freelancerBoosterCnpjPrice;
  }

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
  averagePrice: number | null;
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
  location: string;
  createdAt: string;
}

export interface SessionUser {
  id: string;
  name: string;
  role: UserRole;
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
    hasCnpj: boolean;
  };
}

export interface ClientDashboard {
  profile: ClientProfile;
  favorites: Freelancer[];
  recentContacts: ContactMessage[];
  notifications: string[];
}

export interface ApiEnvelope<T> {
  data: T;
  message?: string;
}
