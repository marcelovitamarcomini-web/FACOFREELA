import { serve } from '@hono/node-server';
import { deleteCookie, getCookie, setCookie } from 'hono/cookie';
import { cors } from 'hono/cors';
import { Hono } from 'hono';

import {
  categories,
  type ApiEnvelope,
  type ContactMessage,
  type Freelancer,
  freelancerPlanCatalog,
  getFreelancerPlanPrice,
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
import { createPasswordHash, SESSION_MAX_AGE_SECONDS, verifyPassword } from './auth.js';
import {
  addContact,
  appendContactMessage,
  createSession,
  deleteSession,
  findContactById,
  findSession,
} from './data.js';
import {
  authenticateWithSupabase,
  isSupabaseAuthEnabled,
  registerSupabaseUser,
} from './supabase.js';
import {
  createLegacyClientShadow,
  createLegacyFreelancerShadow,
  createPublicSlug,
  createSupabaseUserProfiles,
  ensureSupabaseUserSubtypeMaterialized,
  ensureUniqueFreelancerSlug,
  findClientRecordById,
  findFreelancerRecordById,
  findSessionUserByEmail,
  findSessionUserById,
  getClientDashboard,
  getFreelancerDashboard,
  getNextClientId,
  getNextFreelancerId,
  isSupabaseManagedUserId,
  listPublicFreelancers,
  purgeLegacyUserShadow,
  recordFreelancerProfileView,
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

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function envelope<T>(data: T, message?: string): ApiEnvelope<T> {
  return { data, message };
}

function splitLocation(location: string) {
  return {
    city: location.split(',')[0]?.trim(),
    state: location.split(',')[1]?.trim(),
  };
}

async function canViewFreelancerPrices(c: Parameters<typeof getCookie>[0]): Promise<boolean> {
  const auth = await getAuthenticatedUser(c);

  return auth?.user.role === 'client';
}

function serializeFreelancer(freelancer: Freelancer, showPrice: boolean): Freelancer {
  return {
    ...freelancer,
    averagePrice: showPrice ? freelancer.averagePrice : null,
  };
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

async function getAuthenticatedUser(
  c: Parameters<typeof getCookie>[0],
): Promise<
  | {
      token: string;
      user: SessionUser;
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

  const user = await findSessionUserById(session.userId, session.role);
  if (!user) {
    deleteSession(token);
    clearSessionCookie(c);
    return null;
  }

  return { token, user };
}

function unauthorized(c: Parameters<typeof getCookie>[0], message = 'Faça login para continuar.') {
  clearSessionCookie(c);
  return c.json({ message }, 401);
}

function forbidden(c: Parameters<typeof getCookie>[0], message: string) {
  return c.json({ message }, 403);
}

async function syncLegacyUserProfileToSupabase(input: {
  accessToken: string;
  userId: string;
  email: string;
  role: SessionUser['role'];
  fallbackName: string;
}) {
  // Compatibility sync for accounts that still have a local user shadow.
  // It runs only after we finally obtain an authenticated Supabase access token.
  // Remove this once local user shadows are retired at the end of Block 1.
  if (input.role === 'client') {
    const legacyClient = await findClientRecordById(input.userId);
    if (!legacyClient) {
      return;
    }

    const location = splitLocation(legacyClient.profile.location);
    await createSupabaseUserProfiles({
      id: input.userId,
      email: input.email,
      role: 'client',
      fullName: legacyClient.profile.name,
      accessToken: input.accessToken,
      phone: legacyClient.profile.phone,
      city: location.city,
      state: location.state,
    });
    return;
  }

  const legacyFreelancer = await findFreelancerRecordById(input.userId);
  if (!legacyFreelancer) {
    return;
  }

  const location = splitLocation(legacyFreelancer.profile.location);
  await createSupabaseUserProfiles({
    id: input.userId,
    email: input.email,
    role: 'freelancer',
    fullName: legacyFreelancer.profile.name || input.fallbackName,
    accessToken: input.accessToken,
    avatarUrl: legacyFreelancer.profile.avatarUrl,
    phone: legacyFreelancer.phone,
    city: location.city,
    state: location.state,
    bio: legacyFreelancer.profile.summary,
    freelancer: {
      professionalTitle: legacyFreelancer.profile.profession,
      experienceLevel: legacyFreelancer.profile.experienceLevel,
      skills: legacyFreelancer.profile.skills,
      hourlyRate: legacyFreelancer.profile.averagePrice,
      portfolioUrl:
        legacyFreelancer.profile.portfolio[0]?.url ??
        legacyFreelancer.profile.websiteUrl ??
        'https://www.linkedin.com/',
      availabilityStatus: legacyFreelancer.profile.availability,
    },
  });
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
  let sessionUser = await findSessionUserById(input.authResult.userId, resolvedRole);
  if (sessionUser) {
    return sessionUser;
  }

  if (!input.authResult.accessToken || !resolvedRole) {
    return undefined;
  }

  if (input.lookup?.source === 'legacy') {
    await syncLegacyUserProfileToSupabase({
      accessToken: input.authResult.accessToken,
      userId: input.authResult.userId,
      email: input.authResult.email ?? input.email,
      role: resolvedRole,
      fallbackName: input.lookup.user.name,
    });
  } else {
    // This repairs accounts that authenticated in Supabase Auth but still
    // do not have a usable application profile/subprofile row.
    await createSupabaseUserProfiles({
      id: input.authResult.userId,
      email: input.authResult.email ?? input.email,
      role: resolvedRole,
      fullName: input.authResult.fullName ?? input.email,
      accessToken: input.authResult.accessToken,
    });
  }

  sessionUser = await findSessionUserById(input.authResult.userId, resolvedRole);
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
    maxPrice: c.req.query('maxPrice'),
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

  const { category, experience, location, maxPrice, search } = parsed.data;
  const normalizedSearch = search.toLowerCase();
  const showPrices = await canViewFreelancerPrices(c);

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
    const matchesPrice =
      !showPrices || !maxPrice || freelancer.averagePrice === null || freelancer.averagePrice <= maxPrice;

    return (
      matchesSearch &&
      matchesCategory &&
      matchesLocation &&
      matchesExperience &&
      matchesPrice
    );
  });

  return c.json(envelope(results.map((freelancer) => serializeFreelancer(freelancer, showPrices))));
});

