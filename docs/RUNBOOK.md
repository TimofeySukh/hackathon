# Runbook

## Status

The repository contains a minimal React, Vite, and TypeScript infinite board app.

Current app behavior:

- open a full-window board
- drag with the mouse to move across the point grid
- show compact nearby point highlights while the mouse moves, wheel-pans, or zooms
- switch between dark and light themes
- persist the selected theme in `localStorage`
- optionally sign in with Google through Supabase
- create one personal board record for each signed-in user

There is no board object persistence, multiplayer, or drawing toolset yet.

## Local Setup

Install dependencies from the lockfile:

```bash
npm ci
```

Copy the local environment example and fill in the Supabase project values:

```bash
cp .env.example .env.local
```

Required Vite variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`

Recommended teammate setup:

```bash
VITE_SUPABASE_URL=https://lycfoukfoesobeuumuad.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_l_x_y5rxdhL8Sd1ZE3QXag_lOCtr_M9
VITE_SUPABASE_ANON_KEY=
```

If `VITE_SUPABASE_PUBLISHABLE_KEY` is present, `VITE_SUPABASE_ANON_KEY` may stay empty.
`VITE_SUPABASE_ANON_KEY` is still supported for older local setups, but new local environments should use the Supabase publishable key.

Start the development server:

```bash
npm run dev
```

Vite prints a local URL in the terminal. Open that URL in a browser.

If the Supabase variables are missing, the app still opens as an anonymous board and disables Google sign-in.

## Supabase Setup

Apply the database migration in `supabase/migrations/` to the target Supabase project.

For local Supabase CLI workflows:

```bash
supabase db push
```

For hosted dashboard workflows, paste and run the migration SQL in the Supabase SQL editor.

Configure Google as an auth provider in Supabase Auth. Add redirect URLs for each app URL used by the team, including:

- `http://localhost:5173`
- `http://localhost:5174`
- `http://localhost:5175`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:5174`
- `http://127.0.0.1:5175`
- the deployed production URL

The app redirects Google OAuth back to `window.location.origin`, so each origin must be allowlisted in Supabase.

Google Cloud OAuth setup:

- Add the same localhost and `127.0.0.1` origins to Authorized JavaScript origins.
- Keep the Supabase callback as the Authorized redirect URI:

```text
https://lycfoukfoesobeuumuad.supabase.co/auth/v1/callback
```

The Supabase Google provider also needs the Google OAuth Client ID and Client Secret before `Sign in with Google` can complete.

If the Google OAuth app is still in Testing mode, add each teammate email to Test users in the Google Cloud OAuth consent screen.

## Dependency Workflow

Use npm for this repository.

For a clean, reproducible install, use:

```bash
npm ci
```

This is the closest npm equivalent to a lockfile sync command. It installs exactly what is recorded in `package-lock.json`.

Use `npm install` only when intentionally adding, removing, or changing dependencies:

```bash
npm install <package>
npm install -D <package>
```

To update installed packages within the semver ranges already declared in `package.json`, use:

```bash
npm update
```

To inspect available updates before changing anything, use:

```bash
npm outdated
```

After any dependency change:

1. Review `package.json` and `package-lock.json`.
2. Run `npm run build`.
3. Run `npm run lint`.
4. Do not keep lockfile churn that is unrelated to the intended dependency change.

## Build And Verification

Create a production build:

```bash
npm run build
```

Run lint checks:

```bash
npm run lint
```

Preview the production build locally:

```bash
npm run preview
```

Manual verification:

1. Open the app in a browser.
2. Drag anywhere on the board and confirm the point grid moves smoothly.
3. Move the mouse across the board and confirm only nearby grid points brighten in a compact area.
4. Pan or zoom with a wheel or trackpad and confirm nearby grid points brighten.
5. Stop moving the mouse and confirm the highlighted points fade out.
6. Toggle the theme.
7. Reload the page and confirm the selected theme is preserved.
8. Sign in with Google and confirm the account state appears.
9. Reload while signed in and confirm the same personal board label remains.
10. Sign out and confirm the anonymous board state returns.

Supabase verification:

1. Confirm a row exists in `profiles` for the signed-in user.
2. Confirm a single row exists in `boards` for the signed-in user.
3. Confirm row-level security prevents reading or updating another user's board.

## Team Workflow

- Use the Linear [Hackathon](https://linear.app/velizard/project/hackathon-fc67889adc0d) project for all hackathon tasks.
- Keep task status, owner, priority, and blockers in Linear.
- Keep durable technical decisions and repo structure notes in `docs/`.
- Keep all repository text in English.
- Use `main` as the trunk branch.
- Create short-lived task branches once implementation starts.
- Keep pull requests small and link them to the relevant Linear issue.
- Before starting new repo work, run `git fetch` and then `git pull --ff-only` when the working tree is clean, so local work starts from the latest GitHub state without creating automatic merge commits.
- When the user asks an agent to commit changes, push the resulting commit to GitHub as part of the same workflow unless the user explicitly asks to keep it local.

## Current Priorities

1. Keep the demo path stable.
2. Finalize the project idea and scope in Linear.
3. Collect all links and access paths the team needs.
4. Define presentation and demo roles.
5. Prepare the final presentation deck.

## What To Do When Code Changes

- Keep the commands above current.
- Add test commands when automated tests are introduced.
- Note common failures and the next action to take.
- Add one obvious local verification command before each substantial pull request.

## Current Verification

- `npm run build`
- `npm run lint`
- Manual browser check of drag navigation, wheel and trackpad navigation, motion-triggered point highlights, and theme persistence
- Manual Supabase auth check when credentials and Google OAuth are configured
