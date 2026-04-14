import { serve } from '@hono/node-server';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import { Hono } from 'hono';
import type { z } from 'zod';

import {
  categories,
  type ApiEnvelope,
  type AuthSessionPayload,
  type EmailAvailabilityResponse,
  type Freelancer,
  type PaymentCheckoutDecisionResponse,
  type PaymentCheckoutStartResponse,
  type ProfileAssetUploadResponse,
  type SignupAvailabilityResponse,
  type SubscriptionStatus,
  freelancerPlanCatalog,
  getFreelancerPlanPrice,
  platformContactChannel,
  type RegistrationResponse,
  type SessionUser,
} from '../../shared/contracts.js';
import {
  clientSignupSchema,
  contactReplySchema,
  contactSchema,
  emailLookupSchema,
  freelancerSignupSchema,
  loginSchema,
  searchSchema,
  signupLookupSchema,
} from '../../shared/schemas.js';
import { SESSION_MAX_AGE_SECONDS } from './auth.js';
import {
  appendContactMessage,
  createOrContinueContact,
  createSession,
  deleteSession,
  findContactById,
  findSession,
  updateSessionAuthState,
  type StoredSession,
} from './data.js';
import {
  createPaymentCheckoutSession,
  findInProgressCheckoutByUserId,
  findPaymentCheckoutSession,
  updatePaymentCheckoutStatus,
} from './payment-store.js';
import {
  applyApiSecurityHeaders,
  createContentLengthGuard,
  createRateLimitMiddleware,
  enforceRateLimit,
  getClientIp,
  isAllowedOrigin,
  isUuid,
} from './security.js';
import {
  authenticateWithSupabase,
  checkAuthEmailExists,
  checkAuthPhoneExists,
  deleteSupabaseAuthUser,
  isSupabaseAuthEnabled,
  registerSupabaseUser,
  refreshSupabaseUserSession,
  uploadSupabaseProfileAsset,
} from './supabase.js';
import {
  createSupabaseUserProfiles,
  ensureSupabaseUserSubtypeMaterialized,
  findClientRecordById,
  findFreelancerRecordById,
  findSessionUserByEmail,
  findSessionUserById,
  findSessionUserByPhone,
  getClientDashboard,
  getConversationInbox,
  getFreelancerDashboard,
  listPublicFreelancers,
  recordFreelancerProfileView,
  updateFreelancerSubscriptionState,
  updateSupabaseProfileAvatarUrl,
  updateSupabaseFreelancerBannerUrl,
} from './user-store.js';
import { serverEnv } from './env.js';

const app = new Hono();
const SESSION_COOKIE_NAME = 'facofreela.session';
const secureCookies = process.env.NODE_ENV === 'production';
const jsonBodyLimit = createContentLengthGuard(64 * 1024);
const uploadBodyLimit = createContentLengthGuard(10 * 1024 * 1024);
const authLookupRateLimit = createRateLimitMiddleware({
  bucket: 'auth-lookup',
  max: 12,
  windowMs: 10 * 60 * 1000,
  message: 'Muitas validacoes em pouco tempo. Tente novamente em instantes.',
});
const signupRateLimit = createRateLimitMiddleware({
  bucket: 'auth-signup',
  max: 6,
  windowMs: 30 * 60 * 1000,
  message: 'Muitas tentativas de cadastro em pouco tempo. Tente novamente mais tarde.',
});
const loginRateLimit = createRateLimitMiddleware({
  bucket: 'auth-login-ip',
  max: 8,
  windowMs: 15 * 60 * 1000,
  message: 'Muitas tentativas de login. Aguarde um pouco e tente novamente.',
});
const paymentRateLimit = createRateLimitMiddleware({
  bucket: 'payment-flow',
  max: 20,
  windowMs: 15 * 60 * 1000,
  message: 'Muitas operacoes de pagamento em pouco tempo. Tente novamente em instantes.',
});
const messageRateLimit = createRateLimitMiddleware({
  bucket: 'messages-send',
  max: 25,
  windowMs: 10 * 60 * 1000,
  message: 'Voce enviou mensagens demais em pouco tempo. Aguarde e tente novamente.',
});
const contactRateLimit = createRateLimitMiddleware({
  bucket: 'contacts-create',
  max: 10,
  windowMs: 10 * 60 * 1000,
  message: 'Muitas tentativas de contato em pouco tempo. Aguarde e tente novamente.',
});
const assetUploadRateLimit = createRateLimitMiddleware({
  bucket: 'profile-assets',
  max: 10,
  windowMs: 30 * 60 * 1000,
  message: 'Muitos uploads em pouco tempo. Aguarde antes de tentar novamente.',
});
const catalogRateLimit = createRateLimitMiddleware({
  bucket: 'public-catalog',
  max: 120,
  windowMs: 10 * 60 * 1000,
  message: 'Muitas consultas em pouco tempo. Aguarde um pouco antes de tentar novamente.',
});

app.use(
  '/api/*',
  cors({
    origin: (origin) => (isAllowedOrigin(origin) ? origin || undefined : undefined),
    credentials: true,
  }),
);
app.use('/api/*', applyApiSecurityHeaders());

app.onError((error, c) => {
  console.error('[api-error]', error instanceof Error ? error.message : error);
  return c.json({ message: 'Nao foi possivel concluir a operacao.' }, 500);
});

function envelope<T>(data: T, message?: string): ApiEnvelope<T> {
  return { data, message };
}

function splitLocation(location: string) {
  return {
    city: location.split(',')[0]?.trim(),
    state: location.split(',')[1]?.trim(),
  };
}

function parseFreelancerExperienceLevel(value?: string | null): Freelancer['experienceLevel'] | undefined {
  const normalized = value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();

  if (normalized === 'junior') {
    return 'J\u00fanior';
  }

  if (normalized === 'pleno') {
    return 'Pleno';
  }

  if (normalized === 'senior') {
    return 'S\u00eanior';
  }

  return undefined;
}

function serializeFreelancer(freelancer: Freelancer): Freelancer {
  return freelancer;
}

function setSessionCookie(
  session: Pick<StoredSession, 'token' | 'expiresAt'>,
  c: Parameters<typeof setCookie>[0],
) {
  const expiresInSeconds = Math.max(
    0,
    Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000),
  );

  setCookie(c, SESSION_COOKIE_NAME, session.token, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: secureCookies,
    path: '/',
    maxAge: expiresInSeconds || SESSION_MAX_AGE_SECONDS,
  });
}

