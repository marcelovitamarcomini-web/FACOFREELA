import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

type EnvMap = Record<string, string>;

let cachedEnv: EnvMap | null = null;

function parseEnvFile(filePath: string): EnvMap {
  if (!existsSync(filePath)) {
    return {};
  }

  return readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce<EnvMap>((entries, rawLine) => {
      const line = rawLine.trim();

      if (!line || line.startsWith('#')) {
        return entries;
      }

      const separatorIndex = line.indexOf('=');
      if (separatorIndex <= 0) {
        return entries;
      }

      const key = line.slice(0, separatorIndex).trim();
      const value = line.slice(separatorIndex + 1).trim().replace(/^['"]|['"]$/g, '');

      if (key) {
        entries[key] = value;
      }

      return entries;
    }, {});
}

function readLocalEnv(): EnvMap {
  if (cachedEnv) {
    return cachedEnv;
  }

  const envFiles = ['.env.local', '.env'];
  cachedEnv = envFiles.reduce<EnvMap>((entries, fileName) => {
    const filePath = resolve(process.cwd(), fileName);
    return {
      ...entries,
      ...parseEnvFile(filePath),
    };
  }, {});

  return cachedEnv;
}

export function readEnv(name: string): string | undefined {
  return process.env[name] ?? readLocalEnv()[name];
}

function normalizeOrigin(value?: string): string | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return new URL(value.trim()).origin;
  } catch {
    return undefined;
  }
}

function readAllowedOrigins(): string[] {
  const rawValue = readEnv('APP_ALLOWED_ORIGINS');
  const configuredOrigins = rawValue
    ?.split(',')
    .map((entry) => normalizeOrigin(entry))
    .filter((entry): entry is string => Boolean(entry)) ?? [];

  const defaults = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:4173',
    'http://127.0.0.1:4173',
  ];

  return [...new Set([...defaults, ...configuredOrigins])];
}

export const serverEnv = {
  nodeEnv: readEnv('NODE_ENV') ?? 'development',
  supabaseUrl: readEnv('VITE_SUPABASE_URL'),
  supabasePublishableKey:
    readEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY') ?? readEnv('VITE_SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: readEnv('SUPABASE_SERVICE_ROLE_KEY'),
  appSessionPepper: readEnv('APP_SESSION_PEPPER'),
  appSecretsEncryptionKey: readEnv('APP_SECRETS_ENCRYPTION_KEY'),
  allowedOrigins: readAllowedOrigins(),
};
