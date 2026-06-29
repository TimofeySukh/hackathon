# Runbook

## Status

The repository contains a React, Vite, and TypeScript social graph board app.

Current visible prototype behavior:

- opens a full-window relationship circle graph
- starts with `You` as the central source circle
- includes seeded connected region circles for EU, Denmark, Russia, and Other
- includes nested country/company circles such as Sweden, France, Pandora, Avito, Yandex, US / Canada, and Japan
- draws curved links from circle centers to circles and people
- includes settings controls for demo mode, circle labels, person names, global circle shape, and global circle fill style
- demo mode hides the app chrome and leaves the canvas plus the settings button while still allowing selection, deletion, visible connector handles, link creation, and drag-to-empty create menus for people, subset circles, and connected circles
- includes a people load panel with a 0-10,000 generated-person slider, optional people edges, and live FPS
- creates a person or a circle from a circle context menu (containment auto-detected for circles)
- supports double-tap anywhere to create a person at the tapped point, joining a circle only when tapped inside one and otherwise staying free-floating
- keeps people as endpoints and circle centers as the only branch-creation sources
- selects and renames circles or people in the inspector
- undoes the last structural change (create, delete, move, resize, connect, merge, change-circle, favorite, add/delete note, import) with Ctrl/Cmd+Z, one step per drag gesture
- adds three demo people to the selected circle
- drags people directly
- drags any circle center, including `You`
- moves a dragged circle together with contained people and subset circles
- resizes circles by grabbing and dragging the circle edge
- expands parent circles automatically when contained people or subset circles cross the current boundary
- shrinks auto-expanded circles back toward their minimum size when contained objects move inward
- propagates containment fitting up nested circle chains
- shows in-page instructions for the prototype controls
- pans by dragging empty board space
- zooms toward the cursor with the mouse wheel and through the toolbar
- stores signed-in board data in Supabase `user_graphs.graph`
- stores signed-out board data in this browser's `localStorage`
- supports LinkedIn ZIP import and signed-in manual LinkedIn profile enrichment
There is no multiplayer or drawing toolset yet.

## Local Setup

Install dependencies from the lockfile:

```bash
npm ci
```

Copy the local environment example when working with auth, synced boards, or LinkedIn profile enrichment:

```bash
cp .env.example .env.local
```

