# Spec: Aman Turns One — invite & RSVP page

*Label: `ready-for-agent`*

## Problem Statement

Jay Veeravalli and Sai Chalasani are hosting a dinner for their son Aman's first birthday. They want to invite friends and family in a warm, personal way and get a reliable headcount. Sending details through scattered WhatsApp messages makes it hard for guests to find the time, place and directions in one spot. It also leaves Jay and Sai tallying replies by hand, with no single answer for who is coming and how many people to tell the restaurant.

## Solution

A single, mobile-friendly invite page that Jay and Sai share as one link. It shows:
- a short video of Aman playing on a loop like a GIF
- a playful note "from Aman"
- the date, time and restaurant, with a map and a directions link
- a simple RSVP form

A separate private page, protected by a passcode only Jay and Sai know, shows every reply with totals and lets them download the list.

**Event facts:**
- Aman's 1st birthday
- **Sunday, December 20, 2026, 6:00–9:00 PM**
- **Nalan Indian Cuisine – Downingtown**, Downingtown, PA (Maps link: https://maps.app.goo.gl/BfWokHpm3sHznXRj6)

## User Stories

1. As a guest, I want to open the invite from a single link on my phone, so that I don't need to install or sign up for anything.
2. As a guest, I want to see a looping video of Aman at the top of the page, so that the invite feels personal and joyful.
3. As a guest, I want the video to play automatically and silently, so that it doesn't startle me or anyone near me.
4. As a guest on an iPhone, I want the video to play inline rather than going fullscreen, so that I can keep reading the invite.
5. As a guest, I want a clear heading saying Aman is turning one, so that I immediately know what the event is.
6. As a guest, I want to read a playful note written as if from Aman, so that I feel warmly welcomed.
7. As a guest, I want to see that the invite comes from Jay and Sai, so that I know who is hosting.
8. As a guest, I want the date shown with the weekday (Sunday, December 20, 2026), so that I can check my calendar quickly.
9. As a guest, I want the start and end time (6–9 PM), so that I can plan my evening.
10. As a guest, I want to see the restaurant's name, so that I know where the party is.
11. As a guest, I want to see the restaurant on an embedded map, so that I understand roughly where it is without leaving the page.
12. As a guest, I want an "Open in Google Maps" button, so that I can get turn-by-turn directions in my maps app.
13. As a guest, I want to RSVP by entering my name (no example text in the box), so that replying takes seconds.
14. As a guest, I want to choose Yes, Maybe or No with large, easy-to-tap buttons, so that I can answer honestly and comfortably on a phone.
15. As a guest who is coming (or maybe coming), I want to say how many adults and how many children are coming from my household, so that Jayanth and Sai can plan the headcount.
16. As a guest who can't come, I don't want to be asked for a guest count, so that the form stays simple.
17. As a guest, I want the adult and child counts to be simple +/– steppers (0–10 each, at least 1 person total), so that I can't enter something nonsensical.
18. As a guest, I want clear feedback while my RSVP is sending, so that I don't tap Submit twice.
19. As a guest, I want a friendly confirmation after submitting ("See you on the 20th!" or "We'll miss you!"), so that I know my reply was received.
20. As a guest, I want a friendly error message and the chance to retry if submission fails, so that a network blip doesn't lose my reply.
21. As a guest, I want to change my answer later by submitting again with the same name, so that my plans can change without creating duplicate replies.
22. As a guest, I want my name matched regardless of capitalisation or extra spaces, so that "jay  veeravalli" and "Jay Veeravalli" count as the same person.
23. As a returning guest on the same device, I want the form pre-filled with my last answer and a "Change my answer" option, so that updating is effortless.
24. As a guest, I want the page to look good on phones, tablets and desktops, so that it works however I open the link.
25. As a guest, I don't want to see other guests' replies, so that everyone's responses stay private.
26. As a host (Jay or Sai), I want a private responses page that isn't linked from the invite, so that guests don't stumble onto it.
27. As a host, I want that page protected by a passcode, so that only Sai and I can see replies.
28. As a host, I want a clear message when the passcode is wrong, so that I know to retry.
29. As a host, I want to stay unlocked for the rest of my browser session, so that I don't retype the passcode on every refresh.
30. As a host, I want to see how many households are coming, so that I know the response rate.
31. As a host, I want to see the total number of guests coming, so that I can give Nalan a headcount.
32. As a host, I want to see how many people declined, so that I know who has answered.
33. As a host, I want a table of every reply (name, coming, guests, last updated), newest first, so that I can review individual answers.
34. As a host, I want a Refresh button, so that I can see new replies without reloading.
36. As a host, I want to change the passcode just by editing a config value and redeploying, so that I can rotate it if it leaks.
37. As a host, I want to deploy everything (database setup and website) with one command, so that publishing and updating is painless.
38. As a host, I want database setup to be safe to re-run, so that redeploying never breaks or duplicates anything.
39. As a host, I want secrets (database URL, passcode) kept out of the public repo, so that guests or strangers can't access the data.
40. As a host, I want RSVPs to stay open with no deadline, so that late replies are still captured.

## Implementation Decisions

- **Architecture:** a static site with no app server. The browser calls the hosts' existing **Supabase** project directly with the public anon key. All data access goes through two Postgres functions.
- **Front end:** Vite + TypeScript with no UI framework. Two pages: the **invite page** and the **responses page**. They share a tiny `fetch`-based RPC client (no Supabase SDK) and one stylesheet.
- **Hosting:** **GitHub Pages** from a public repo named `aman-first-birthday`, served under the `/aman-first-birthday/` base path. The video file ships with the site.
- **Data model:**
  - An `rsvps` table: id, display name, normalised name key (unique), response (`yes`/`maybe`/`no`), adults (0–10), children (0–10), created/updated timestamps.
  - An `app_secrets` table holding the bcrypt hash of the hosts' passcode (via pgcrypto).
  - Both tables have row-level security enabled with **no policies**, and anon table privileges are revoked, so they can't be read or written directly.
- **API contract (Postgres RPC, `SECURITY DEFINER`, executable by `anon`):**
  - `submit_rsvp(name, response, adults, children)`: trims and validates the name (1–80 characters), normalises the key (lowercase, trim, collapse whitespace), requires adults + children ≥ 1 for yes/maybe and forces both to 0 for no, then upserts on the name key and refreshes `updated_at`.
  - `get_rsvps(passcode)`: returns all rows if the passcode matches the stored hash, and raises `invalid passcode` otherwise.
- **Migrations:**
  - A TypeScript migration runner reads `SUPABASE_DB_URL`, records applied migrations in a tracking table, and applies new SQL files inside transactions. It's idempotent.
  - After migrating, it upserts the passcode hash from `RSVP_PASSCODE`.
- **Deploy:** a GitHub Actions workflow runs on every push to `main`: migrate → build → publish to GitHub Pages (Pages source: GitHub Actions). Secrets live in GitHub repository secrets; the DB secret must be the Supabase Session pooler URL, since runners have no IPv6. Locally, `npm run deploy` migrates, builds and pushes, which triggers the workflow.
- **Configuration:**
  - The git-ignored env file holds `SUPABASE_DB_URL`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `RSVP_PASSCODE` and `GITHUB_REPO_URL`.
  - An example env file is committed.
  - Only the Supabase URL and anon key reach the browser.
- **Video:** `autoplay muted loop playsinline`, with no controls and no sound option.
- **RSVP form:** Name (labelled just "Name", no placeholder), then Yes / Maybe / No buttons, then Adults (0–10, default 1) and Children (0–10, default 0) steppers shown for Yes and Maybe (total must be ≥ 1), then Submit. The last submission is remembered in browser storage for pre-filling, with access wrapped so it fails safely.
- **Responses page:**
  - A passcode prompt; the passcode is kept in session storage after it succeeds.
  - Totals: Adults coming, Kids coming, Total coming (with household count), Maybe (households, with people count), Not coming.
  - A table sorted newest first, plus a Refresh button.
- **Map:** an embedded Google Maps iframe searching for "Nalan Indian Cuisine Downingtown" (no API key needed), plus a button to the hosts' Maps link. The street address couldn't be read from the Maps page automatically, so the page shows "Downingtown, PA" and the map pin (coordinates from the hosts' link) rather than a guessed address.
- **Visual design:**
  - Mobile-first and responsive: one column on phones, and the video sits beside the details on wide screens.
  - Soft, warm first-birthday theme: cream background, warm accents, a rounded display font and light celebratory touches.
- **Invite note (playful, from Aman):**
  > Hi! It's me, Aman! 👶 I've spent the past year mastering clapping, babbling, and the very advanced art of putting everything in my mouth. My wobbly steps are coming along too (gravity and I are still negotiating). And now… **I'm turning ONE!** Mama and Dada say I'm "not allowed to plan my own party yet," so they did it. But make no mistake, I am still the boss. So please come eat yummy food, sing to me loudly (applause is also accepted), and help me blow out my very first candle, because apparently I'm not allowed to grab it. 🕯️ Attendance is mandatory. I already told my parents you'd be there. *P.S. Cuddles are optional but strongly encouraged.* 💛 — Love, Aman Rudhra *(with Jayanth & Sai)*

## Testing Decisions

- The hosts decided **no automated tests** for this project.
- Verification is manual:
  - Run the migration twice and confirm the second run is a no-op.
  - Confirm the anon role can't select from the tables directly.
  - Locally, submit a Yes RSVP, then resubmit the same name with different spacing and capitalisation as a No, and confirm it updates rather than duplicates.
  - Check that a wrong passcode is rejected, and the totals are correct.
  - Check the layout at phone and desktop widths, and that the video autoplays silently and inline on a phone.
  - Repeat a smoke RSVP on the live GitHub Pages URL, then delete the test rows.

## Out of Scope

- CSV export of replies
- Guest accounts and logins, and per-guest unique invite links
- An RSVP deadline or automatic closing of the form
- Email/SMS notifications to hosts or guests, reminders, and add-to-calendar
- Dietary needs, phone numbers, or messages to hosts
- Showing the guest list publicly
- Editing or deleting RSVPs from the responses page (do it in Supabase directly if needed)
- Video sound, controls or alternate media
- Custom domain
- Automated tests and CI

## Further Notes

- Node.js isn't installed yet; the build starts by installing it with nvm (no sudo).
- One-time manual steps for the hosts:
  - Create the empty public GitHub repo `aman-first-birthday`.
  - Make sure git can push to it.
  - Supply the Supabase connection string, project URL and anon key.
  - Choose a passcode.
  - Set GitHub Pages → Source to **GitHub Actions**, and add the repository secrets listed in the README.
- The repo is public, so the code and Aman's video are visible on GitHub. The hosts accepted this. Secrets never go into the repo.
- Source video: `C:\Users\kiran\Downloads\WhatsApp Video 2026-11-22 at 10.21.57 AM.mp4` (about 1 MB).
- **No issue tracker is configured** (`/setup-matt-pocock-skills` hasn't been run). This spec should be saved as `docs/spec.md` in the repo, or published once a tracker is set up.
