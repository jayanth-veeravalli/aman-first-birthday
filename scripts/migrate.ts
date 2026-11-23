// Applies new SQL files from db/migrations (each in a transaction, tracked so re-runs are no-ops),
// then stores the bcrypt hash of RSVP_PASSCODE for the hosts' responses page.
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postgres from 'postgres';
import { dbUrl, env, requireEnv } from './env.ts';

const MIGRATIONS_DIR = fileURLToPath(new URL('../db/migrations/', import.meta.url));

export async function migrate(): Promise<void> {
  requireEnv(['RSVP_PASSCODE']);
  const url = dbUrl();
  const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url);
  const sql = postgres(url, { ssl: isLocal ? false : 'require', prepare: false, max: 1, onnotice: () => {} });

  try {
    await sql`create schema if not exists private`;
    await sql`
      create table if not exists private.schema_migrations (
        name text primary key,
        applied_at timestamptz not null default now()
      )`;

    const applied = new Set(
      (await sql<{ name: string }[]>`select name from private.schema_migrations`).map((r) => r.name),
    );
    const files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith('.sql')).sort();
    const pending = files.filter((f) => !applied.has(f));

    for (const file of pending) {
      const body = await readFile(join(MIGRATIONS_DIR, file), 'utf8');
      await sql.begin(async (tx) => {
        await tx.unsafe(body);
        await tx`insert into private.schema_migrations (name) values (${file})`;
      });
      console.log(`✔ applied ${file}`);
    }
    if (!pending.length) console.log('✔ database already up to date');

    // Store/rotate the passcode hash (only rewritten when the passcode actually changed).
    const result = await sql.begin(async (tx) => {
      await tx`set local search_path = public, extensions`;
      return tx`
        insert into private.app_secrets (key, value)
        values ('rsvp_passcode_hash', crypt(${env('RSVP_PASSCODE')}, gen_salt('bf')))
        on conflict (key) do update set value = excluded.value
        where crypt(${env('RSVP_PASSCODE')}, private.app_secrets.value) <> private.app_secrets.value`;
    });
    console.log(result.count ? '✔ responses passcode set' : '✔ responses passcode unchanged');
  } finally {
    await sql.end();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  migrate().catch((err) => {
    console.error('✖ migration failed:', err.message ?? err);
    process.exit(1);
  });
}
