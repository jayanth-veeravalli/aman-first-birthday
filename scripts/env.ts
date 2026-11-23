// Loads .env when present (locally); in CI the values come from GitHub secrets.
try {
  process.loadEnvFile('.env');
} catch {
  // no .env file — fine in CI
}

export function env(name: string): string {
  return (process.env[name] ?? '').trim();
}

export function requireEnv(names: string[]): void {
  const missing = names.filter((n) => !env(n));
  if (missing.length) {
    console.error(`✖ Missing required settings: ${missing.join(', ')}`);
    console.error('  Fill them in .env (locally) or as GitHub repository secrets (CI).');
    process.exit(1);
  }
}

/** SUPABASE_DB_URL if set, otherwise assembled from the SUPABASE_DB_* parts. */
export function dbUrl(): string {
  if (env('SUPABASE_DB_URL')) return env('SUPABASE_DB_URL');
  requireEnv(['SUPABASE_DB_HOST', 'SUPABASE_DB_USER', 'SUPABASE_DB_PASSWORD']);
  const user = encodeURIComponent(env('SUPABASE_DB_USER'));
  const pass = encodeURIComponent(env('SUPABASE_DB_PASSWORD'));
  const port = env('SUPABASE_DB_PORT') || '5432';
  const db = env('SUPABASE_DB_NAME') || 'postgres';
  return `postgresql://${user}:${pass}@${env('SUPABASE_DB_HOST')}:${port}/${db}`;
}
