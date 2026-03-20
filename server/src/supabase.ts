import { createClient } from '@supabase/supabase-js';

import type { UserRole } from '../../shared/contracts.js';
import { serverEnv } from './env.js';

type SupabaseAuthResult =
  | {
      ok: true;
      accessToken: string | null;
      userId: string | null;
      email: string | null;
      fullName: string | null;
      role: UserRole | null;
    }
  | {
      ok: false;
      message: string;
      reason: 'already_registered' | 'invalid_credentials' | 'not_configured' | 'unknown';
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

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function isAlreadyRegisteredMessage(message: string): boolean {
  const normalizedMessage = message.toLowerCase();
  return (
    normalizedMessage.includes('already registered') ||
    normalizedMessage.includes('already been registered') ||
    normalizedMessage.includes('user already exists')
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

function createSuccessResult(data: {
  session?: { access_token?: string | null } | null;
  user?: { id?: string | null; email?: string | null; user_metadata?: unknown } | null;
}): Extract<SupabaseAuthResult, { ok: true }> {
  return {
    ok: true,
    accessToken: data.session?.access_token ?? null,
    userId: data.user?.id ?? null,
    email: data.user?.email ?? null,
    fullName: readSupabaseMetadataValue(data.user?.user_metadata, ['full_name', 'name']),
    role: readSupabaseUserRole(data.user?.user_metadata),
  };
}

export function isSupabaseAuthEnabled(): boolean {
  return Boolean(supabase);
}

export function getSupabaseClient() {
  return supabase;
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

export async function registerSupabaseUser(input: {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}): Promise<SupabaseAuthResult> {
  if (!supabase) {
    return {
      ok: false,
      message: 'Supabase não configurado no servidor.',
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
      },
    },
  });

  if (!error) {
    return createSuccessResult(data);
  }

  const message = getErrorMessage(error, 'Não foi possível criar a conta no Supabase.');
  if (isAlreadyRegisteredMessage(message)) {
    return {
      ok: false,
      message: 'Já existe uma conta de autenticação com este e-mail.',
      reason: 'already_registered',
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
      message: 'Supabase não configurado no servidor.',
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

  const message = getErrorMessage(error, 'Não foi possível validar sua conta no Supabase.');
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