Required Vite variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY` or `VITE_SUPABASE_ANON_KEY`

Recommended teammate setup:

```bash
VITE_SUPABASE_URL=https://lxnrpdeahoglgiocowsh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_l_x_y5rxdhL8Sd1ZE3QXag_lOCtr_M9
VITE_SUPABASE_ANON_KEY=
```

If `VITE_SUPABASE_PUBLISHABLE_KEY` is present, `VITE_SUPABASE_ANON_KEY` may stay empty.
`VITE_SUPABASE_ANON_KEY` is still supported for older local setups, but new local environments should use the Supabase publishable key.

Required Supabase Edge Function secret for the graph API:

- `SUPABASE_SERVICE_ROLE_KEY`

Keep it only in Supabase Edge Function secrets or local Supabase function env files. It is
used by `graph-api` to verify hashed agent tokens and apply graph writes for the resolved
owner user.

Everything else the teammate needs is already in the repository:

- application code
- the Supabase migration
- `.env.example`
- project documentation

The Google OAuth client secret is not needed in the app because it stays in the Supabase Dashboard.

Start the development server:

```bash
npm run dev
```

## Agent API, CLI, and MCP

Signed-in users can create revocable agent tokens from Settings -> Agent API. The token is
shown once and maps to that user's graph only.

Use the generated values like this:

```bash
export DATANODE_API_URL=https://<project-ref>.supabase.co/functions/v1/graph-api/v1
export DATANODE_API_TOKEN=dn_live_<token>
```

CLI examples:

Using on-the-fly `npx` from anywhere (no clone needed):
```bash
npx -y --package github:TimofeySukh/hackathon datanode-cli meta
npx -y --package github:TimofeySukh/hackathon datanode-cli search "alice"
npx -y --package github:TimofeySukh/hackathon datanode-cli circles
npx -y --package github:TimofeySukh/hackathon datanode-cli people:add <circle-id> "Alice Chen" "Met at conference"
npx -y --package github:TimofeySukh/hackathon datanode-cli operations:run ./operations.json
```

Or install globally:
```bash
npm install -g github:TimofeySukh/hackathon
datanode-cli search "alice"
```

Or from a local repository checkout:
```bash
npm run datanode:cli -- meta
npm run datanode:cli -- search "alice"
npm run datanode:cli -- circles
npm run datanode:cli -- people:add <circle-id> "Alice Chen" "Met at conference"
```

MCP config:

```json
{
  "mcpServers": {
    "datanode": {
      "command": "npx",
      "args": ["-y", "github:TimofeySukh/hackathon"],
      "env": {
        "DATANODE_API_URL": "https://<project-ref>.supabase.co/functions/v1/graph-api/v1",
        "DATANODE_API_TOKEN": "dn_live_<token>"
      }
    }
  }
}
```

All writes require the current graph revision. The CLI and MCP server read it before
writing; if another tab or agent saves first, the API returns `409 Conflict` instead of
overwriting data.

MCP tool results are returned as a structured JSON envelope with `status`, `summary`,
`data`, and `next_valid_actions`. The MCP tool registry exposes risk metadata and uses
strict argument schemas. Agents can call `list_capabilities` to inspect a compact
risk-aware tool list before choosing a detailed graph tool. For large, experimental, bulk,
or destructive graph changes, agents should create a backup with `export_graph` or ask the
user for confirmation before calling replacement, reset, or broad cleanup tools.

## Local LinkedIn Agent Search

For private LinkedIn export analysis that should stay outside Supabase, MCP, and the
authenticated graph API, use the local read-only JSONL search tool. It searches compact
`people-for-llm.jsonl` exports and returns exact person ids plus compact notes under a
token budget.

```bash
npm run --silent linkedin:agent-search -- stats
npm run --silent linkedin:agent-search -- search "founder agile" --budget-tokens 30000
npm run --silent linkedin:agent-search -- search "role:coach circle:Novo" --limit 100
npm run --silent linkedin:agent-search -- search "founder" \
  --data /Users/velizard/Downloads/linkedin-graph-export-2026-06-14-basic/people-for-llm.jsonl
