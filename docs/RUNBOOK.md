# Runbook

## Status

The repository contains a React, Vite, and TypeScript social graph board app.

Current app behavior:

- open a full-window board
- drag with the mouse to move across the point grid
- drag with one finger on touch devices to move across the point grid
- scroll on a trackpad to pan the board
- zoom toward the cursor with the mouse wheel
- switch between dark and light themes
- persist the selected theme in `localStorage`
- optionally sign in with Google through Supabase
- create one personal board record for each signed-in user
- create one immutable root person at `0,0` for each signed-in user
- persist people, colored tags, notes, and undirected connections in Supabase
- open the top-left Tags menu to create tags, rename them, and choose tag colors from presets or a custom picker
- show a login popup when signed-out users try to edit the board
- allow one separate AI summary row per person in Supabase
- debounce note create and note update events for 3 seconds before triggering AI enrichment
- call a Supabase Edge Function that sends person context to Gemini with OpenRouter fallback and rewrites `person_ai_notes`
- edit the selected person in the node-anchored inspector that opens on single click
- autosave person names shortly after typing or when the name field loses focus
- open a people search layer, match locally while typing, and run natural-language AI search on Enter
- drag a right-click selection box to select multiple people, then drag one of them to move the group
- simplify some heavy visual effects while dragging and on very dense boards to keep navigation responsive
- avoid browser-fragile `color-mix()` styling for tag accents and disable heavy blur compositing on Firefox

There is no multiplayer or drawing toolset yet.

## Local Setup

Install dependencies from the lockfile:

```bash
npm ci
```

Copy the local environment example and fill in the Supabase project values:

```bash
cp .env.example .env.local
```

Project MCP configuration lives in `.mcp.json`. The repository now includes:

- the local `hackathon-board` stdio server in `mcp/server.mjs`

If you want the local MCP server to read and mutate live board data, create a separate MCP env file:

```bash
cp .env.mcp.example .env.mcp.local
```

Required MCP variable:

- `HACKATHON_MCP_SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SERVICE_ROLE_KEY`

Optional MCP variable:

- `HACKATHON_MCP_SUPABASE_URL`

If `HACKATHON_MCP_SUPABASE_URL` is missing, the MCP server falls back to `VITE_SUPABASE_URL` from `.env.local`.
Without a service-role key, the local MCP server still exposes project documentation resources but data tools return a setup error.

