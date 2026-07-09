# Runbook

## Status

The repository contains **Social Datanode** — a React, Vite, and TypeScript social graph
board app backed by Supabase. For an AI-friendly canonical summary, read
[`AI_CONTEXT.md`](AI_CONTEXT.md) first.

Current product behavior (code-aligned):

- Hash routes: landing (`#`), board (`#board`), developer docs (`#docs`), and contact
  (`#contact`).
- Board opens on a **blank graph**: one central `You` circle only (no demo seed).
- Canvas 2D board with circles, people, curved links, pan/zoom, edit/select/pan tool modes.
- Create via circle context menu, double-tap, and connector drag-to-empty.
- Inspector for rename, notes, connections, circle styling, delete (circles require
  confirmation in the inspector).
- Settings: LinkedIn ZIP import (+ sync guide), account sign-in/out, Agent API keys, graph
  import/export/clear. Anonymous users see matching `!` badges on the gear and LinkedIn
  guide `?` until the guide is opened once.
- Toolbar search: local ranked search, signed-in smart search, LinkedIn profile URL import.
- Signed-in persistence: Supabase `user_graphs.graph` with revision-checked saves and
  Realtime sync. Anonymous: `localStorage`.
- Agent access: revocable tokens, `graph-api` Edge Function, CLI, MCP server.
- No multiplayer, drawing tools, or sticky notes.

Out of scope (not built): real-time collaboration/presence, whiteboard drawing, demo mode,
global theme toggle, stress-test UI panel.

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
VITE_SUPABASE_URL=https://lycfoukfoesobeuumuad.supabase.co
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

- `npm run test:db-load -- --people 3000 --connections 3000`
- `npm run test:ui-import -- --people 3000`
- `npm run test:ui-import:persistence`

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
```

`test:ui-import` starts Vite on an isolated local port, opens Chromium through Playwright,
uploads a generated LinkedIn ZIP through the real settings-panel file input, and measures
event-loop lag while the import runs. The test fails when the browser is blocked longer
than the configured threshold.

`test:ui-import:persistence` is the local import persistence check:

```bash
npm run test:ui-import:persistence
```

This starts a local mock Supabase graph API and a Vite app with `VITE_E2E_FAKE_AUTH=true`.
It does not touch production Supabase. The browser imports a generated LinkedIn ZIP, reloads
the board, then imports a board graph JSON and reloads again. The test fails unless both
imports are written to the mock graph API and survive reload.

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
```

If Playwright's Chromium is not installed on the machine:

```bash
npx playwright install chromium
```

## Production Deploy

The `social.datanode.live` deployment uses a pull-based production promotion flow.
The home server polls GitHub from cron, so it does not need a public IP address,
port forwarding, inbound SSH, or GitHub repository deploy secrets.

Production does not deploy every push to `main`. A GitHub Actions manual workflow
promotes a reviewed branch, tag, or commit SHA to the `production` branch. The server
then notices that `production` changed and deploys it from inside the home network.

Files:

- `.github/workflows/deploy-social-datanode-live.yml`
- `deploy/social-datanode-live/auto-deploy/social-datanode-live-autodeploy.sh`
- `deploy/social-datanode-live/auto-deploy/social-datanode-live-autodeploy.cron`

What it does:

- keeps deploy control in GitHub without requiring GitHub to SSH into the server
- promotes a selected ref to `production` through a manual workflow dispatch
- checks `production` on GitHub every 3 minutes from cron
- exits immediately when the remote commit did not change
- only runs `npm ci`, `npm run build`, and `docker compose up -d --build` when `production` changed
- stores the last deployed commit SHA on the server to avoid unnecessary rebuilds
- loads optional build-time Vite variables from `$HOME/apps/social-datanode-live-autodeploy/deploy.env` before `npm run build`

Create the server-only build env file before the first production build:

```bash
cat > ~/apps/social-datanode-live-autodeploy/deploy.env <<'EOF'
VITE_SUPABASE_URL=https://lycfoukfoesobeuumuad.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key-from-supabase>
VITE_SUPABASE_ANON_KEY=
EOF
```

Before the first server run, create or update the `production` branch with the promotion
workflow after this workflow file exists on `main`:

```bash
gh workflow run deploy-social-datanode-live.yml --ref main -f ref=main
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

Promote later releases after they are ready:

```bash
gh workflow run deploy-social-datanode-live.yml --ref main -f ref=main
```

Promote a specific commit SHA:

```bash
gh workflow run deploy-social-datanode-live.yml --ref main -f ref=<commit-sha>
```

Check status:

```bash
crontab -l
tail -n 100 ~/.local/share/social-datanode-live-autodeploy/cron.log
gh run list --workflow deploy-social-datanode-live.yml --limit 5
```

## DigitalOcean Test Deploy

`test.social.datanode.live` is prepared as a parallel DigitalOcean App Platform target.
It does not replace the home-server `social.datanode.live` deployment and it does not
deploy automatically on push.

Files:

- `.github/workflows/deploy-datanode-digitalocean-test.yml`
- `.github/workflows/shutdown-datanode-digitalocean-test.yml`
- `.do/datanode-test.yaml.template`
- `deploy/digitalocean-app-platform/Dockerfile`

What it does:

- deploys only from a manual GitHub Actions `workflow_dispatch`
- builds a single App Platform service from the public Git repository
- uses the smallest fixed shared container, `apps-s-1vcpu-0.5gb`
- reuses the production nginx config so security headers, cache behavior, and SPA fallback
  match the home-server deployment
- keeps Supabase as the backend; no DigitalOcean managed database is provisioned
- keeps `social.datanode.live` on the existing home-server promotion path until DNS and
  Supabase/Google auth settings are intentionally switched

Required GitHub repository secret:

```text
DIGITALOCEAN_ACCESS_TOKEN
```

Required GitHub repository variables:

```text
DATANODE_TEST_DOMAIN=test.social.datanode.live
VITE_SUPABASE_URL=<production Supabase URL>
VITE_SUPABASE_PUBLISHABLE_KEY=<production Supabase publishable key>
```

After the first successful create, store the printed DigitalOcean app id as:

```text
DIGITALOCEAN_DATANODE_TEST_APP_ID=<app-id>
```

First deploy:

```bash
gh workflow run deploy-datanode-digitalocean-test.yml \
  --ref main \
  -f branch=main \
  -f create_app=true
```

Later test deploys:

```bash
gh workflow run deploy-datanode-digitalocean-test.yml \
  --ref main \
  -f branch=main
```

Shutdown the DigitalOcean test app so App Platform billing stops:

```bash
gh workflow run shutdown-datanode-digitalocean-test.yml --ref main
```

DNS:

1. In DigitalOcean App Platform, inspect the app's domain status and default ingress.
2. In Cloudflare, create `test.social.datanode.live` as a CNAME to the DigitalOcean
   target shown for the app domain.
3. Keep `social.datanode.live` unchanged until the DigitalOcean app has been validated.

Auth configuration required before sign-in works on the test domain:

- Supabase Auth URL Configuration: add `https://test.social.datanode.live` to the
  additional redirect URLs. Supabase requires redirect destinations to match the allow
  list.
- Google OAuth Web Client: add `https://test.social.datanode.live` to Authorized
  JavaScript origins. The Supabase Google provider callback URL remains the Supabase
  callback URL from the dashboard.

To make DigitalOcean the default production path later:

1. Add `social.datanode.live` to the DigitalOcean app spec domains.
2. Add `https://social.datanode.live` to Supabase Auth and Google OAuth settings if it is
   not already present.
3. Move the Cloudflare DNS record for `social.datanode.live` from the existing
   cloudflared tunnel target to the DigitalOcean App Platform target.
4. Keep the home-server cron disabled only after the DigitalOcean domain is live and
   verified.

## Azure Static Web Apps Test Deploy

`datanode-test` is prepared as an Azure Static Web Apps Free target. It does not replace
the home-server `social.datanode.live` deployment and it does not deploy automatically on
push.

Azure resource:

```text
Subscription: Azure subscription 1
Resource group: datanode-hosting-rg
Static Web App: datanode-test
SKU: Free
Location: Central US
Default host: salmon-smoke-003804210.7.azurestaticapps.net
```

Files:

- `.github/workflows/deploy-datanode-azure-test.yml`
- `public/staticwebapp.config.json`

What it does:

- deploys only from a manual GitHub Actions `workflow_dispatch`
- builds the Vite app with GitHub repository variables `VITE_SUPABASE_URL` and
  `VITE_SUPABASE_PUBLISHABLE_KEY`
- uploads the built `dist/` directory to Azure Static Web Apps
- uses `staticwebapp.config.json` for SPA fallback and security headers
- keeps Supabase as the backend; no Azure database is provisioned

Required GitHub repository secret:

```text
AZURE_STATIC_WEB_APPS_API_TOKEN
```

Deploy:

```bash
gh workflow run deploy-datanode-azure-test.yml --ref main -f ref=main
```

DNS for an Azure test hostname:

```text
test.social.datanode.live CNAME salmon-smoke-003804210.7.azurestaticapps.net
```

Auth configuration required before sign-in works on the Azure host:

- Supabase Auth URL Configuration: add `https://salmon-smoke-003804210.7.azurestaticapps.net`
  and `https://salmon-smoke-003804210.7.azurestaticapps.net/**` to the additional redirect URLs.
- Google OAuth Web Client: add `https://salmon-smoke-003804210.7.azurestaticapps.net` to
  Authorized JavaScript origins. The Supabase Google provider callback URL remains the
  Supabase callback URL from the dashboard.

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
   VITE_SUPABASE_URL=https://lycfoukfoesobeuumuad.supabase.co
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