function clearSessionCookie(c: Parameters<typeof deleteCookie>[0]) {
  deleteCookie(c, SESSION_COOKIE_NAME, {
    httpOnly: true,
    sameSite: 'Lax',
    secure: secureCookies,
    path: '/',
  });
}

function isSupabaseAccessTokenExpired(expiresAt?: string | null): boolean {
  if (!expiresAt) {
    return true;
  }

  const expiresAtMs = Date.parse(expiresAt);
  if (!Number.isFinite(expiresAtMs)) {
    return true;
  }

  return expiresAtMs - Date.now() <= 60_000;
}

async function ensureSessionSupabaseAuth(session: StoredSession) {
  if (!isSupabaseAuthEnabled()) {
    return {
      accessToken: session.supabaseAccessToken ?? null,
      refreshToken: session.supabaseRefreshToken ?? null,
      accessTokenExpiresAt: session.supabaseAccessTokenExpiresAt ?? null,
    };
  }

  if (
    session.supabaseAccessToken &&
    !isSupabaseAccessTokenExpired(session.supabaseAccessTokenExpiresAt)
  ) {
    return {
      accessToken: session.supabaseAccessToken,
      refreshToken: session.supabaseRefreshToken ?? null,
      accessTokenExpiresAt: session.supabaseAccessTokenExpiresAt ?? null,
    };
  }

  if (!session.supabaseRefreshToken) {
    return {
      accessToken: session.supabaseAccessToken ?? null,
      refreshToken: null,
      accessTokenExpiresAt: session.supabaseAccessTokenExpiresAt ?? null,
    };
  }

  const refreshResult = await refreshSupabaseUserSession({
    refreshToken: session.supabaseRefreshToken,
  });
  if (!refreshResult.ok) {
    return {
      accessToken: null,
      refreshToken: null,
      accessTokenExpiresAt: null,
    };
  }

  await updateSessionAuthState(session.token, {
    supabaseAccessToken: refreshResult.accessToken,
    supabaseRefreshToken: refreshResult.refreshToken,
    supabaseAccessTokenExpiresAt: refreshResult.accessTokenExpiresAt,
  });

  return {
    accessToken: refreshResult.accessToken,
    refreshToken: refreshResult.refreshToken,
    accessTokenExpiresAt: refreshResult.accessTokenExpiresAt,
  };
}

async function getAuthenticatedUser(
  c: Parameters<typeof getCookie>[0],
): Promise<
  | {
      token: string;
      user: SessionUser;
      supabaseAccessToken: string | null;
    }
  | null
> {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (!token) {
    return null;
  }

  const session = await findSession(token);
  if (!session) {
    clearSessionCookie(c);
    return null;
  }

  const sessionAuth = await ensureSessionSupabaseAuth(session);
  const user = await findSessionUserById(
    session.userId,
    session.role,
    sessionAuth.accessToken ?? undefined,
  );
  if (!user) {
    await deleteSession(token);
    clearSessionCookie(c);
    return null;
  }

  return {
    token,
    user,
    supabaseAccessToken: sessionAuth.accessToken ?? null,
  };
}

function unauthorized(c: Parameters<typeof getCookie>[0], message = 'FaÃ§a login para continuar.') {
  clearSessionCookie(c);
  return c.json({ message }, 401);
}

function forbidden(c: Parameters<typeof getCookie>[0], message: string) {
  return c.json({ message }, 403);
}

function invalidIdentifier(c: Parameters<typeof getCookie>[0], message = 'Identificador invalido.') {
  return c.json({ message }, 400);
}

function enforceIdentityRateLimit(
  request: Request,
  bucket: string,
  identity: string,
  max: number,
  windowMs: number,
) {
  return enforceRateLimit(request, { bucket, max, windowMs }, identity.trim().toLowerCase());
}

async function resolveSignupConflicts(input: { email: string; phone: string }) {
  const [authEmailExists, authPhoneExists] = await Promise.all([
    checkAuthEmailExists(input.email),
    checkAuthPhoneExists(input.phone),
  ]);

  const emailExists =
    authEmailExists !== null
      ? authEmailExists
      : Boolean(await findSessionUserByEmail(input.email));
  const phoneExists =
    authPhoneExists !== null
      ? authPhoneExists
      : Boolean(await findSessionUserByPhone(input.phone));

  return {
    emailExists,
    phoneExists,
  };
}

type SuccessfulSupabaseAuth = Extract<
  Awaited<ReturnType<typeof authenticateWithSupabase>>,
  { ok: true }
>;

type FreelancerSignupPayload = z.infer<typeof freelancerSignupSchema>;

type ProvisionFreelancerResult =
  | {
      ok: true;
      amountMonthly: number;
      authResult: SuccessfulSupabaseAuth;
      authUserId: string;
      requiresEmailConfirmation: boolean;
      selectedPlanName: string;
      sessionUser: SessionUser | null;
    }
  | {
      ok: false;
      message: string;
      status: 409 | 502;
    };

function buildCheckoutPath(checkoutId: string) {
  return `/checkout/freelancer/${checkoutId}`;
}

function buildPaymentResultPath(
  status: 'approved' | 'failed' | 'pending' | 'expired',
  checkoutId: string,
) {
  const pathname =
    status === 'approved'
      ? '/pagamento/aprovado'
      : status === 'expired'
        ? '/pagamento/expirado'
      : status === 'pending'
        ? '/pagamento/pendente'
        : '/pagamento/recusado';

  return `${pathname}?checkout=${encodeURIComponent(checkoutId)}`;
}

async function attachSessionCookie(
  c: Parameters<typeof setCookie>[0],
  authResult: SuccessfulSupabaseAuth,
  sessionUser: SessionUser | null,
) {
  if (!sessionUser) {
    return;
  }

  const session = await createSession({
    userId: sessionUser.id,
    role: sessionUser.role,
    supabaseAccessToken: authResult.accessToken,
    supabaseRefreshToken: authResult.refreshToken,
    supabaseAccessTokenExpiresAt: authResult.accessTokenExpiresAt,
  });

  setSessionCookie(session, c);
}