```

The default data file is the newest
`~/Downloads/linkedin-graph-export-*/people-for-llm.jsonl`. Results include a `next`
command when a large group needs paging. Keep the default `30,000` token budget for normal
LLM context assembly; use up to `50,000` only when the target model context can afford it.

## Import Load Testing

Large import testing must stay out of production user accounts and production data.

Use a separate Supabase project for staging or load tests. Keep that project on the same
migration set as production, but do not require it to mirror production data or capacity
one-for-one. The goal is to verify import shape, batching, RLS assumptions, persistence
size, and browser responsiveness without polluting real accounts.

Default local load checks:

```bash
npm run test:load
```

This runs:

- `npm run test:import-persistence`
- `npm run test:db-load -- --people 3000 --connections 3000`
- `npm run test:ui-import -- --people 3000`
- `npm run test:ui-import:persistence`
- `npm run test:ui-import:persistence:fallback`

`test:db-load` is dry-run by default. It builds a synthetic graph with 3,000 people and
3,000 connections, serializes it in the same shape stored in `user_graphs.graph`, and
prints payload size without writing to Supabase.

To write against a staging Supabase project, set `HACKATHON_LOAD_TEST_SUPABASE_URL`
and `HACKATHON_LOAD_TEST_SUPABASE_SERVICE_ROLE_KEY`, then opt in explicitly:

```bash
HACKATHON_ALLOW_DATABASE_LOAD_TEST=true npm run test:db-load -- --write --cleanup
```

Safety rules for database load writes:

- The script refuses to write to the URL in `.env.production`.
- The script requires `HACKATHON_ALLOW_DATABASE_LOAD_TEST=true`.
- The script creates an isolated Supabase Auth user for the run.
- The script writes one `user_graphs` row for that user and reads it back.
- Pass `--cleanup` to delete the test user after the read-back check; the
  `user_graphs` row is removed by `on delete cascade`.

Useful database load overrides:

```bash
npm run test:db-load -- --people 5000 --connections 5000
HACKATHON_ALLOW_DATABASE_LOAD_TEST=true npm run test:db-load -- --people 5000 --connections 5000 --write --cleanup
npm run test:import-persistence
npm run test:ui-import:persistence -- --people 500 --companies 25
npm run test:ui-import:persistence:fallback -- --people 500 --companies 25
```

`test:ui-import` starts Vite on an isolated local port, opens Chromium through Playwright,
uploads a generated LinkedIn ZIP through the real settings-panel file input, and measures
event-loop lag while the import runs. The test fails when the browser is blocked longer
than the configured threshold.

`test:import-persistence` starts a fake graph API server and verifies the browser save
contract for imported graphs: `PUT /v1/graph`, bearer auth, graph payload, expected
revision, conflict handling, structured error formatting, and direct REST fallback request
shape.

`test:ui-import:persistence` starts the app with dev-only fake auth and a localhost mock
Supabase REST/graph API. It verifies that LinkedIn ZIP import and graph JSON import write
through signed-in persistence and survive reload without touching production data.

`test:ui-import:persistence:fallback` forces generic graph API save failures and verifies
the same import flows persist through direct REST fallback.

## Auth Email E2E

Production auth email uses Supabase custom SMTP pointed at Resend. Keep the Resend API
key only in the Supabase Dashboard SMTP password field; do not commit it to the repo.

Current SMTP settings:

```text
Sender email: noreply@datanode.live
Sender name: DataNode
Host: smtp.resend.com
Port: 465
Username: resend
Password: <Resend API key>
```

When testing reset emails, wait at least 60 seconds before requesting a second email for
the same user. The current Supabase Auth SMTP settings enforce a 60-second interval
between emails sent to the same recipient.

Useful UI responsiveness overrides:

```bash
npm run test:ui-import -- --people 5000 --max-lag-ms 1500
npm run test:ui-import -- --url http://127.0.0.1:5173
npm run test:ui-import:persistence -- --people 500 --companies 25
npm run test:ui-import:persistence:fallback -- --people 500 --companies 25
```

If Playwright's Chromium is not installed on the machine:

```bash
npx playwright install chromium
```

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
- loads optional build-time Vite variables from `$HOME/apps/social-datanode-live-autodeploy/deploy.env` before `npm run build`

Create the server-only build env file before the first production build:

```bash
cat > ~/apps/social-datanode-live-autodeploy/deploy.env <<'EOF'
VITE_SUPABASE_URL=https://lxnrpdeahoglgiocowsh.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key-from-supabase>
VITE_SUPABASE_ANON_KEY=
EOF
```

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

If the Supabase variables are missing, the app still opens as an editable anonymous local board and disables Google sign-in.

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
   VITE_SUPABASE_URL=https://lxnrpdeahoglgiocowsh.supabase.co
   VITE_SUPABASE_PUBLISHABLE_KEY=sb_publishable_l_x_y5rxdhL8Sd1ZE3QXag_lOCtr_M9
   VITE_SUPABASE_ANON_KEY=
   ```

4. Run the project:

   ```bash
   npm run dev
   ```

5. Open the URL printed by Vite.
## Supabase Setup

Apply the database migration in `supabase/migrations/` to the target Supabase project.

For local Supabase CLI workflows:

```bash
supabase db push
```

For hosted dashboard workflows, paste and run the migration SQL in the Supabase SQL editor.

This repository includes Supabase Edge Functions in `supabase/functions/`.

Deploy the active Edge Function before testing signed-in manual LinkedIn profile import:

```bash
supabase functions deploy enrich-linkedin-profile
```

`supabase/config.toml` sets LinkedIn enrichment to `verify_jwt = false` at the Supabase gateway because the function performs its own user-token validation with `supabase.auth.getUser()`. Do not remove the in-function authorization check.