app.get('/api/freelancers/:slug', async (c) => {
  const freelancer = await recordFreelancerProfileView(c.req.param('slug'));

  if (!freelancer) {
    return c.json({ message: 'Freelancer não encontrado.' }, 404);
  }

  return c.json(envelope(serializeFreelancer(freelancer, await canViewFreelancerPrices(c))));
});

app.get('/api/auth/session', async (c) => {
  const auth = await getAuthenticatedUser(c);
  if (!auth) {
    return unauthorized(c);
  }

  return c.json(envelope({ user: auth.user }));
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

  const email = parsed.data.email.trim().toLowerCase();
  let userId: string | undefined;
  let profilesSynced = false;
  const existingLookup = await findSessionUserByEmail(email);
  const canIgnoreLegacySupabaseShadow =
    existingLookup?.source === 'legacy' &&
    isSupabaseAuthEnabled() &&
    isSupabaseManagedUserId(existingLookup.user.id);

  if (existingLookup && !canIgnoreLegacySupabaseShadow) {
    return c.json({ message: 'Já existe uma conta com este e-mail.' }, 409);
  }

  if (isSupabaseAuthEnabled()) {
    const authResult = await registerSupabaseUser({
      email,
      password: parsed.data.password,
      name: parsed.data.name,
      role: 'client',
    });

    if (!authResult.ok) {
      return c.json(
        { message: authResult.message },
        authResult.reason === 'already_registered' ? 409 : 502,
      );
    }

    if (!authResult.userId) {
      return c.json({ message: 'Não foi possível identificar a conta criada no Supabase.' }, 502);
    }

    userId = authResult.userId;
    if (authResult.accessToken) {
      const location = splitLocation(parsed.data.location);
      profilesSynced = await createSupabaseUserProfiles({
        id: userId,
        email,
        role: 'client',
        fullName: parsed.data.name,
        accessToken: authResult.accessToken,
        phone: parsed.data.phone,
        city: location.city,
        state: location.state,
      });
    }
  } else {
    userId = getNextClientId();
  }

  if (!userId) {
    return c.json({ message: 'Não foi possível reservar um identificador para a conta.' }, 502);
  }

  if (canIgnoreLegacySupabaseShadow && existingLookup) {
    purgeLegacyUserShadow({
      id: existingLookup.user.id,
      email,
      role: existingLookup.user.role,
    });
  }

  if (!profilesSynced) {
    // Compatibility-only local shadow:
    // active when email confirmation prevents an authenticated write to client_profiles at sign-up.
    createLegacyClientShadow({
      profile: {
        id: userId,
        name: parsed.data.name,
        email,
        phone: parsed.data.phone,
        location: parsed.data.location,
        createdAt: new Date().toISOString(),
      },
      // Supabase-managed sign-ups keep only a profile shadow here, never a local login secret.
      passwordHash: isSupabaseAuthEnabled() ? '' : createPasswordHash(parsed.data.password),
    });
  }

  const session = createSession({
    userId,
    role: 'client',
  });

  setSessionCookie(session.token, c);

  return c.json(
    envelope<{ user: SessionUser }>(
      {
        user: {
          id: userId,
          name: parsed.data.name,
          role: 'client',
        },
      },
      'Conta de cliente criada com sucesso.',
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

  const email = parsed.data.email.trim().toLowerCase();
  const hasCnpj = parsed.data.hasCnpj === 'Sim';
  const selectedPlan = freelancerPlanCatalog[parsed.data.subscriptionTier];
  const selectedPlanPrice = getFreelancerPlanPrice(parsed.data.subscriptionTier, hasCnpj);
  let userId: string | undefined;
  let profilesSynced = false;
  const existingLookup = await findSessionUserByEmail(email);
  const canIgnoreLegacySupabaseShadow =
    existingLookup?.source === 'legacy' &&
    isSupabaseAuthEnabled() &&
    isSupabaseManagedUserId(existingLookup.user.id);

  if (existingLookup && !canIgnoreLegacySupabaseShadow) {
    return c.json({ message: 'Já existe uma conta com este e-mail.' }, 409);
  }

  if (isSupabaseAuthEnabled()) {
    const authResult = await registerSupabaseUser({
      email,
      password: parsed.data.password,
      name: parsed.data.name,
      role: 'freelancer',
    });

    if (!authResult.ok) {
      return c.json(
        { message: authResult.message },
        authResult.reason === 'already_registered' ? 409 : 502,
      );
    }

    if (!authResult.userId) {
      return c.json({ message: 'Não foi possível identificar a conta criada no Supabase.' }, 502);
    }

    userId = authResult.userId;
    if (authResult.accessToken) {
      const location = splitLocation(parsed.data.location);
      profilesSynced = await createSupabaseUserProfiles({
        id: userId,
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
          hourlyRate: parsed.data.averagePrice,
          portfolioUrl:
            parsed.data.portfolioUrl || parsed.data.websiteUrl || 'https://www.linkedin.com/',
          availabilityStatus: 'available',
        },
      });
    }
  } else {
    userId = getNextFreelancerId();
  }

  if (!userId) {
    return c.json({ message: 'Não foi possível reservar um identificador para a conta.' }, 502);
  }

  if (canIgnoreLegacySupabaseShadow && existingLookup) {
    purgeLegacyUserShadow({
      id: existingLookup.user.id,
      email,
      role: existingLookup.user.role,
    });
  }

  const baseSlug = `${slugify(parsed.data.name)}-${slugify(parsed.data.profession)}`;
  // Operational/showcase shadow:
  // even with canonical identity in Supabase, the freelancer still needs local extras
  // that are outside the Block 1 schema, such as subscription, metrics, slug and banner.
  createLegacyFreelancerShadow({
    email,
    hasCnpj,
    phone: parsed.data.phone,
    // Supabase-managed sign-ups must not authenticate from local residue.
    passwordHash: isSupabaseAuthEnabled() ? '' : createPasswordHash(parsed.data.password),
    profile: {
      id: userId,
      slug: profilesSynced
        ? createPublicSlug(parsed.data.name, userId)
        : ensureUniqueFreelancerSlug(baseSlug),
      name: parsed.data.name,
      profession: parsed.data.profession,
      category: parsed.data.category,
      summary: parsed.data.summary,
      description: parsed.data.description,
      location: parsed.data.location,
      experienceLevel: parsed.data.experienceLevel,
      yearsExperience: parsed.data.yearsExperience,
      averagePrice: parsed.data.averagePrice,
      skills: [parsed.data.profession, parsed.data.category, 'Atendimento direto'],
      portfolio: [
        {
          title: 'Portfólio principal',
          description: 'Link informado pelo profissional no momento do cadastro.',
          url: parsed.data.portfolioUrl || parsed.data.websiteUrl || 'https://www.linkedin.com/',
        },
      ],
      avatarUrl:
        parsed.data.avatarUrl ||
        'https://images.unsplash.com/photo-1527980965255-d3b416303d12?auto=format&fit=crop&w=400&q=80',
      bannerUrl:
        parsed.data.bannerUrl ||
        'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?auto=format&fit=crop&w=1400&q=80',
      linkedinUrl: parsed.data.linkedinUrl || undefined,
      websiteUrl: parsed.data.websiteUrl || undefined,
      whatsapp: parsed.data.phone.replace(/\D/g, ''),
      verified: false,
      availability: 'Perfil recém-publicado. Defina sua disponibilidade no painel.',
      memberSince: new Date().toISOString(),
    },
    subscription: {
      tier: parsed.data.subscriptionTier,
      name: selectedPlan.name,
      priceMonthly: selectedPlanPrice,
      status: 'active',
      startedAt: new Date().toISOString(),
      endsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    },
    metrics: {
      profileViews: 0,
      contactClicks: 0,
      messagesReceived: 0,
    },
  });

  const session = createSession({
    userId,
    role: 'freelancer',
  });

  setSessionCookie(session.token, c);

  return c.json(
    envelope<{ user: SessionUser }>(
      {
        user: {
          id: userId,
          name: parsed.data.name,
          role: 'freelancer',
        },
      },
      `Cadastro concluído. ${selectedPlan.name} já está pronto para ativação.`,
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
  let lookup = await findSessionUserByEmail(normalizedEmail);
  if (!lookup && !isSupabaseAuthEnabled()) {
    return c.json({ message: 'Usuário não encontrado.' }, 404);
  }

  const isSupabaseManagedLegacyLookup =
    lookup?.source === 'legacy' &&
    isSupabaseAuthEnabled() &&
    isSupabaseManagedUserId(lookup.user.id);
  const localPasswordHash = lookup?.passwordHash;
  const passwordMatchesLocalHash = localPasswordHash
    ? verifyPassword(parsed.data.password, localPasswordHash)
    : false;
  let sessionUser: SessionUser | undefined = lookup?.user;

  if (isSupabaseAuthEnabled()) {
    const authResult = await authenticateWithSupabase({
      email: normalizedEmail,
      password: parsed.data.password,
    });

    if (!authResult.ok) {
      if (isSupabaseManagedLegacyLookup) {
        return c.json(
          { message: authResult.message },
          authResult.reason === 'invalid_credentials' ? 401 : 502,
        );
      }

      if (!passwordMatchesLocalHash) {
        return c.json(
          { message: authResult.message },
          authResult.reason === 'invalid_credentials' ? 401 : 502,
        );
      }

      if (lookup?.source === 'legacy') {
        const migrationResult = await registerSupabaseUser({
          email: normalizedEmail,
          password: parsed.data.password,
          name: lookup.user.name,
          role: lookup.user.role,
        });

        if (!migrationResult.ok && migrationResult.reason !== 'already_registered') {
          return c.json({ message: migrationResult.message }, 502);
        }

        if (!migrationResult.ok) {
          const refreshedLookup = await findSessionUserByEmail(normalizedEmail);
          if (refreshedLookup) {
            sessionUser = refreshedLookup.user;
          }
        } else {
          sessionUser =
            (await ensureSupabaseSessionUserAfterAuth({
              authResult: migrationResult,
              email: normalizedEmail,
              lookup,
            })) ??
            sessionUser;
        }
      }
    } else {
      sessionUser = await ensureSupabaseSessionUserAfterAuth({
        authResult,
        email: normalizedEmail,
        lookup,
      });

      if (!sessionUser) {
        return c.json(
          {
            message:
              'Conta autenticada, mas o perfil da aplicaÃ§Ã£o ainda nÃ£o foi concluÃ­do. Finalize o cadastro ou sincronize o perfil no Supabase.',
          },
          409,
        );
      }
    }
  } else if (!passwordMatchesLocalHash) {
    return c.json({ message: 'Senha incorreta.' }, 401);
  }

  if (!sessionUser) {
    return c.json({ message: 'UsuÃ¡rio nÃ£o encontrado.' }, 404);
  }

  const session = createSession({
    userId: sessionUser.id,
    role: sessionUser.role,
  });

  setSessionCookie(session.token, c);

  return c.json(
    envelope(
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

  const dashboard = await getFreelancerDashboard(auth.user.id);
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

  const dashboard = await getClientDashboard(auth.user.id);
  if (!dashboard) {
    return c.json({ message: 'Dashboard do cliente não encontrado.' }, 404);
  }

  return c.json(envelope(dashboard));
});

app.post('/api/contacts', async (c) => {
  const auth = await getAuthenticatedUser(c);
  if (!auth) {
    return unauthorized(c);
  }

  if (auth.user.role !== 'client') {
    return forbidden(c, 'Apenas clientes podem enviar contatos pela plataforma.');
  }

  const client = await findClientRecordById(auth.user.id);
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

  const contactId = `contact-${Date.now()}`;
  const createdAt = new Date().toISOString();

  const contact: ContactMessage = {
    id: contactId,
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
    channel: parsed.data.channel,
    createdAt,
    status: 'Novo',
    messages: [
      {
        id: `${contactId}-message-1`,
        senderRole: 'client',
        senderName: client.profile.name,
        body: parsed.data.message,
        createdAt,
      },
    ],
  };

  addContact(contact);

  return c.json(envelope(contact, 'Contato registrado com sucesso.'), 201);
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

  if (contact.channel !== 'Plataforma') {
    return c.json({ message: 'Este contato segue pelo canal de e-mail.' }, 409);
  }

  if (
    auth.user.role === 'freelancer' &&
    contact.freelancerId !== auth.user.id &&
    contact.freelancerEmail !== (await findFreelancerRecordById(auth.user.id))?.email
  ) {
    return forbidden(c, 'Você não pode responder esta conversa.');
  }

  if (auth.user.role === 'client') {
    const client = await findClientRecordById(auth.user.id);
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