async function provisionFreelancerRegistration(
  payload: FreelancerSignupPayload,
  subscriptionStatus: SubscriptionStatus,
): Promise<ProvisionFreelancerResult> {
  const email = payload.email.trim().toLowerCase();
  const selectedPlan = freelancerPlanCatalog[payload.subscriptionTier];
  const location = splitLocation(payload.location);
  const conflicts = await resolveSignupConflicts({
    email,
    phone: payload.phone,
  });

  if (conflicts.emailExists) {
    return {
      ok: false,
      message: 'JÃ¡ existe uma conta com este e-mail.',
      status: 409,
    };
  }

  if (conflicts.phoneExists) {
    return {
      ok: false,
      message: 'JÃ¡ existe uma conta com este telefone.',
      status: 409,
    };
  }

  const authResult = await registerSupabaseUser({
    email,
    password: payload.password,
    name: payload.name,
    role: 'freelancer',
    metadata: {
      phone: payload.phone,
      city: location.city,
      state: location.state,
      avatar_url: payload.avatarUrl || undefined,
      banner_url: payload.bannerUrl || undefined,
      summary: payload.summary,
      profession: payload.profession,
      category: payload.category,
      experience_level: payload.experienceLevel,
      portfolio_url: payload.portfolioUrl || payload.websiteUrl || undefined,
    },
  });

  if (!authResult.ok) {
    if (authResult.reason === 'unknown') {
      const retryConflicts = await resolveSignupConflicts({
        email,
        phone: payload.phone,
      });

      if (retryConflicts.emailExists) {
        return {
          ok: false,
          message: 'JÃ¡ existe uma conta com este e-mail.',
          status: 409,
        };
      }

      if (retryConflicts.phoneExists) {
        return {
          ok: false,
          message: 'JÃ¡ existe uma conta com este telefone.',
          status: 409,
        };
      }
    }

    return {
      ok: false,
      message: authResult.message,
      status:
        authResult.reason === 'already_registered' || authResult.reason === 'duplicate_phone'
          ? 409
          : 502,
    };
  }

  if (!authResult.userId) {
    return {
      ok: false,
      message: 'NÃ£o foi possÃ­vel identificar a conta criada.',
      status: 502,
    };
  }

  if (authResult.accessToken) {
    const profileWrite = await createSupabaseUserProfiles({
      id: authResult.userId,
      email,
      role: 'freelancer',
      fullName: payload.name,
      accessToken: authResult.accessToken,
      avatarUrl: payload.avatarUrl || undefined,
      phone: payload.phone,
      city: location.city,
      state: location.state,
      bio: payload.summary,
      freelancer: {
        cep: payload.cep,
        category: payload.category,
        summary: payload.summary,
        description: payload.description,
        professionalTitle: payload.profession,
        experienceLevel: payload.experienceLevel,
        skills: [payload.profession, payload.category, 'Atendimento direto'],
        portfolioUrl: payload.portfolioUrl || payload.websiteUrl || 'https://www.linkedin.com/',
        websiteUrl: payload.websiteUrl || undefined,
        bannerUrl: payload.bannerUrl || undefined,
        linkedinUrl: payload.linkedinUrl || undefined,
        subscriptionTier: payload.subscriptionTier,
        subscriptionStatus,
        yearsExperience: payload.yearsExperience,
        availabilityStatus: 'available',
      },
    });

    if (!profileWrite.ok) {
      await deleteSupabaseAuthUser(authResult.userId);

      return {
        ok: false,
        message: profileWrite.message,
        status:
          profileWrite.reason === 'duplicate_email' || profileWrite.reason === 'duplicate_phone'
            ? 409
            : 502,
      };
    }
  }

  const sessionUser = (authResult.accessToken
    ? await ensureSupabaseSessionUserAfterAuth({
        authResult,
        email,
      })
    : null) ?? null;

  if (authResult.accessToken && !sessionUser) {
    return {
      ok: false,
      message: 'Perfil criado, mas a conta ainda nÃ£o ficou disponÃ­vel.',
      status: 409,
    };
  }

  return {
    ok: true,
    amountMonthly: getFreelancerPlanPrice(payload.subscriptionTier),
    authResult,
    authUserId: authResult.userId,
    requiresEmailConfirmation: !sessionUser,
    selectedPlanName: selectedPlan.name,
    sessionUser,
  };
}

async function ensureSupabaseSessionUserAfterAuth(input: {
  authResult: SuccessfulSupabaseAuth;
  email: string;
  lookup?: Awaited<ReturnType<typeof findSessionUserByEmail>>;
}): Promise<SessionUser | undefined> {
  if (!input.authResult.userId) {
    return undefined;
  }

  const fallbackRole = input.lookup?.user.role ?? input.authResult.role ?? undefined;
  const materializedRole =
    input.authResult.accessToken
      ? await ensureSupabaseUserSubtypeMaterialized({
          userId: input.authResult.userId,
          accessToken: input.authResult.accessToken,
          fallbackRole,
          fallbackName: input.lookup?.user.name ?? input.authResult.fullName ?? undefined,
          fallbackEmail: input.authResult.email ?? input.email,
        })
      : fallbackRole;
  const resolvedRole = materializedRole ?? fallbackRole;

  if (input.authResult.accessToken && resolvedRole) {
    const profileWrite = await createSupabaseUserProfiles({
      id: input.authResult.userId,
      email: input.authResult.email ?? input.email,
      role: resolvedRole,
      fullName: input.lookup?.user.name ?? input.authResult.fullName ?? input.email,
      accessToken: input.authResult.accessToken,
      phone: input.authResult.profileSeed.phone ?? undefined,
      city: input.authResult.profileSeed.city ?? undefined,
      state: input.authResult.profileSeed.state ?? undefined,
      avatarUrl: input.authResult.profileSeed.avatarUrl ?? undefined,
      bio: input.authResult.profileSeed.bio ?? undefined,
      freelancer:
        resolvedRole === 'freelancer'
          ? {
              category: input.authResult.profileSeed.category ?? undefined,
              summary: input.authResult.profileSeed.bio ?? undefined,
              description: input.authResult.profileSeed.bio ?? undefined,
              professionalTitle: input.authResult.profileSeed.professionalTitle ?? undefined,
              experienceLevel: parseFreelancerExperienceLevel(
                input.authResult.profileSeed.experienceLevel,
              ),
              skills: input.authResult.profileSeed.professionalTitle
                ? [
                    input.authResult.profileSeed.professionalTitle,
                    input.authResult.profileSeed.category ?? 'Atendimento direto',
                    'Atendimento direto',
                  ]
                : undefined,
              portfolioUrl: input.authResult.profileSeed.portfolioUrl ?? undefined,
              websiteUrl: input.authResult.profileSeed.portfolioUrl ?? undefined,
              bannerUrl: input.authResult.profileSeed.bannerUrl ?? undefined,
              subscriptionTier: 'normal',
              availabilityStatus: 'available',
            }
          : undefined,
    });

    if (!profileWrite.ok) {
      return undefined;
    }
  }

  let sessionUser = await findSessionUserById(
    input.authResult.userId,
    resolvedRole,
    input.authResult.accessToken ?? undefined,
  );
  if (sessionUser) {
    return sessionUser;
  }

  if (!input.authResult.accessToken || !resolvedRole) {
    return undefined;
  }

  // This repairs accounts that authenticated in Supabase Auth but still
  // do not have a usable application profile/subprofile row.
  const repairedProfileWrite = await createSupabaseUserProfiles({
    id: input.authResult.userId,
    email: input.authResult.email ?? input.email,
    role: resolvedRole,
    fullName: input.lookup?.user.name ?? input.authResult.fullName ?? input.email,
    accessToken: input.authResult.accessToken,
  });

  if (!repairedProfileWrite.ok) {
    return undefined;
  }

  sessionUser = await findSessionUserById(
    input.authResult.userId,
    resolvedRole,
    input.authResult.accessToken,
  );
  return sessionUser;
}