Required Vite variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`

Recommended teammate setup:

```bash
VITE_SUPABASE_URL=https://lycfoukfoesobeuumuad.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_l_x_y5rxdhL8Sd1ZE3QXag_lOCtr_M9
VITE_SUPABASE_ANON_KEY=
```

If `VITE_SUPABASE_PUBLISHABLE_KEY` is present, `VITE_SUPABASE_ANON_KEY` may stay empty.
`VITE_SUPABASE_ANON_KEY` is still supported for older local setups, but new local environments should use the Supabase publishable key.

Everything else the teammate needs is already in the repository:

- application code
- the Supabase migration
- `.env.example`
- `.env.mcp.example`
- project documentation
- project-scoped Supabase MCP skills

The Google OAuth client secret is not needed in the app because it stays in the Supabase Dashboard.

Start the development server:

```bash
npm run dev
```

Start the local project MCP server manually when you want to test it outside the app:

```bash
npm run mcp:start
```

Seed a board with fake nodes from local service-role credentials:

```bash
npm run seed:board -- --board-id <board-uuid> --count 1000 --connect-center
```

Optional seeding flags:

- `--random-links <n>` adds extra random connections among the newly created people.
- `--ring-start <pixels>` and `--ring-step <pixels>` control how far the generated nodes are placed from the origin.

Seed one user's board with a reusable demo cluster of people, notes, AI summaries, and connections:

```bash
npm run seed:demo-user -- --email <user-email>
```

The demo seed is idempotent for the fixed contact set. Re-running it updates the seeded people, rebuilds their notes, and keeps the graph ready for search and live demos.

## Production Auto-Deploy

The `social.datanode.live` deployment can run a lightweight user-level auto-deploy loop on the server.

Files:

- `deploy/social-datanode-live/auto-deploy/social-datanode-live-autodeploy.sh`
- `deploy/social-datanode-live/auto-deploy/social-datanode-live-autodeploy.cron`

What it does:

- checks `main` on GitHub every 3 minutes from cron
- exits immediately when the remote commit did not change
- only runs `npm ci`, `npm run build`, and `docker compose up -d --build` when `main` changed
- stores the last deployed commit SHA on the server to avoid unnecessary rebuilds

Suggested server install for user `egg`:

```bash
mkdir -p ~/.local/bin ~/.local/share/social-datanode-live-autodeploy
install -m 755 deploy/social-datanode-live/auto-deploy/social-datanode-live-autodeploy.sh ~/.local/bin/social-datanode-live-autodeploy
crontab -l > /tmp/current-crontab 2>/dev/null || true
grep -v 'social-datanode-live-autodeploy' /tmp/current-crontab > /tmp/next-crontab || true
cat deploy/social-datanode-live/auto-deploy/social-datanode-live-autodeploy.cron >> /tmp/next-crontab
crontab /tmp/next-crontab
rm -f /tmp/current-crontab /tmp/next-crontab
~/.local/bin/social-datanode-live-autodeploy
```

Check status:

```bash
crontab -l
tail -n 100 ~/.local/share/social-datanode-live-autodeploy/cron.log
```

Vite listens on all network interfaces in this repository, so it prints both a local URL and a network URL in the terminal. Open either URL in a browser.

For other devices on the same local network, open the printed network URL, for example:

```text
http://10.29.0.117:5173
```

Other-device checklist:

1. Keep the host machine and the other device on the same Wi-Fi or wired LAN.
2. Start the app with `npm run dev` on the host machine.
3. Open the network URL from the other device.
4. If macOS shows a firewall prompt for Node.js, allow incoming connections.

If the Supabase variables are missing, the app still opens as an anonymous board and disables Google sign-in.

Teammate quick-start:

1. Pull the latest `main`:

   ```bash
   git pull --ff-only
   npm ci
   ```

2. Create `.env.local`:

   ```bash
   cp .env.example .env.local
   ```

3. Fill in `.env.local`:

   ```bash
   VITE_SUPABASE_URL=https://lycfoukfoesobeuumuad.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_l_x_y5rxdhL8Sd1ZE3QXag_lOCtr_M9
   VITE_SUPABASE_ANON_KEY=
   ```

4. Run the project:

   ```bash
   npm run dev
   ```

5. Open the URL printed by Vite.
6. Optional for MCP data tools: create `.env.mcp.local` from `.env.mcp.example` and add the service-role key.

## Supabase Setup

Apply the database migration in `supabase/migrations/` to the target Supabase project.

For local Supabase CLI workflows:

```bash
supabase db push
```

For hosted dashboard workflows, paste and run the migration SQL in the Supabase SQL editor.

This repository includes Supabase Edge Functions in `supabase/functions/`.

Deploy functions before testing AI features:

```bash
supabase functions deploy sync-person-ai-note
supabase functions deploy search-people-ai
```

`supabase/config.toml` sets AI functions to `verify_jwt = false` at the Supabase gateway because each function performs its own user-token validation with `supabase.auth.getUser()`. Do not remove the in-function authorization checks.

Required AI function secrets:

```bash
supabase secrets set GEMINI_API_KEY=your-gemini-api-key
supabase secrets set OPENROUTER_API_KEY=your-openrouter-api-key
```

Optional AI model overrides:

```bash
supabase secrets set GEMINI_MODEL=gemini-2.5-flash
supabase secrets set OPENROUTER_MODEL=openrouter/free
```

AI note sync and AI people search now run inside Supabase Edge Functions through direct provider API calls. The functions try Gemini first and fall back to OpenRouter for provider quota or availability errors.

The browser never calls Gemini or OpenRouter directly. It invokes Edge Functions, and those functions authenticate the user, load user-owned graph context, call AI providers with server-side API keys, and return or persist structured AI output.

Configure Google as an auth provider in Supabase Auth. Add redirect URLs for each app URL used by the team, including:

- `http://localhost:5173`
- `http://localhost:5174`
- `http://localhost:5175`
- `http://127.0.0.1:5173`
- `http://127.0.0.1:5174`
- `http://127.0.0.1:5175`
- `http://10.29.0.117:5173`
- `http://10.29.0.117:5174`
- `http://10.29.0.117:5175`
- the deployed production URL

The app redirects Google OAuth back to `window.location.origin`, so each origin must be allowlisted in Supabase.
For a stable multi-device login flow, prefer one deployed frontend origin on your server instead of ad-hoc local ports.

