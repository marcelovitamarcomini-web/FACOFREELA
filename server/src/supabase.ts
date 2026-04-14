import { createClient } from '@supabase/supabase-js';

import type { ProfileAssetKind, UserRole } from '../../shared/contracts.js';
import { serverEnv } from './env.js';

type SupabaseAuthResult =
  | {
      ok: true;
      accessToken: string | null;
      refreshToken: string | null;
      accessTokenExpiresAt: string | null;
      userId: string | null;
      email: string | null;
      fullName: string | null;
      role: UserRole | null;
      profileSeed: {
        phone: string | null;
        city: string | null;
        state: string | null;
        avatarUrl: string | null;
        bannerUrl: string | null;
        bio: string | null;
        professionalTitle: string | null;
        category: string | null;
        experienceLevel: string | null;
        portfolioUrl: string | null;
      };
    }
  | {
      ok: false;
      message: string;
      reason:
        | 'already_registered'
        | 'duplicate_phone'
        | 'invalid_credentials'
        | 'not_configured'
        | 'unknown';
    };

type SupabaseStorageUploadResult =
  | {
      ok: true;
      publicUrl: string;
      path: string;
      contentType: string;
    }
  | {
      ok: false;
      message: string;
      reason: 'invalid_file' | 'not_configured' | 'upload_failed';
    };

const supabase =
  serverEnv.supabaseUrl && serverEnv.supabasePublishableKey
    ? createClient(serverEnv.supabaseUrl, serverEnv.supabasePublishableKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : null;

const supabaseServerReadClient =
  serverEnv.supabaseUrl && serverEnv.supabaseServiceRoleKey
    ? createClient(serverEnv.supabaseUrl, serverEnv.supabaseServiceRoleKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      })
    : supabase;

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

const profileAssetSizeLimits: Record<ProfileAssetKind, number> = {
  avatar: 5 * 1024 * 1024,
  banner: 8 * 1024 * 1024,
};

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function normalizePhoneDigits(value?: string | null): string | null {
  const normalized = value?.replace(/\D/g, '') ?? '';
  return normalized ? normalized : null;
}

function isAlreadyRegisteredMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('ja existe uma conta com este e-mail') ||
    normalizedMessage.includes('já existe uma conta com este e-mail') ||
    normalizedMessage.includes('ja existe uma conta de autenticacao com este e-mail') ||
    normalizedMessage.includes('já existe uma conta de autenticação com este e-mail') ||
    normalizedMessage.includes('already registered') ||
    normalizedMessage.includes('already been registered') ||
    normalizedMessage.includes('user already exists')
  );
}

function isDuplicatePhoneMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('ja existe uma conta com este telefone') ||
    normalizedMessage.includes('já existe uma conta com este telefone') ||
    normalizedMessage.includes('ja existe uma conta de autenticacao com este telefone') ||
    normalizedMessage.includes('já existe uma conta de autenticação com este telefone') ||
    normalizedMessage.includes('auth_users_phone_normalized_key') ||
    (normalizedMessage.includes('duplicate key') && normalizedMessage.includes('phone'))
  );
}

function isInvalidCredentialsMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('invalid login credentials') ||
    normalizedMessage.includes('email not confirmed') ||
    normalizedMessage.includes('invalid email or password') ||
    normalizedMessage.includes('email or password')
  );
}