app.get('/api/health', (c) => {
  return c.json(
    envelope({
      status: 'ok',
      timestamp: new Date().toISOString(),
    }),
  );
});

app.get('/api/categories', (c) => {
  return c.json(envelope(categories));
});

app.get('/api/freelancers', catalogRateLimit, async (c) => {
  const parsed = searchSchema.safeParse({
    search: c.req.query('search'),
    category: c.req.query('category'),
    location: c.req.query('location'),
    experience: c.req.query('experience'),
  });

  if (!parsed.success) {
    return c.json(
      {
        message: 'ParÃ¢metros de busca invÃ¡lidos.',
        errors: parsed.error.flatten(),
      },
      400,
    );
  }

  const { category, experience, location, search } = parsed.data;
  const normalizedSearch = search.toLowerCase();

  const results = (await listPublicFreelancers()).filter((freelancer) => {
    const matchesSearch =
      !normalizedSearch ||
      freelancer.name.toLowerCase().includes(normalizedSearch) ||
      freelancer.profession.toLowerCase().includes(normalizedSearch) ||
      freelancer.skills.some((skill) => skill.toLowerCase().includes(normalizedSearch));

    const matchesCategory = category === 'Todos' || freelancer.category === category;
    const matchesLocation =
      !location || freelancer.location.toLowerCase().includes(location.toLowerCase());
    const matchesExperience =
      experience === 'Todos' || freelancer.experienceLevel === experience;

    return (
      matchesSearch &&
      matchesCategory &&
      matchesLocation &&
      matchesExperience
    );
  });

  return c.json(envelope(results.map((freelancer) => serializeFreelancer(freelancer))));
});

app.get('/api/freelancers/:slug', catalogRateLimit, async (c) => {
  const freelancer = await recordFreelancerProfileView(c.req.param('slug'));

  if (!freelancer) {
    return c.json({ message: 'Freelancer nÃ£o encontrado.' }, 404);
  }

  return c.json(envelope(serializeFreelancer(freelancer)));
});

app.get('/api/auth/session', async (c) => {
  const auth = await getAuthenticatedUser(c);
  if (!auth) {
    return unauthorized(c);
  }

  return c.json(envelope({ user: auth.user }));
});

app.post('/api/auth/email-availability', authLookupRateLimit, jsonBodyLimit, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = emailLookupSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        message: 'E-mail invalido.',
        errors: parsed.error.flatten(),
      },
      400,
    );
  }
  return c.json(
    envelope<EmailAvailabilityResponse>({
      exists: false,
    }),
    410,
  );
});

app.post('/api/auth/signup-availability', authLookupRateLimit, jsonBodyLimit, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = signupLookupSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        message: 'Dados invÃ¡lidos para validaÃ§Ã£o do cadastro.',
        errors: parsed.error.flatten(),
      },
      400,
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const conflicts = await resolveSignupConflicts({
    email,
    phone: parsed.data.phone,
  });

  return c.json(
    envelope<SignupAvailabilityResponse>({
      emailExists: conflicts.emailExists,
      phoneExists: conflicts.phoneExists,
    }),
  );
});

app.post('/api/profile/assets/:kind', assetUploadRateLimit, uploadBodyLimit, async (c) => {
  const auth = await getAuthenticatedUser(c);
  if (!auth) {
    return unauthorized(c);
  }

  if (!auth.supabaseAccessToken) {
    return c.json({ message: 'SessÃ£o autenticada sem contexto vÃ¡lido da plataforma.' }, 401);
  }

  const kind = c.req.param('kind');
  if (kind !== 'avatar' && kind !== 'banner') {
    return c.json({ message: 'Tipo de upload invalido.' }, 400);
  }

  if (kind === 'banner' && auth.user.role !== 'freelancer') {
    return forbidden(c, 'Apenas freelancers podem atualizar o banner do perfil.');
  }

  const formData = await c.req.formData().catch(() => null);
  const uploadedFile = formData?.get('file');
  if (!uploadedFile || typeof uploadedFile === 'string') {
    return c.json({ message: 'Envie um arquivo de imagem valido.' }, 400);
  }

  const uploadResult = await uploadSupabaseProfileAsset({
    accessToken: auth.supabaseAccessToken,
    file: uploadedFile,
    kind,
    userId: auth.user.id,
  });

  if (!uploadResult.ok) {
    return c.json(
      { message: uploadResult.message },
      uploadResult.reason === 'invalid_file'
        ? 400
        : uploadResult.reason === 'not_configured'
          ? 503
          : 502,
    );
  }

  if (kind === 'avatar') {
    const updated = await updateSupabaseProfileAvatarUrl({
      userId: auth.user.id,
      accessToken: auth.supabaseAccessToken,
      avatarUrl: uploadResult.publicUrl,
    });

    if (!updated) {
      return c.json(
        { message: 'A imagem foi enviada, mas nao foi possivel atualizar o avatar no perfil.' },
        502,
      );
    }
  }

  if (kind === 'banner') {
    const updated = await updateSupabaseFreelancerBannerUrl({
      userId: auth.user.id,
      accessToken: auth.supabaseAccessToken,
      bannerUrl: uploadResult.publicUrl,
    });

    if (!updated) {
      return c.json(
        { message: 'A imagem foi enviada, mas nao foi possivel atualizar o banner no perfil.' },
        502,
      );
    }
  }

  return c.json(
    envelope<ProfileAssetUploadResponse>(
      {
        kind,
        publicUrl: uploadResult.publicUrl,
        persisted: true,
      },
      kind === 'avatar'
        ? 'Foto de perfil atualizada com sucesso.'
        : 'Banner do perfil atualizado com sucesso.',
    ),
  );
});