If a teammate runs Vite on a different port such as `5173`, `5174`, or `5175`, or opens the app through a LAN IP instead of `localhost`, that exact origin must be in the Supabase Auth URL configuration.

Google Cloud OAuth setup:

- Add the same localhost and `127.0.0.1` origins to Authorized JavaScript origins.
- Add the same LAN IP origins such as `http://10.29.0.117:5173` when testing Google login from other devices on the network.
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
3. On a phone or mobile emulator, drag with one finger anywhere on the board and confirm the point grid moves smoothly.
4. Tap a person on a touch device and confirm the inspector opens instead of starting a stuck drag.
5. Scroll on a trackpad and confirm the board pans without triggering zoom.
6. Use the mouse wheel and confirm zoom centers around the cursor.
7. Confirm the zoom indicator in the bottom-right updates smoothly.
8. Toggle the theme.
9. Reload the page and confirm the selected theme is preserved.
10. Sign in with Google and confirm the account state appears.
11. Confirm the signed-in account gets a root node at `0,0`.
12. Drag out from a node to create a new connected person and confirm it persists after reload.
13. Drag a non-root person to a new position, confirm connected lines follow it, then reload and confirm the coordinates persist.
14. Click a person near a viewport edge and confirm the board pans enough to keep the inspector visible, and that the inspector opens at a consistent size regardless of the current zoom.
15. Start trackpad panning on the board, pass over the inspector, and confirm panning continues; then start a trackpad gesture on the inspector and confirm it does not begin board panning.
16. Confirm the inspector opens as a compact panel with only a large name field, the tag picker, notes, and the delete-person action.
17. Type `#` inside the inspector name field, confirm the tag dropdown opens, choose a tag with ArrowUp/ArrowDown plus Enter, and verify the applied tag is removed from the saved name text.
18. Use the tag chip or `+ add tag` ghost button to open the inspector tag dropdown, create a new tag from the same field, delete an unused tag with the `x` confirmation flow, and confirm the single selected tag persists after reload.
19. Open the top-bar tag menu, toggle a tag color palette from its swatch, change the color, and confirm the selected person inspector still shows the chosen tag with a visible color accent after the picker closes.
20. Create a new person, confirm the inspector opens automatically, confirm an empty person focuses the name field, then fill the note capture textarea and save a new note both with `Cmd/Ctrl + Enter` and by blurring the textarea.
21. Create a note by typing into the `Create new note` field, confirm saved notes start collapsed by default, expand one with the chevron, press Enter in the title to open the body, delete a note from the icon button, reload, and confirm note changes persist.
22. Create a connection between two existing people, confirm reload preserves it, then click the widened line target and confirm `Delete connection` or Backspace removes it.
23. Open the top-left Tags menu, create a tag, adjust its color, toggle one tag off with the visibility checkbox, and confirm both tagged nodes and their connections disappear. Use `Select all` and `Clear all` to confirm bulk visibility controls work.
24. Open the search layer and verify that typing a person name, tag, or note text returns local matching people.
25. Press Enter with a natural-language query and verify AI search returns ranked people with reasons.
26. Click a search result and verify the board recenters on that person and opens the inspector.
27. After creating a note, wait at least 3 seconds and confirm a `person_ai_notes` row for that person reaches `status = 'created'`.
28. Edit an existing note, blur the input, wait at least 3 seconds, and confirm the same `person_ai_notes` row updates its `updated_at`, `summary`, and `structured_summary`.
29. Sign out and confirm the anonymous board state returns.

Supabase verification:

1. Confirm a row exists in `profiles` for the signed-in user.
2. Confirm a single row exists in `boards` for the signed-in user.
3. Confirm a single root row exists in `people` for the signed-in user with `is_root = true`, `x = 0`, and `y = 0`.
4. Confirm `tags`, `notes`, `person_ai_notes`, and `connections` rows are created for user actions.
5. Confirm `person_ai_notes.status` moves through `pending` and then `created` after note create or update.
6. Confirm `person_ai_notes.structured_summary` contains the keys `summary`, `traits`, `interests`, `relationship_context`, and `open_questions`.
7. Confirm row-level security prevents reading or updating another user's board data.

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
- Manual browser check of drag navigation, wheel and trackpad navigation, theme persistence, persisted graph editing, debounced AI note sync, and AI people search
- Manual Supabase auth check when credentials and Google OAuth are configured
