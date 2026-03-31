import { serve } from '@hono/node-server';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import { Hono } from 'hono';

import {
  categories,
  type ApiEnvelope,
  type AuthSessionPayload,
  type Freelancer,
  type ProfileAssetUploadResponse,
  freelancerPlanCatalog,
  platformContactChannel,
  type RegistrationResponse,
  type SessionUser,
} from '../../shared/contracts.js';
import {
  clientSignupSchema,
  contactReplySchema,
  contactSchema,
  freelancerSignupSchema,
  loginSchema,
  searchSchema,
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
  authenticateWithSupabase,
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
  getClientDashboard,
  getConversationInbox,
  getFreelancerDashboard,
  listPublicFreelancers,
  recordFreelancerProfileView,
  updateSupabaseProfileAvatarUrl,
  updateSupabaseFreelancerBannerUrl,
} from './user-store.js';

const app = new Hono();
const SESSION_COOKIE_NAME = 'facofreela.session';
const secureCookies = process.env.NODE_ENV === 'production';

app.use(
  '/api/*',
  cors({
    origin: (origin) => origin || undefined,
    credentials: true,
  }),
);

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

function setSessionCookie(token: string, c: Parameters<typeof setCookie>[0]) {
  const session = findSession(token);
  if (!session) {
    return;
  }

  const expiresInSeconds = Math.max(
    0,
    Math.floor((Date.parse(session.expiresAt) - Date.now()) / 1000),
  );

  setCookie(c, SESSION_COOKIE_NAME, token, {
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
      accessToken: session.supabaseAccessToken ?? null,
      refreshToken: session.supabaseRefreshToken ?? null,
      accessTokenExpiresAt: session.supabaseAccessTokenExpiresAt ?? null,
    };
  }

  updateSessionAuthState(session.token, {
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

  const session = findSession(token);
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
    deleteSession(token);
    clearSessionCookie(c);
    return null;
  }

  return {
    token,
    user,
    supabaseAccessToken: sessionAuth.accessToken ?? null,
  };
}

function unauthorized(c: Parameters<typeof getCookie>[0], message = 'Faça login para continuar.') {
  clearSessionCookie(c);
  return c.json({ message }, 401);
}

function forbidden(c: Parameters<typeof getCookie>[0], message: string) {
  return c.json({ message }, 403);
}

type SuccessfulSupabaseAuth = Extract<
  Awaited<ReturnType<typeof authenticateWithSupabase>>,
  { ok: true }
>;

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
    await createSupabaseUserProfiles({
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
              bannerUrl: input.authResult.profileSeed.bannerUrl ?? undefined,
              availabilityStatus: 'available',
            }
          : undefined,
    });
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
  await createSupabaseUserProfiles({
    id: input.authResult.userId,
    email: input.authResult.email ?? input.email,
    role: resolvedRole,
    fullName: input.lookup?.user.name ?? input.authResult.fullName ?? input.email,
    accessToken: input.authResult.accessToken,
  });

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