app.post('/api/auth/register/client', signupRateLimit, jsonBodyLimit, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = clientSignupSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        message: 'Dados invÃ¡lidos para cadastro.',
        errors: parsed.error.flatten(),
      },
      400,
    );
  }

  if (!isSupabaseAuthEnabled()) {
    return c.json({ message: 'Cadastro disponÃ­vel apenas apÃ³s a configuraÃ§Ã£o da plataforma.' }, 503);
  }

  const currentAuth = await getAuthenticatedUser(c);
  if (currentAuth) {
    return c.json(
      { message: 'Voc\u00ea j\u00e1 est\u00e1 em uma conta ativa. Fa\u00e7a logout antes de criar outro cadastro.' },
      409,
    );
  }

  /* const registration = await provisionFreelancerRegistration(parsed.data, 'active');
  if (!registration.ok) {
    return c.json({ message: registration.message }, registration.status);
  }

  await attachSessionCookie(c, registration.authResult, registration.sessionUser);

  return c.json(
    envelope<RegistrationResponse>(
      {
        user: registration.sessionUser,
        requiresEmailConfirmation: registration.requiresEmailConfirmation,
      },
      registration.sessionUser
        ? `Cadastro concluÃ­do. ${registration.selectedPlanName} jÃ¡ estÃ¡ pronto para ativaÃ§Ã£o.`
        : 'Perfil criado com sucesso. Confirme seu e-mail antes do primeiro login.',
    ),
    201,
  ); */

  const email = parsed.data.email.trim().toLowerCase();
  const location = splitLocation(parsed.data.location);
  const conflicts = await resolveSignupConflicts({
    email,
    phone: parsed.data.phone,
  });
  if (conflicts.emailExists) {
    return c.json({ message: 'JÃ¡ existe uma conta com este e-mail.' }, 409);
  }
  if (conflicts.phoneExists) {
    return c.json({ message: 'JÃ¡ existe uma conta com este telefone.' }, 409);
  }

  const authResult = await registerSupabaseUser({
    email,
    password: parsed.data.password,
    name: parsed.data.name,
    role: 'client',
    metadata: {
      cep: parsed.data.cep,
      phone: parsed.data.phone,
      city: location.city,
      state: location.state,
    },
  });

  if (!authResult.ok) {
    if (authResult.reason === 'unknown') {
      const retryConflicts = await resolveSignupConflicts({
        email,
        phone: parsed.data.phone,
      });

      if (retryConflicts.emailExists) {
        return c.json({ message: 'JÃƒÂ¡ existe uma conta com este e-mail.' }, 409);
      }

      if (retryConflicts.phoneExists) {
        return c.json({ message: 'JÃƒÂ¡ existe uma conta com este telefone.' }, 409);
      }
    }

    return c.json(
      { message: authResult.message },
      authResult.reason === 'already_registered' || authResult.reason === 'duplicate_phone'
        ? 409
        : 502,
    );
  }

  if (!authResult.userId) {
    return c.json({ message: 'NÃ£o foi possÃ­vel identificar a conta criada.' }, 502);
  }

  if (authResult.accessToken) {
    const profileWrite = await createSupabaseUserProfiles({
      id: authResult.userId,
      email,
      role: 'client',
      fullName: parsed.data.name,
      accessToken: authResult.accessToken,
      phone: parsed.data.phone,
      city: location.city,
      state: location.state,
      client: {
        cep: parsed.data.cep,
      },
    });

    if (!profileWrite.ok) {
      await deleteSupabaseAuthUser(authResult.userId);

      return c.json(
        { message: profileWrite.message },
        profileWrite.reason === 'duplicate_email' || profileWrite.reason === 'duplicate_phone'
          ? 409
          : 502,
      );
    }
  }

  const sessionUser = (authResult.accessToken
    ? await ensureSupabaseSessionUserAfterAuth({
        authResult,
        email,
      })
    : null) ?? null;

  if (authResult.accessToken && !sessionUser) {
    return c.json(
      { message: 'Conta criada, mas o perfil ainda nÃ£o ficou disponÃ­vel.' },
      409,
    );
  }

  if (sessionUser) {
    const session = await createSession({
      userId: sessionUser.id,
      role: sessionUser.role,
      supabaseAccessToken: authResult.accessToken,
      supabaseRefreshToken: authResult.refreshToken,
      supabaseAccessTokenExpiresAt: authResult.accessTokenExpiresAt,
    });

    setSessionCookie(session, c);
  }

  return c.json(
    envelope<RegistrationResponse>(
      {
        user: sessionUser,
        requiresEmailConfirmation: !sessionUser,
      },
      sessionUser
        ? 'Conta de cliente criada com sucesso.'
        : 'Conta criada com sucesso. Confirme seu e-mail antes do primeiro login.',
    ),
    201,
  );
});