function readSupabaseMetadataValue(
  metadata: unknown,
  keys: string[],
): string | null {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  for (const key of keys) {
    const value = (metadata as Record<string, unknown>)[key];
    if (typeof value === 'string' && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function readSupabaseUserRole(metadata: unknown): UserRole | null {
  const value = readSupabaseMetadataValue(metadata, ['user_type', 'role']);
  return value === 'client' || value === 'freelancer' ? value : null;
}

function isObfuscatedExistingSignupUser(
  user: { app_metadata?: unknown; email?: string | null; identities?: unknown } | null | undefined,
  expectedEmail: string,
): boolean {
  if (!user) {
    return false;
  }

  const normalizedExpectedEmail = expectedEmail.trim().toLowerCase();
  const normalizedUserEmail = user.email?.trim().toLowerCase() ?? '';
  const appMetadata =
    user.app_metadata && typeof user.app_metadata === 'object'
      ? (user.app_metadata as Record<string, unknown>)
      : {};
  const provider = typeof appMetadata.provider === 'string' ? appMetadata.provider : undefined;
  const providers = Array.isArray(appMetadata.providers)
    ? appMetadata.providers.filter((value): value is string => typeof value === 'string')
    : [];
  const identityCount = Array.isArray(user.identities) ? user.identities.length : 0;

  return (
    normalizedUserEmail !== normalizedExpectedEmail ||
    (identityCount === 0 && provider !== 'email' && !providers.includes('email'))
  );
}

function inferProfileAssetExtension(file: File): string | null {
  const normalizedType = file.type.trim().toLowerCase();
  if (normalizedType in profileAssetMimeTypes) {
    return profileAssetMimeTypes[normalizedType as keyof typeof profileAssetMimeTypes];
  }

  const nameMatch = /\.([a-z0-9]+)$/i.exec(file.name);
  if (!nameMatch) {
    return null;
  }

  const normalizedExtension = nameMatch[1].toLowerCase();
  switch (normalizedExtension) {
    case 'jpg':
    case 'jpeg':
      return 'jpg';
    case 'png':
    case 'webp':
    case 'avif':
      return normalizedExtension;
    default:
      return null;
  }
}

function buildProfileAssetPath(userId: string, kind: ProfileAssetKind, extension: string): string {
  return `${userId}/${kind}.${extension}`;
}

async function removeProfileAssetVariants(input: {
  accessToken: string;
  bucket: 'avatars' | 'banners';
  currentPath: string;
  kind: ProfileAssetKind;
  userId: string;
}) {
  const client = getSupabaseStorageClient(input.accessToken);
  if (!client) {
    return;
  }

  const variants = [...new Set(Object.values(profileAssetMimeTypes))];
  const stalePaths = variants
    .map((extension) => buildProfileAssetPath(input.userId, input.kind, extension))
    .filter((path) => path !== input.currentPath);

  if (stalePaths.length === 0) {
    return;
  }

  await client.storage.from(input.bucket).remove(stalePaths);
}

function readSupabaseProfileSeed(metadata: unknown) {
  return {
    phone: readSupabaseMetadataValue(metadata, ['phone']),
    city: readSupabaseMetadataValue(metadata, ['city']),
    state: readSupabaseMetadataValue(metadata, ['state']),
    avatarUrl: readSupabaseMetadataValue(metadata, ['avatar_url', 'avatarUrl']),
    bannerUrl: readSupabaseMetadataValue(metadata, ['banner_url', 'bannerUrl']),
    bio: readSupabaseMetadataValue(metadata, ['bio', 'summary']),
    professionalTitle: readSupabaseMetadataValue(metadata, ['professional_title', 'profession']),
    category: readSupabaseMetadataValue(metadata, ['category']),
    experienceLevel: readSupabaseMetadataValue(metadata, ['experience_level', 'experienceLevel']),
    portfolioUrl: readSupabaseMetadataValue(metadata, ['portfolio_url', 'portfolioUrl', 'websiteUrl']),
  };
}

function createSuccessResult(data: {
  session?: {
    access_token?: string | null;
    refresh_token?: string | null;
    expires_at?: number | null;
  } | null;
  user?: { id?: string | null; email?: string | null; user_metadata?: unknown } | null;
}): Extract<SupabaseAuthResult, { ok: true }> {
  return {
    ok: true,
    accessToken: data.session?.access_token ?? null,
    refreshToken: data.session?.refresh_token ?? null,
    accessTokenExpiresAt: data.session?.expires_at
      ? new Date(data.session.expires_at * 1000).toISOString()
      : null,
    userId: data.user?.id ?? null,
    email: data.user?.email ?? null,
    fullName: readSupabaseMetadataValue(data.user?.user_metadata, ['full_name', 'name']),
    role: readSupabaseUserRole(data.user?.user_metadata),
    profileSeed: readSupabaseProfileSeed(data.user?.user_metadata),
  };
}

export function isSupabaseAuthEnabled(): boolean {
  return Boolean(supabase);
}

export function getSupabaseClient() {
  return supabase;
}

export function getSupabaseServerReadClient() {
  return supabaseServerReadClient;
}

export function createSupabaseUserClient(accessToken: string) {
  if (!serverEnv.supabaseUrl || !serverEnv.supabasePublishableKey) {
    return null;
  }

  return createClient(serverEnv.supabaseUrl, serverEnv.supabasePublishableKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

export async function deleteSupabaseAuthUser(userId: string): Promise<boolean> {
  if (!supabaseServerReadClient) {
    return false;
  }

  const { error } = await supabaseServerReadClient.auth.admin.deleteUser(userId);
  return !error;
}

export async function checkAuthEmailExists(email: string): Promise<boolean | null> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) {
    return false;
  }

  const client = supabaseServerReadClient;
  if (!client) {
    return null;
  }

  const { data, error } = await client.rpc('auth_email_exists', {
    target_email: normalizedEmail,
  });

  if (error) {
    return null;
  }

  return data === true;
}

export async function checkAuthPhoneExists(phone: string): Promise<boolean | null> {
  const normalizedPhone = normalizePhoneDigits(phone);
  if (!normalizedPhone) {
    return false;
  }

  const client = supabaseServerReadClient;
  if (!client) {
    return null;
  }

  const { data, error } = await client.rpc('auth_phone_exists', {
    target_phone: normalizedPhone,
  });

  if (error) {
    return null;
  }

  return data === true;
}

function getSupabaseStorageClient(accessToken: string) {
  return createSupabaseUserClient(accessToken) ?? supabaseServerReadClient;
}

export async function uploadSupabaseProfileAsset(input: {
  accessToken: string;
  file: File;
  kind: ProfileAssetKind;
  userId: string;
}): Promise<SupabaseStorageUploadResult> {
  const client = getSupabaseStorageClient(input.accessToken);
  if (!client) {
    return {
      ok: false,
      message: 'Infraestrutura de autenticação não configurada no servidor.',
      reason: 'not_configured',
    };
  }

  const extension = inferProfileAssetExtension(input.file);
  if (!extension) {
    return {
      ok: false,
      message: 'Envie uma imagem JPG, PNG, WEBP ou AVIF.',
      reason: 'invalid_file',
    };
  }

  if (input.file.size > profileAssetSizeLimits[input.kind]) {
    return {
      ok: false,
      message:
        input.kind === 'avatar'
          ? 'A foto de perfil deve ter no maximo 5 MB.'
          : 'O banner deve ter no maximo 8 MB.',
      reason: 'invalid_file',
    };
  }

  const bucket = profileAssetBuckets[input.kind];
  const path = buildProfileAssetPath(input.userId, input.kind, extension);
  const contentType = input.file.type || `image/${extension === 'jpg' ? 'jpeg' : extension}`;
  const fileBytes = new Uint8Array(await input.file.arrayBuffer());
  const uploadResult = await client.storage.from(bucket).upload(path, fileBytes, {
    cacheControl: '3600',
    contentType,
    upsert: true,
  });

  if (uploadResult.error) {
    return {
      ok: false,
      message:
        uploadResult.error.message || 'Nao foi possivel enviar o arquivo para o Storage.',
      reason: 'upload_failed',
    };
  }

  await removeProfileAssetVariants({
    accessToken: input.accessToken,
    bucket,
    currentPath: path,
    kind: input.kind,
    userId: input.userId,
  });

  const { data } = client.storage.from(bucket).getPublicUrl(path);
  return {
    ok: true,
    publicUrl: data.publicUrl,
    path,
    contentType,
  };
}

export async function refreshSupabaseUserSession(input: {
  refreshToken: string;
}): Promise<SupabaseAuthResult> {
  if (!supabase) {
    return {
      ok: false,
      message: 'Infraestrutura de autenticação não configurada no servidor.',
      reason: 'not_configured',
    };
  }

  const { data, error } = await supabase.auth.refreshSession({
    refresh_token: input.refreshToken,
  });

  if (!error) {
    return createSuccessResult(data);
  }

  return {
    ok: false,
    message: getErrorMessage(error, 'Não foi possível renovar a sessão.'),
    reason: 'unknown',
  };
}

export async function registerSupabaseUser(input: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
  metadata?: Record<string, unknown>;
}): Promise<SupabaseAuthResult> {
  if (!supabase) {
    return {
      ok: false,
      message: 'Infraestrutura de autenticação não configurada no servidor.',
      reason: 'not_configured',
    };
  }

  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      data: {
        full_name: input.name,
        user_type: input.role,
        name: input.name,
        role: input.role,
        ...input.metadata,
      },
    },
  });

  if (!error && isObfuscatedExistingSignupUser(data.user, input.email) && !data.session) {
    return {
      ok: false,
      message: 'Já existe uma conta de autenticação com este e-mail.',
      reason: 'already_registered',
    };
  }

  if (!error) {
    return createSuccessResult(data);
  }

  const message = getErrorMessage(error, 'Não foi possível criar a conta.');
  if (isAlreadyRegisteredMessage(message)) {
    return {
      ok: false,
      message: 'Já existe uma conta de autenticação com este e-mail.',
      reason: 'already_registered',
    };
  }

  if (isDuplicatePhoneMessage(message)) {
    return {
      ok: false,
      message: 'JÃ¡ existe uma conta de autenticaÃ§Ã£o com este telefone.',
      reason: 'duplicate_phone',
    };
  }

  return {
    ok: false,
    message,
    reason: 'unknown',
  };
}

export async function authenticateWithSupabase(input: {
  email: string;
  password: string;
}): Promise<SupabaseAuthResult> {
  if (!supabase) {
    return {
      ok: false,
      message: 'Infraestrutura de autenticação não configurada no servidor.',
      reason: 'not_configured',
    };
  }

  const { data, error } = await supabase.auth.signInWithPassword({
    email: input.email,
    password: input.password,
  });

  if (!error) {
    return createSuccessResult(data);
  }

  const message = getErrorMessage(error, 'Não foi possível validar sua conta.');
  if (isInvalidCredentialsMessage(message)) {
    return {
      ok: false,
      message: 'E-mail ou senha inválidos.',
      reason: 'invalid_credentials',
    };
  }

  return {
    ok: false,
    message,
    reason: 'unknown',
  };
}
