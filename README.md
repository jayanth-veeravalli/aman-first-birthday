# Aman Turns One 🎂

Invite + RSVP page for Aman's first birthday (Sun, Dec 20, 2026, 6–9 PM, Nalan Indian Cuisine – Downingtown).

- `index.html`: the invite for guests
- `responses.html`: the hosts' RSVP list (passcode-protected, not linked from the invite)
- Data lives in Supabase; the page only calls the `submit_rsvp` / `get_rsvps` functions (see `db/migrations/`).

## Local

```bash
nvm use            # Node 24
npm install
# fill in .env (git-ignored): DB password, anon key, passcode, repo URL
npm run migrate    # set up / update the database (safe to re-run)
npm run dev        # http://localhost:5173/aman-first-birthday/
```

## Local testing (Docker)

Runs a throwaway Supabase (Postgres + REST API + Studio) in Docker. It never touches the real database.

```bash
npm run local        # start local DB, apply migrations, start the site at http://localhost:5173/aman-first-birthday/
npm run local:psql   # psql into the local DB
npm run local:stop   # stop the local containers
```
Local passcode: `bannu`. Studio (DB browser): http://127.0.0.1:54323.
Needs Docker Desktop with WSL integration enabled for this distro.

## Deploy

Every push to `main` runs `.github/workflows/deploy.yml`: migrate → build → publish to GitHub Pages.
`npm run deploy` does the same from your machine: it migrates, builds to check, then pushes.

One-time setup:

1. Create the public GitHub repo `aman-first-birthday` and set `GITHUB_REPO_URL` in `.env`.
2. Repo → Settings → Pages → Source: **GitHub Actions**.
3. Repo → Settings → Secrets and variables → Actions → add:
   | Secret | Value |
   |---|---|
   | `SUPABASE_DB_URL` | Supabase **Session pooler** connection string (GitHub runners have no IPv6, so the direct `db.*.supabase.co` host won't work) |
   | `RSVP_PASSCODE` | passcode for the responses page |
   | `VITE_SUPABASE_URL` | `https://fynvvytcxezyzoqfjxwx.supabase.co` |
   | `VITE_SUPABASE_ANON_KEY` | Supabase → Project Settings → API → anon public key |

To change the passcode, update the secret (and `.env`), then redeploy.