app.post('/api/auth/register/freelancer', signupRateLimit, jsonBodyLimit, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = freelancerSignupSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        message: 'Dados invÃ¡lidos para cadastro.',
        errors: parsed.error.flatten(),
      },
      400,
    );
  }

  if (!isSupabaseAuthEnabled()) {
    return c.json({ message: 'Cadastro disponÃ­vel apenas apÃ³s a configuraÃ§Ã£o da plataforma.' }, 503);
  }

  const currentAuth = await getAuthenticatedUser(c);
  if (currentAuth) {
    return c.json(
      { message: 'Voc\u00ea j\u00e1 est\u00e1 em uma conta ativa. Fa\u00e7a logout antes de criar outro cadastro.' },
      409,
    );
  }

  /*

  const email = parsed.data.email.trim().toLowerCase();
  const selectedPlan = freelancerPlanCatalog[parsed.data.subscriptionTier];
  const location = splitLocation(parsed.data.location);
  const conflicts = await resolveSignupConflicts({
    email,
    phone: parsed.data.phone,
  });
  if (conflicts.emailExists) {
    return c.json({ message: 'JÃ¡ existe uma conta com este e-mail.' }, 409);
  }
  if (conflicts.phoneExists) {
    return c.json({ message: 'JÃ¡ existe uma conta com este telefone.' }, 409);
  }

  const authResult = await registerSupabaseUser({
    email,
    password: parsed.data.password,
    name: parsed.data.name,
    role: 'freelancer',
    metadata: {
      phone: parsed.data.phone,
      city: location.city,
      state: location.state,
      avatar_url: parsed.data.avatarUrl || undefined,
      banner_url: parsed.data.bannerUrl || undefined,
      summary: parsed.data.summary,
      profession: parsed.data.profession,
      category: parsed.data.category,
      experience_level: parsed.data.experienceLevel,
      portfolio_url: parsed.data.portfolioUrl || parsed.data.websiteUrl || undefined,
    },
  });

  if (!authResult.ok) {
    if (authResult.reason === 'unknown') {
      const retryConflicts = await resolveSignupConflicts({
        email,
        phone: parsed.data.phone,
      });

      if (retryConflicts.emailExists) {
        return c.json({ message: 'JÃƒÂ¡ existe uma conta com este e-mail.' }, 409);
      }

      if (retryConflicts.phoneExists) {
        return c.json({ message: 'JÃƒÂ¡ existe uma conta com este telefone.' }, 409);
      }
    }

    return c.json(
      { message: authResult.message },
      authResult.reason === 'already_registered' || authResult.reason === 'duplicate_phone'
        ? 409
        : 502,
    );
  }

  if (!authResult.userId) {
    return c.json({ message: 'NÃ£o foi possÃ­vel identificar a conta criada.' }, 502);
  }

  if (authResult.accessToken) {
    const profileWrite = await createSupabaseUserProfiles({
      id: authResult.userId,
      email,
      role: 'freelancer',
      fullName: parsed.data.name,
      accessToken: authResult.accessToken,
      avatarUrl: parsed.data.avatarUrl || undefined,
      phone: parsed.data.phone,
      city: location.city,
      state: location.state,
      bio: parsed.data.summary,
      freelancer: {
        cep: parsed.data.cep,
        category: parsed.data.category,
        summary: parsed.data.summary,
        description: parsed.data.description,
        professionalTitle: parsed.data.profession,
        experienceLevel: parsed.data.experienceLevel,
        skills: [parsed.data.profession, parsed.data.category, 'Atendimento direto'],
        portfolioUrl:
          parsed.data.portfolioUrl || parsed.data.websiteUrl || 'https://www.linkedin.com/',
        websiteUrl: parsed.data.websiteUrl || undefined,
        bannerUrl: parsed.data.bannerUrl || undefined,
        linkedinUrl: parsed.data.linkedinUrl || undefined,
        subscriptionTier: parsed.data.subscriptionTier,
        yearsExperience: parsed.data.yearsExperience,
        availabilityStatus: 'available',
      },
    });

    if (!profileWrite.ok) {
      await deleteSupabaseAuthUser(authResult.userId);

      return c.json(
        { message: profileWrite.message },
        profileWrite.reason === 'duplicate_email' || profileWrite.reason === 'duplicate_phone'
          ? 409
          : 502,
      );
    }
  }

  const sessionUser = (authResult.accessToken
    ? await ensureSupabaseSessionUserAfterAuth({
        authResult,
        email,
      })
    : null) ?? null;

  if (authResult.accessToken && !sessionUser) {
    return c.json(
      { message: 'Perfil criado, mas a conta ainda nÃ£o ficou disponÃ­vel.' },
      409,
    );
  }

  if (sessionUser) {
    const session = await createSession({
      userId: sessionUser.id,
      role: sessionUser.role,
      supabaseAccessToken: authResult.accessToken,
      supabaseRefreshToken: authResult.refreshToken,
      supabaseAccessTokenExpiresAt: authResult.accessTokenExpiresAt,
    });

    setSessionCookie(session, c);
  }

  return c.json(
    envelope<RegistrationResponse>(
      {
        user: sessionUser,
        requiresEmailConfirmation: !sessionUser,
      },
      sessionUser
        ? `Cadastro concluÃ­do. ${selectedPlan.name} jÃ¡ estÃ¡ pronto para ativaÃ§Ã£o.`
        : 'Perfil criado com sucesso. Confirme seu e-mail antes do primeiro login.',
    ),
    201,
  );
  */

  return c.json(
    {
      message:
        'O cadastro de freelancer agora exige checkout do plano escolhido. Use /api/payments/freelancer-checkout para criar a conta e seguir para o pagamento.',
    },
    410,
  );
});

app.post('/api/payments/freelancer-checkout', signupRateLimit, jsonBodyLimit, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = freelancerSignupSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        message: 'Dados invÃ¡lidos para iniciar o checkout.',
        errors: parsed.error.flatten(),
      },
      400,
    );
  }

  if (!isSupabaseAuthEnabled()) {
    return c.json({ message: 'Checkout disponÃ­vel apenas apÃ³s a configuraÃ§Ã£o da plataforma.' }, 503);
  }

  const currentAuth = await getAuthenticatedUser(c);
  if (currentAuth) {
    return c.json(
      { message: 'VocÃª jÃ¡ estÃ¡ em uma conta ativa. FaÃ§a logout antes de criar outro cadastro.' },
      409,
    );
  }

  const registration = await provisionFreelancerRegistration(parsed.data, 'pending');
  if (!registration.ok) {
    return c.json({ message: registration.message }, registration.status);
  }

  try {
    const checkout = await createPaymentCheckoutSession({
      amountMonthly: registration.amountMonthly,
      customerEmail: parsed.data.email.trim().toLowerCase(),
      customerName: parsed.data.name,
      expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      planTier: parsed.data.subscriptionTier,
      provider: 'mock',
      userId: registration.authUserId,
    });

    await attachSessionCookie(c, registration.authResult, registration.sessionUser);

    return c.json(
      envelope<PaymentCheckoutStartResponse>(
        {
          checkout,
          checkoutPath: buildCheckoutPath(checkout.id),
        },
        'Conta criada em modo pendente. Continue no checkout para ativar o plano.',
      ),
      201,
    );
  } catch (error) {
    await deleteSupabaseAuthUser(registration.authUserId);

    return c.json(
      { message: error instanceof Error ? error.message : 'NÃ£o foi possÃ­vel iniciar o checkout.' },
      502,
    );
  }
});

