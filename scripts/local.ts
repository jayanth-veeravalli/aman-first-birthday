// Local testing: runs a throwaway Supabase stack in Docker (Postgres + REST API + Studio),
// applies our migrations to it, and starts the dev site pointed at it. Never touches the real DB.
//
//   npm run local        start everything (Ctrl+C stops the site and the containers)
//   npm run local:share  same, plus a public ngrok link to the local site (for phones/others)
//   npm run local:stop   stop the local Supabase containers
//   npm run local:psql   open psql in the local database
import { execSync, spawn } from 'node:child_process';

const LOCAL_PASSCODE = 'bannu';
// Services we don't need: storage, realtime, email, edge functions, logs.
// (Auth stays on: without it the CLI doesn't report the local anon key.)
const EXCLUDE = 'storage-api,imgproxy,mailpit,edge-runtime,logflare,vector,supavisor';

const sh = (cmd: string) => execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

try {
  sh('docker info --format "{{.ServerVersion}}"');
} catch {
  console.error(`✖ Docker isn't reachable from WSL.
  Docker Desktop → Settings → Resources → WSL integration → turn on this distro → Apply & restart.
  Then open a new terminal and run \`npm run local\` again.`);
  process.exit(1);
}

console.log('▶ Starting local Supabase (first run downloads images, can take a few minutes)…');
execSync(`npx supabase start -x ${EXCLUDE}`, { stdio: 'inherit' });

// From here on, any failure stops the containers so nothing is left running.
function failAndStop(msg: string, detail?: unknown): never {
  console.error(msg, detail ?? '');
  try { execSync('npx supabase stop', { stdio: 'inherit' }); } catch { /* ignore */ }
  process.exit(1);
}
process.on('uncaughtException', (e) => failAndStop('✖ Local setup failed:', e.message));
process.on('unhandledRejection', (e) => failAndStop('✖ Local setup failed:', (e as Error)?.message ?? e));

const status = JSON.parse(sh('npx supabase status -o json'));
const apiUrl: string = status.API_URL;
// Newer CLIs omit keys from `status`; the local publishable key lives in the API gateway config.
function keyFromGateway(): string | undefined {
  try {
    const kong = sh('docker exec supabase_kong_invite-project cat /home/kong/kong.yml');
    return kong.match(/'(sb_publishable_[A-Za-z0-9_-]+)'/)?.[1];
  } catch {
    return undefined;
  }
}
const anonKey: string = status.ANON_KEY ?? status.PUBLISHABLE_KEY ?? keyFromGateway();
const dbUrl: string = status.DB_URL;
if (!apiUrl || !anonKey || !dbUrl) {
  failAndStop('✖ Could not read local Supabase status:', status);
}

// Point everything at the local stack. These win over values in .env.
const localEnv = {
  SUPABASE_DB_URL: dbUrl,
  RSVP_PASSCODE: LOCAL_PASSCODE,
  VITE_SUPABASE_URL: '/', // browser calls same origin; Vite proxies /rest/v1 to the local API
  LOCAL_SUPABASE_API: apiUrl,
  VITE_SUPABASE_ANON_KEY: anonKey,
};
const share = process.argv.includes('--share');
Object.assign(process.env, localEnv);

const { migrate } = await import('./migrate.ts');
await migrate();

console.log(`
✔ Local stack ready
  Invite:     http://localhost:5173/aman-first-birthday/
  Responses:  http://localhost:5173/aman-first-birthday/responses.html  (passcode: ${LOCAL_PASSCODE})
  DB studio:  ${status.STUDIO_URL ?? 'http://127.0.0.1:54323'}  (browse the rsvps table)
  psql:       npm run local:psql
`);

const vite = spawn('npx', ['vite', '--port', '5173', '--strictPort'], {
  stdio: 'inherit',
  env: { ...process.env, ...localEnv },
});
// Optional public link via ngrok (uses your ngrok account's authtoken).
let tunnel: ReturnType<typeof spawn> | undefined;
if (share) {
  tunnel = spawn('ngrok', ['http', '5173', '--log', 'stdout', '--log-format', 'json'], { stdio: ['ignore', 'pipe', 'inherit'] });
  tunnel.stdout!.on('data', (buf: Buffer) => {
    for (const line of buf.toString().split('\n')) {
      try {
        const url = JSON.parse(line).url;
        if (typeof url === 'string' && url.startsWith('https://')) {
          console.log(`\n🌍 Public link (ngrok):\n  Invite:     ${url}/aman-first-birthday/\n  Responses:  ${url}/aman-first-birthday/responses.html\n`);
        }
      } catch { /* not JSON */ }
    }
  });
  tunnel.on('exit', (code) => { if (code) console.error(`✖ ngrok exited (${code}). Is another ngrok session already running?`); });
}

// Ctrl+C stops the site, the tunnel AND the local Supabase containers.
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  tunnel?.kill('SIGINT');
  vite.kill('SIGINT');
  console.log('\n▶ Stopping local Supabase…');
  try {
    execSync('npx supabase stop', { stdio: 'inherit' });
  } catch {
    console.error('✖ Could not stop the containers; run `npm run local:stop`.');
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
vite.on('exit', shutdown);