app.get('/api/freelancers', async (c) => {
  const parsed = searchSchema.safeParse({
    search: c.req.query('search'),
    category: c.req.query('category'),
    location: c.req.query('location'),
    experience: c.req.query('experience'),
  });

  if (!parsed.success) {
    return c.json(
      {
        message: 'Parâmetros de busca inválidos.',
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

app.get('/api/freelancers/:slug', async (c) => {
  const freelancer = await recordFreelancerProfileView(c.req.param('slug'));

  if (!freelancer) {
    return c.json({ message: 'Freelancer não encontrado.' }, 404);
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

app.post('/api/profile/assets/:kind', async (c) => {
  const auth = await getAuthenticatedUser(c);
  if (!auth) {
    return unauthorized(c);
  }

  if (!auth.supabaseAccessToken) {
    return c.json({ message: 'Sessão autenticada sem contexto válido da plataforma.' }, 401);
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

app.post('/api/auth/register/client', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = clientSignupSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        message: 'Dados inválidos para cadastro.',
        errors: parsed.error.flatten(),
      },
      400,
    );
  }

  if (!isSupabaseAuthEnabled()) {
    return c.json({ message: 'Cadastro disponível apenas após a configuração da plataforma.' }, 503);
  }

  const email = parsed.data.email.trim().toLowerCase();
  const location = splitLocation(parsed.data.location);
  const existingLookup = await findSessionUserByEmail(email);
  if (existingLookup) {
    return c.json({ message: 'Já existe uma conta com este e-mail.' }, 409);
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
    return c.json(
      { message: authResult.message },
      authResult.reason === 'already_registered' ? 409 : 502,
    );
  }

  if (!authResult.userId) {
    return c.json({ message: 'Não foi possível identificar a conta criada.' }, 502);
  }

  if (authResult.accessToken) {
    await createSupabaseUserProfiles({
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
  }

  const sessionUser = (authResult.accessToken
    ? await ensureSupabaseSessionUserAfterAuth({
        authResult,
        email,
      })
    : null) ?? null;

  if (authResult.accessToken && !sessionUser) {
    return c.json(
      { message: 'Conta criada, mas o perfil ainda não ficou disponível.' },
      409,
    );
  }

  if (sessionUser) {
    const session = createSession({
      userId: sessionUser.id,
      role: sessionUser.role,
      supabaseAccessToken: authResult.accessToken,
      supabaseRefreshToken: authResult.refreshToken,
      supabaseAccessTokenExpiresAt: authResult.accessTokenExpiresAt,
    });

    setSessionCookie(session.token, c);
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

app.post('/api/auth/register/freelancer', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = freelancerSignupSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        message: 'Dados inválidos para cadastro.',
        errors: parsed.error.flatten(),
      },
      400,
    );
  }

  if (!isSupabaseAuthEnabled()) {
    return c.json({ message: 'Cadastro disponível apenas após a configuração da plataforma.' }, 503);
  }

  const email = parsed.data.email.trim().toLowerCase();
  const selectedPlan = freelancerPlanCatalog[parsed.data.subscriptionTier];
  const location = splitLocation(parsed.data.location);
  const existingLookup = await findSessionUserByEmail(email);
  if (existingLookup) {
    return c.json({ message: 'Já existe uma conta com este e-mail.' }, 409);
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
    return c.json(
      { message: authResult.message },
      authResult.reason === 'already_registered' ? 409 : 502,
    );
  }

  if (!authResult.userId) {
    return c.json({ message: 'Não foi possível identificar a conta criada.' }, 502);
  }

  if (authResult.accessToken) {
    await createSupabaseUserProfiles({
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
        professionalTitle: parsed.data.profession,
        experienceLevel: parsed.data.experienceLevel,
        skills: [parsed.data.profession, parsed.data.category, 'Atendimento direto'],
        portfolioUrl:
          parsed.data.portfolioUrl || parsed.data.websiteUrl || 'https://www.linkedin.com/',
        bannerUrl: parsed.data.bannerUrl || undefined,
        availabilityStatus: 'available',
      },
    });
  }

  const sessionUser = (authResult.accessToken
    ? await ensureSupabaseSessionUserAfterAuth({
        authResult,
        email,
      })
    : null) ?? null;

  if (authResult.accessToken && !sessionUser) {
    return c.json(
      { message: 'Perfil criado, mas a conta ainda não ficou disponível.' },
      409,
    );
  }

  if (sessionUser) {
    const session = createSession({
      userId: sessionUser.id,
      role: sessionUser.role,
      supabaseAccessToken: authResult.accessToken,
      supabaseRefreshToken: authResult.refreshToken,
      supabaseAccessTokenExpiresAt: authResult.accessTokenExpiresAt,
    });

    setSessionCookie(session.token, c);
  }

  return c.json(
    envelope<RegistrationResponse>(
      {
        user: sessionUser,
        requiresEmailConfirmation: !sessionUser,
      },
      sessionUser
        ? `Cadastro concluído. ${selectedPlan.name} já está pronto para ativação.`
        : 'Perfil criado com sucesso. Confirme seu e-mail antes do primeiro login.',
    ),
    201,
  );
});

app.post('/api/auth/login', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        message: 'Credenciais inválidas.',
        errors: parsed.error.flatten(),
      },
      400,
    );
  }

  const normalizedEmail = parsed.data.email.trim().toLowerCase();
  if (!isSupabaseAuthEnabled()) {
    return c.json({ message: 'Login disponível apenas após a configuração da plataforma.' }, 503);
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
          'Conta autenticada, mas o perfil da aplicação ainda não foi concluído. Finalize o cadastro ou sincronize o perfil.',
      },
      409,
    );
  }

  const session = createSession({
    userId: sessionUser.id,
    role: sessionUser.role,
    supabaseAccessToken: authResult.accessToken,
    supabaseRefreshToken: authResult.refreshToken,
    supabaseAccessTokenExpiresAt: authResult.accessTokenExpiresAt,
  });

  setSessionCookie(session.token, c);

  return c.json(
    envelope<AuthSessionPayload>(
      {
        user: sessionUser,
      },
      'Login realizado com sucesso.',
    ),
  );
});

app.post('/api/auth/logout', (c) => {
  const token = getCookie(c, SESSION_COOKIE_NAME);
  if (token) {
    deleteSession(token);
  }

  clearSessionCookie(c);

  return c.json(envelope<null>(null, 'Sessão encerrada com sucesso.'));
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
    return c.json({ message: 'Dashboard do freelancer não encontrado.' }, 404);
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
    return c.json({ message: 'Dashboard do cliente não encontrado.' }, 404);
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
    return c.json({ message: 'Central de mensagens não encontrada.' }, 404);
  }

  return c.json(envelope(inbox));
});