app.post('/api/payments/freelancer-checkout/retry', paymentRateLimit, async (c) => {
  const currentAuth = await getAuthenticatedUser(c);
  if (!currentAuth) {
    return unauthorized(c, 'FaÃ§a login para continuar o pagamento.');
  }

  if (currentAuth.user.role !== 'freelancer') {
    return forbidden(c, 'Apenas freelancers podem gerar um checkout.');
  }

  const dashboard = await getFreelancerDashboard(
    currentAuth.user.id,
    currentAuth.supabaseAccessToken ?? undefined,
  );
  if (!dashboard) {
    return c.json({ message: 'Conta freelancer nÃ£o encontrada.' }, 404);
  }

  if (dashboard.subscription.status === 'active') {
    return c.json({ message: 'Seu plano jÃ¡ estÃ¡ ativo.' }, 409);
  }

  const existingCheckout = await findInProgressCheckoutByUserId(currentAuth.user.id);
  if (existingCheckout) {
    return c.json(
      envelope<PaymentCheckoutStartResponse>(
        {
          checkout: existingCheckout.checkout,
          checkoutPath: buildCheckoutPath(existingCheckout.checkout.id),
        },
        'Voce ja possui um checkout em andamento.',
      ),
      200,
    );
  }

  const checkout = await createPaymentCheckoutSession({
    amountMonthly: dashboard.subscription.priceMonthly,
    customerEmail: dashboard.account.email,
    customerName: dashboard.profile.name,
    expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    planTier: dashboard.subscription.tier,
    provider: 'mock',
    userId: currentAuth.user.id,
  }).catch(async (error) => {
    if (error instanceof Error && error.message.includes('checkout em andamento')) {
      const inProgressCheckout = await findInProgressCheckoutByUserId(currentAuth.user.id);
      if (inProgressCheckout) {
        return inProgressCheckout.checkout;
      }
    }
    throw error;
  });

  return c.json(
    envelope<PaymentCheckoutStartResponse>(
      {
        checkout,
        checkoutPath: buildCheckoutPath(checkout.id),
      },
      'Novo checkout criado com sucesso.',
    ),
    201,
  );
});

app.get('/api/payments/checkout/:checkoutId', paymentRateLimit, async (c) => {
  const checkoutId = c.req.param('checkoutId');
  if (!isUuid(checkoutId)) {
    return invalidIdentifier(c, 'Checkout invalido.');
  }
  const currentAuth = await getAuthenticatedUser(c);
  if (!currentAuth) {
    return unauthorized(c, 'Faca login para continuar o checkout.');
  }
  if (currentAuth.user.role !== 'freelancer') {
    return forbidden(c, 'Apenas freelancers podem acessar este checkout.');
  }
  const record = await findPaymentCheckoutSession(checkoutId);
  if (!record) {
    return c.json({ message: 'Checkout nao encontrado.' }, 404);
  }
  if (!record.userId || currentAuth.user.id !== record.userId) {
    return forbidden(c, 'Este checkout pertence a outra conta.');
  }
  return c.json(
    envelope<{ checkout: PaymentCheckoutStartResponse['checkout'] }>({
      checkout: record.checkout,
    }),
  );
});

app.post('/api/payments/checkout/:checkoutId/mock-complete', paymentRateLimit, jsonBodyLimit, async (c) => {
  const checkoutId = c.req.param('checkoutId');
  if (!isUuid(checkoutId)) {
    return invalidIdentifier(c, 'Checkout invalido.');
  }

  const currentAuth = await getAuthenticatedUser(c);
  if (!currentAuth) {
    return unauthorized(c, 'Faca login para concluir o checkout.');
  }
  if (currentAuth.user.role !== 'freelancer') {
    return forbidden(c, 'Apenas freelancers podem concluir este checkout.');
  }
  const record = await findPaymentCheckoutSession(checkoutId);
  if (!record) {
    return c.json({ message: 'Checkout nao encontrado.' }, 404);
  }
  if (!record.userId || currentAuth.user.id !== record.userId) {
    return forbidden(c, 'Este checkout pertence a outra conta.');
  }

  const body = await c.req.json().catch(() => null);
  const outcome =
    typeof body === 'object' &&
    body &&
    'outcome' in body &&
    (body as { outcome?: unknown }).outcome === 'approved'
      ? 'approved'
      : typeof body === 'object' &&
          body &&
          'outcome' in body &&
          (body as { outcome?: unknown }).outcome === 'pending'
        ? 'pending'
        : typeof body === 'object' &&
            body &&
            'outcome' in body &&
            (body as { outcome?: unknown }).outcome === 'failed'
          ? 'failed'
          : null;

  if (!outcome) {
    return c.json({ message: 'Resultado de pagamento invÃ¡lido.' }, 400);
  }

  if (record.checkout.status === 'approved') {
    return c.json(
      envelope<PaymentCheckoutDecisionResponse>({
        checkout: record.checkout,
        redirectPath: buildPaymentResultPath('approved', checkoutId),
      }),
    );
  }

  if (record.checkout.status === 'expired') {
    return c.json(
      envelope<PaymentCheckoutDecisionResponse>({
        checkout: record.checkout,
        redirectPath: buildPaymentResultPath('expired', checkoutId),
      }),
    );
  }

  if (outcome === 'approved') {
    if (!record.userId) {
      return c.json({ message: 'Checkout sem conta vinculada.' }, 409);
    }

    const startedAt = new Date().toISOString();
    const endsAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
    const updatedSubscription = await updateFreelancerSubscriptionState({
      userId: record.userId,
      tier: record.checkout.planTier,
      status: 'active',
      startedAt,
      endsAt,
    });

    if (!updatedSubscription) {
      return c.json({ message: 'NÃ£o foi possÃ­vel ativar o plano apÃ³s o pagamento.' }, 502);
    }
  }

  const updated = await updatePaymentCheckoutStatus(checkoutId, outcome);

  return c.json(
    envelope<PaymentCheckoutDecisionResponse>(
      {
        checkout: updated.checkout,
        redirectPath: buildPaymentResultPath(outcome, checkoutId),
      },
      outcome === 'approved'
        ? 'Pagamento aprovado. Plano ativado com sucesso.'
        : outcome === 'pending'
          ? 'Pagamento pendente. VocÃª pode acompanhar e concluir depois.'
          : 'Pagamento nÃ£o aprovado. Gere um novo checkout para tentar novamente.',
    ),
  );
});