Deploy the active Edge Functions before testing signed-in LinkedIn enrichment:

```bash
supabase functions deploy enrich-linkedin-profile
supabase functions deploy enrich-linkedin-archive
```

`supabase/config.toml` sets LinkedIn enrichment functions to `verify_jwt = false` at the Supabase gateway because each function performs its own user-token validation with `supabase.auth.getUser()`. Do not remove the in-function authorization check.

Required LinkedIn enrichment secret:

```bash
supabase secrets set LINKEDIN_ENRICHMENT_API_KEY=your-linkedin-enrichment-provider-api-key
```

One OpenRouter key powers both signed-in AI features: LinkedIn archive enrichment and
natural-language Smart Search. Keep it only in Supabase Edge Function secrets, never in
the Vite/browser environment.

```bash
supabase secrets set OPENROUTER_API_KEY=your-openrouter-key
supabase secrets set OPENROUTER_MODEL=deepseek/deepseek-v4-pro
supabase secrets set OPENROUTER_SEARCH_MODEL=deepseek/deepseek-v4-flash
```

`OPENROUTER_MODEL` selects the LinkedIn archive enrichment model; it defaults to
`deepseek/deepseek-v4-pro`. `OPENROUTER_SEARCH_MODEL` selects the Smart Search model; it
defaults to `deepseek/deepseek-v4-flash`. The archive enrichment function sends message,
invitation, and post excerpts only for transient LLM processing and returns derived notes;
raw archive text is not persisted in `user_graphs`.

Provider docs: [OpenRouter](https://openrouter.ai/docs). The prior NeuralDeep/Qwen
variables (`AI_SEARCH_API_KEY`, `AI_SEARCH_API_BASE_URL`, and `AI_SEARCH_MODEL`) are
deprecated and ignored by the current code.

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

Manual one-profile LinkedIn search imports call the profile enrichment Edge Function.
LinkedIn ZIP import parses the core archive locally, then signed-in users automatically
call `enrich-linkedin-archive` for server-side LLM context notes.

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

The app redirects Google OAuth, email confirmation, and password recovery back to the
clean app origin/path without a hash fragment. Each origin used by the team must be
allowlisted in Supabase. Do not include `#board` in Supabase callback URLs; the client
navigates to `#board` after Supabase has restored a valid session. Login attempts include
the `sdn_auth_return=board` callback URL parameter and also store a short-lived board
return target in browser `localStorage` and `sessionStorage`. Supabase callback
parameters also render the board route while the session is restored, even if the provider
or allowlist handling drops the custom return parameter.
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
8. Open the sign-in dialog and confirm Google, email sign-in, create account, forgot password, and resend confirmation controls fit on desktop and mobile widths.
9. Sign in with Google and confirm the account state appears in Settings.
10. Create an account with only email and password, confirm the confirmation notice appears, and confirm resend confirmation does not clear the local board.
11. Request a password reset and confirm the UI shows a generic success message.
12. Open a Supabase password recovery link and confirm the app shows the new-password state.
13. Confirm the signed-in account loads or creates a root `You` circle.
14. Drag out from a node to create a new connected person and confirm it persists after reload.
15. Drag a non-root person to a new position, confirm connected lines follow it, then reload and confirm the coordinates persist.
16. Click a person near a viewport edge and confirm the board pans enough to keep the inspector visible.
17. Confirm the inspector shows name, notes, connections, and delete actions for a person.
18. Save a note with `Cmd/Ctrl + Enter` and confirm it persists after reload.
19. Switch inspector selection and confirm unsaved note/connection drafts reset.
20. Create a connection between two people, reload, then delete it with Backspace or the inspector.
21. Open search and verify name/circle matches; click a result and confirm camera fly + inspector.
22. Paste a LinkedIn profile URL into search while signed in and verify import/enrichment.
23. Switch board tool modes (edit / select / pan) and confirm pan mode moves the canvas on one-finger drag (mobile or touch).
24. Sign out and confirm anonymous editing still works with local persistence.

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
- Commits on `main` do not deploy automatically; promote a reviewed ref with the production workflow when a release is ready.

## Current Priorities

See the Linear [Hackathon](https://linear.app/velizard/project/hackathon-fc67889adc0d) project
for live task ownership and status. Durable technical direction lives in `docs/`.

## What To Do When Code Changes

- Keep the commands above current.
- Add test commands when automated tests are introduced.
- Note common failures and the next action to take.
- Add one obvious local verification command before each substantial pull request.

## Current Verification

- `npm run build`
- `npm run lint`
- `npm run test:load`
- Manual browser check of drag navigation, wheel and trackpad navigation, theme persistence, persisted graph editing, local search, and LinkedIn import
- Manual Supabase auth check when credentials and Google OAuth are configured
