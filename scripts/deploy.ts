// One command: migrate the database, build the site, then push to GitHub.
// The push to main triggers the GitHub Actions workflow, which publishes to GitHub Pages.
import { execSync } from 'node:child_process';
import { env, requireEnv } from './env.ts';
import { migrate } from './migrate.ts';

const run = (cmd: string) => execSync(cmd, { stdio: 'inherit' });
const out = (cmd: string) => execSync(cmd, { encoding: 'utf8' }).trim();

requireEnv(['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'RSVP_PASSCODE', 'GITHUB_REPO_URL']);

await migrate();
run('npm run build');

const repo = env('GITHUB_REPO_URL');
const remotes = out('git remote').split('\n');
if (!remotes.includes('origin')) run(`git remote add origin ${repo}`);

if (out('git status --porcelain')) {
  console.error('✖ You have uncommitted changes. Commit them first, then run `npm run deploy` again.');
  process.exit(1);
}

run('git push -u origin HEAD:main');

const m = repo.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
if (m) {
  console.log(`\n✔ Pushed. GitHub Actions is publishing the site:`);
  console.log(`  Progress: https://github.com/${m[1]}/${m[2]}/actions`);
  console.log(`  Invite:   https://${m[1].toLowerCase()}.github.io/${m[2]}/`);
  console.log(`  Replies:  https://${m[1].toLowerCase()}.github.io/${m[2]}/responses.html`);
}