Required LinkedIn enrichment secret:

```bash
supabase secrets set LINKEDIN_ENRICHMENT_API_KEY=your-linkedin-enrichment-provider-api-key
```

Required secrets for signed-in natural-language smart search (`POST /v1/search/smart`):

```bash
supabase secrets set AI_SEARCH_API_KEY=your-neuraldeep-sk-key
supabase secrets set AI_SEARCH_API_BASE_URL=https://api.neuraldeep.ru/v1
supabase secrets set AI_SEARCH_MODEL=qwen3.6-35b-a3b-noreason
```

Provider docs: [NeuralDeep](https://neuraldeep.ru/docs). Default model `qwen3.6-35b-a3b-noreason` is the fastest
MoE chat model on the free tier (DaisyGPT / Qwen 3.6, reasoning disabled). `AI_SEARCH_API_BASE_URL` and
`AI_SEARCH_MODEL` are optional overrides.

Redeploy `graph-api` after setting secrets:

```bash
supabase functions deploy graph-api
```

For local manual LinkedIn profile import testing without signing in, set a throwaway
secret in local Vite and in the Edge Function environment:

```bash
# .env.local only, never production
VITE_LINKEDIN_ENRICHMENT_TEST_SECRET=dev-only-random-secret

# local Supabase Edge Function env, or a non-production test function deployment
LINKEDIN_ENRICHMENT_ALLOW_TEST_AUTH=true
LINKEDIN_ENRICHMENT_TEST_SECRET=dev-only-random-secret
```

The test bypass is accepted only when the request comes from `localhost`, `127.0.0.1`,
or `::1`, has the matching `x-linkedin-enrichment-test-secret` header, and the Edge
Function has `LINKEDIN_ENRICHMENT_ALLOW_TEST_AUTH=true`. Production must leave these
test variables unset so unauthenticated enrichment still fails.

Manual one-profile LinkedIn search imports call the profile enrichment Edge Function. LinkedIn ZIP import stays local to the uploaded archive.

The browser never calls the LinkedIn enrichment provider directly. It invokes the Edge Function, and that function authenticates the user, calls the provider with a server-side API key, and returns normalized profile data.

Configure Supabase Auth redirect URLs for each app URL used by the team, including:

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

The app redirects Google OAuth, email confirmation, and password recovery back to
`window.location.origin`, so each origin must be allowlisted in Supabase.
For a stable multi-device login flow, prefer one deployed frontend origin on your server instead of ad-hoc local ports.

If a teammate runs Vite on a different port such as `5173`, `5174`, or `5175`, or opens the app through a LAN IP instead of `localhost`, that exact origin must be in the Supabase Auth URL configuration.

Google Cloud OAuth setup:

- Add the same localhost and `127.0.0.1` origins to Authorized JavaScript origins.
- Add the same LAN IP origins such as `http://10.29.0.117:5173` when testing Google login from other devices on the network.
- Keep the Supabase callback as the Authorized redirect URI:

```text
https://lxnrpdeahoglgiocowsh.supabase.co/auth/v1/callback
```

The Supabase Google provider also needs the Google OAuth Client ID and Client Secret before `Sign in with Google` can complete.

If the Google OAuth app is still in Testing mode, add each teammate email to Test users in the Google Cloud OAuth consent screen.

Email/password auth setup:

- Enable email/password signups in Supabase Auth.
- Keep email confirmation enabled for production accounts.
- Customize the Supabase confirmation and recovery email templates in the Supabase
  Dashboard so they match Social Datanode's tone and link back to the allowlisted frontend
  origin.
- If password recovery links open the app but do not show the new-password dialog, verify
  that the recovery redirect URL exactly matches the frontend origin.

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
10. Open the sign-in dialog and confirm Google, email sign-in, create account, forgot password, and resend confirmation controls fit on desktop and mobile widths.
11. Sign in with Google and confirm the account state appears.
12. Create an account with only email and password, confirm the confirmation notice appears, and confirm resend confirmation does not clear the local board.
13. Request a password reset and confirm the UI shows a generic success message.
14. Open a Supabase password recovery link and confirm the app shows the new-password state.
15. Confirm the signed-in account gets a root node at `0,0`.
16. Drag out from a node to create a new connected person and confirm it persists after reload.
17. Drag a non-root person to a new position, confirm connected lines follow it, then reload and confirm the coordinates persist.
18. Click a person near a viewport edge and confirm the board pans enough to keep the inspector visible, and that the inspector opens at a consistent size regardless of the current zoom.
19. Start trackpad panning on the board, pass over the inspector, and confirm panning continues; then start a trackpad gesture on the inspector and confirm it does not begin board panning.
20. Confirm the inspector opens as a compact panel with only a large name field, the tag picker, notes, and the delete-person action.
21. Type `#` inside the inspector name field, confirm the tag dropdown opens, choose a tag with ArrowUp/ArrowDown plus Enter, and verify the applied tag is removed from the saved name text.
22. Use the tag chip or `+ add tag` ghost button to open the inspector tag dropdown, create a new tag from the same field, delete an unused tag with the `x` confirmation flow, and confirm the single selected tag persists after reload.
23. Open the top-bar tag menu, toggle a tag color palette from its swatch, change the color, and confirm the selected person inspector still shows the chosen tag with a visible color accent after the picker closes.
24. Create a new person, confirm the inspector opens automatically, confirm an empty person focuses the name field, then fill the note capture textarea and save a new note both with `Cmd/Ctrl + Enter` and by blurring the textarea.
25. Create a note by typing into the `Create new note` field, confirm saved notes start collapsed by default, expand one with the chevron, press Enter in the title to open the body, delete a note from the icon button, reload, and confirm note changes persist.
26. Start a new unsaved note and a new unsaved connection on one person, click empty canvas, then open another person and confirm the note composer, note editor, connection input, and service picker all start clean.
27. Create a connection between two existing people, confirm reload preserves it, then click the widened line target and confirm `Delete connection` or Backspace removes it.
28. Open the top-left Tags menu, create enough tags to overflow the panel, scroll to the lower tags, adjust a lower tag color, and confirm the palette remains reachable.
29. Open the top-left Tags menu, create a tag, adjust its color, toggle one tag off with the visibility checkbox, and confirm both tagged nodes and their connections disappear. Use `Select all` and `Clear all` to confirm bulk visibility controls work.
30. Open the search layer and verify that typing a person name, role, or circle name returns local matches.
31. Click a search result and verify the board recenters on that person or circle and opens the inspector.
32. Paste a LinkedIn profile URL into search while signed in and verify manual profile import creates or enriches a person.
33. Sign out and confirm the anonymous board state returns.

Supabase verification:

1. Confirm one `user_graphs` row exists for the signed-in user after the first edit.
2. Confirm the `user_graphs.graph` JSON contains `circles`, `people`, and `connections`.
3. Confirm row-level security prevents reading or updating another user's `user_graphs` row.

## Team Workflow

- Use the Linear [Hackathon](https://linear.app/velizard/project/hackathon-fc67889adc0d) project for all hackathon tasks.
- Keep task status, owner, priority, and blockers in Linear.
- Keep durable technical decisions and repo structure notes in `docs/`.
- Keep all repository text in English.
- Use `main` as the trunk branch.
- Create short-lived task branches once implementation starts.
- Keep pull requests small and link them to the relevant Linear issue.
- Before starting new repo work, run `git fetch` and then `git pull --ff-only` when the working tree is clean, so local work starts from the latest GitHub state without creating automatic merge commits.
- Create a commit after repository changes.
- Do not push automatically after every change; push only when the user asks for it or the release workflow requires it.
- Commits on `main` are deployed to the primary production site within about 3 minutes after they reach GitHub.

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
- `npm run test:import-persistence`
- `npm run test:load`
- Manual browser check of drag navigation, wheel and trackpad navigation, theme persistence, persisted graph editing, local search, and LinkedIn import
- Manual Supabase auth check when credentials and Google OAuth are configured