app.post('/api/contacts', async (c) => {
  const auth = await getAuthenticatedUser(c);
  if (!auth) {
    return unauthorized(c);
  }

  if (auth.user.role !== 'client') {
    return forbidden(c, 'Apenas clientes podem enviar contatos pela plataforma.');
  }

  const client = await findClientRecordById(auth.user.id, auth.supabaseAccessToken ?? undefined);
  if (!client) {
    return c.json({ message: 'Conta de cliente não encontrada.' }, 404);
  }

  const body = await c.req.json().catch(() => null);
  const parsed = contactSchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        message: 'Dados de contato inválidos.',
        errors: parsed.error.flatten(),
      },
      400,
    );
  }

  const freelancerRecord = await findFreelancerRecordById(parsed.data.freelancerId);
  if (!freelancerRecord) {
    return c.json({ message: 'Freelancer não encontrado.' }, 404);
  }

  if (freelancerRecord.subscription.status !== 'active') {
    return c.json({ message: 'Este freelancer não está disponível para novos contatos.' }, 409);
  }

  const result = createOrContinueContact({
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
        : 'Mensagem adicionada ao histórico da conversa existente.',
    ),
    result.created ? 201 : 200,
  );
});

app.post('/api/contacts/:contactId/messages', async (c) => {
  const auth = await getAuthenticatedUser(c);
  if (!auth) {
    return unauthorized(c);
  }

  const contact = findContactById(c.req.param('contactId'));
  if (!contact) {
    return c.json({ message: 'Conversa não encontrada.' }, 404);
  }

  if (
    auth.user.role === 'freelancer' &&
    contact.freelancerId !== auth.user.id &&
    contact.freelancerEmail !==
      (await findFreelancerRecordById(auth.user.id, auth.supabaseAccessToken ?? undefined))?.email
  ) {
    return forbidden(c, 'Você não pode responder esta conversa.');
  }

  if (auth.user.role === 'client') {
    const client = await findClientRecordById(auth.user.id, auth.supabaseAccessToken ?? undefined);
    if (!client) {
      return c.json({ message: 'Conta de cliente não encontrada.' }, 404);
    }

    const isParticipant =
      contact.clientId === client.profile.id || contact.clientEmail === client.profile.email;
    if (!isParticipant) {
      return forbidden(c, 'Você não pode responder esta conversa.');
    }
  }

  const body = await c.req.json().catch(() => null);
  const parsed = contactReplySchema.safeParse(body);

  if (!parsed.success) {
    return c.json(
      {
        message: 'Mensagem inválida.',
        errors: parsed.error.flatten(),
      },
      400,
    );
  }

  const updatedContact = appendContactMessage({
    contactId: contact.id,
    senderRole: auth.user.role,
    senderName: auth.user.name,
    message: parsed.data.message,
  });

  if (!updatedContact) {
    return c.json({ message: 'Conversa não encontrada.' }, 404);
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
    console.log(`FaçoFreela API online em http://localhost:${info.port}`);
  },
);