app.post('/api/auth/login', loginRateLimit, jsonBodyLimit, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        message: 'Credenciais invÃ¡lidas.',
        errors: parsed.error.flatten(),
      },
      400,
    );
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  const loginIdentityLimit = enforceIdentityRateLimit(
    c.req.raw,
    'auth-login-identity',
    `${getClientIp(c.req.raw)}:${normalizedEmail}`,
    6,
    15 * 60 * 1000,
  );
  if (!loginIdentityLimit.allowed) {
    c.header('Retry-After', String(loginIdentityLimit.retryAfterSeconds));
    return c.json(
      { message: 'Muitas tentativas de login. Aguarde um pouco e tente novamente.' },
      429,
    );
  }

  if (!isSupabaseAuthEnabled()) {
    return c.json({ message: 'Login disponÃ­vel apenas apÃ³s a configuraÃ§Ã£o da plataforma.' }, 503);
  }

  const authResult = await authenticateWithSupabase({
    email: normalizedEmail,
    password: parsed.data.password,
  });

  if (!authResult.ok) {
    return c.json(
      { message: authResult.message },
      authResult.reason === 'invalid_credentials' ? 401 : 502,
    );
  }

  const sessionUser = await ensureSupabaseSessionUserAfterAuth({
    authResult,
    email: normalizedEmail,
  });

  if (!sessionUser) {
    return c.json(
      {
        message:
          'Conta autenticada, mas o perfil da aplicaÃ§Ã£o ainda nÃ£o foi concluÃ­do. Finalize o cadastro ou sincronize o perfil.',
      },
      409,
    );
  }

  const session = await createSession({
    userId: sessionUser.id,
    role: sessionUser.role,
    supabaseAccessToken: authResult.accessToken,
    supabaseRefreshToken: authResult.refreshToken,
    supabaseAccessTokenExpiresAt: authResult.accessTokenExpiresAt,
  });

  setSessionCookie(session, c);

  return c.json(
    envelope<AuthSessionPayload>(
      {
        user: sessionUser,
      },
      'Login realizado com sucesso.',
    ),
  );
});

app.post('/api/auth/logout', async (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (token) {
    await deleteSession(token);
  }

  clearSessionCookie(c);

  return c.json(envelope<null>(null, 'SessÃ£o encerrada com sucesso.'));
});

app.get('/api/dashboard/freelancer', async (c) => {
  const auth = await getAuthenticatedUser(c);
  if (!auth) {
    return unauthorized(c);
  }

  if (auth.user.role !== 'freelancer') {
    return forbidden(c, 'Apenas freelancers podem acessar este dashboard.');
  }

  const dashboard = await getFreelancerDashboard(auth.user.id, auth.supabaseAccessToken ?? undefined);
  if (!dashboard) {
    return c.json({ message: 'Dashboard do freelancer nÃ£o encontrado.' }, 404);
  }

  return c.json(envelope(dashboard));
});

app.get('/api/dashboard/client', async (c) => {
  const auth = await getAuthenticatedUser(c);
  if (!auth) {
    return unauthorized(c);
  }

  if (auth.user.role !== 'client') {
    return forbidden(c, 'Apenas clientes podem acessar este dashboard.');
  }

  const dashboard = await getClientDashboard(auth.user.id, auth.supabaseAccessToken ?? undefined);
  if (!dashboard) {
    return c.json({ message: 'Dashboard do cliente nÃ£o encontrado.' }, 404);
  }

  return c.json(envelope(dashboard));
});

app.get('/api/messages', async (c) => {
  const auth = await getAuthenticatedUser(c);
  if (!auth) {
    return unauthorized(c);
  }

  const inbox = await getConversationInbox(
    auth.user.id,
    auth.user.role,
    auth.supabaseAccessToken ?? undefined,
  );
  if (!inbox) {
    return c.json({ message: 'Central de mensagens nÃ£o encontrada.' }, 404);
  }

  return c.json(envelope(inbox));
});

app.post('/api/contacts', contactRateLimit, jsonBodyLimit, async (c) => {
  const auth = await getAuthenticatedUser(c);
  if (!auth) {
    return unauthorized(c);
  }

  if (auth.user.role !== 'client') {
    return forbidden(c, 'Apenas clientes podem enviar contatos pela plataforma.');
  }

  const client = await findClientRecordById(auth.user.id, auth.supabaseAccessToken ?? undefined);
  if (!client) {
    return c.json({ message: 'Conta de cliente nÃ£o encontrada.' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        message: 'Dados de contato invÃ¡lidos.',
        errors: parsed.error.flatten(),
      },
      400,
    );
  }

  const freelancerRecord = await findFreelancerRecordById(parsed.data.freelancerId);
  if (!freelancerRecord) {
    return c.json({ message: 'Freelancer nÃ£o encontrado.' }, 404);
  }

  if (freelancerRecord.subscription.status !== 'active') {
    return c.json({ message: 'Este freelancer nÃ£o estÃ¡ disponÃ­vel para novos contatos.' }, 409);
  }

  const result = await createOrContinueContact({
    freelancerId: freelancerRecord.profile.id,
    freelancerName: freelancerRecord.profile.name,
    freelancerEmail: freelancerRecord.email,
    clientId: client.profile.id,
    clientName: client.profile.name,
    clientLocation: client.profile.location,
    clientEmail: client.profile.email,
    clientPhone: client.profile.phone,
    subject: parsed.data.subject,
    message: parsed.data.message,
    channel: platformContactChannel,
    status: 'Novo',
  });

  return c.json(
    envelope(
      result.contact,
      result.created
        ? 'Chat iniciado com sucesso.'
        : 'Mensagem adicionada ao histÃ³rico da conversa existente.',
    ),
    result.created ? 201 : 200,
  );
});

app.post('/api/contacts/:contactId/messages', messageRateLimit, jsonBodyLimit, async (c) => {
  const auth = await getAuthenticatedUser(c);
  if (!auth) {
    return unauthorized(c);
  }

  const contactId = c.req.param('contactId');
  if (!isUuid(contactId)) {
    return invalidIdentifier(c, 'Conversa invalida.');
  }

  const contact = await findContactById(contactId);
  if (!contact) {
    return c.json({ message: 'Conversa nao encontrada.' }, 404);
  }
  if (auth.user.role === 'freelancer' && contact.freelancerId !== auth.user.id) {
    return forbidden(c, 'Voce nao pode responder esta conversa.');
  }
  if (auth.user.role === 'client' && contact.clientId !== auth.user.id) {
    return forbidden(c, 'Voce nao pode responder esta conversa.');
  }
  if (auth.user.role !== 'client' && auth.user.role !== 'freelancer') {
    return forbidden(c, 'Voce nao pode responder esta conversa.');
  }

  const body = await c.req.json().catch(() => null);
  const parsed = contactReplySchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        message: 'Mensagem invÃ¡lida.',
        errors: parsed.error.flatten(),
      },
      400,
    );
  }

  const updatedContact = await appendContactMessage({
    contactId: contact.id,
    senderRole: auth.user.role,
    senderUserId: auth.user.id,
    senderName: auth.user.name,
    message: parsed.data.message,
  });

  if (!updatedContact) {
    return c.json({ message: 'Conversa nÃ£o encontrada.' }, 404);
  }

  return c.json(envelope(updatedContact, 'Mensagem enviada com sucesso.'));
});

const port = Number(process.env.PORT ?? 8787);

serve(
  {
    fetch: app.fetch,
    port,
  },
  (info) => {
    console.log(`FaÃ§oFreela API online em http://localhost:${info.port}`);
  },
);
