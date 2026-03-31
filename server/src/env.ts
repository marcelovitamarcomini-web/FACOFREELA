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

export const serverEnv = {
  supabaseUrl: readEnv('VITE_SUPABASE_URL'),
  supabasePublishableKey:
    readEnv('VITE_SUPABASE_PUBLISHABLE_DEFAULT_KEY') ?? readEnv('VITE_SUPABASE_ANON_KEY'),
  supabaseServiceRoleKey: readEnv('SUPABASE_SERVICE_ROLE_KEY'),
};
