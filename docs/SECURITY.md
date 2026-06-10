# Security

This document records the current security and privacy model for the social graph board.

## Current State

The app has two storage modes:

- signed-out local board state in browser `localStorage`
- signed-in Supabase-backed private board state

Signed-in data currently stored in Supabase includes profiles, boards, people, tags, notes, AI summaries, and blob-group membership. This is sensitive relationship data. Treat it as private user data.

LinkedIn archive import is parsed in the browser. The archive itself is not uploaded as a file. The default import stores the contact name, company, position, connected date, and source marker. Email addresses and LinkedIn profile URLs are opt-in fields in the import dialog.

## Supabase Controls

Current database controls:

- row-level security is enabled on `profiles`, `boards`, `tags`, `people`, `notes`, `node_groups`, `connections`, and `person_ai_notes`
- user-owned RLS policies scope rows with `auth.uid()`
- triggers validate tag, note, AI-note, node-group, and legacy connection ownership
- root people are protected against deletion and movement
- graph writes go through the frontend graph storage layer rather than direct UI calls scattered through components

Current Edge Function controls:

- user-called Edge Functions are configured with `verify_jwt = true` at the Supabase gateway
- each AI function validates the caller with `supabase.auth.getUser()`
- each AI function performs owner checks before reading or writing graph data
- Edge Function CORS is restricted to the production origin, local development origins, private-LAN Vite origins, and any explicitly configured `ALLOWED_ORIGINS`
- AI provider keys stay in Supabase function secrets, not browser-exposed `VITE_` variables
- AI search accepts at most 40 candidate people chosen by the browser from the current graph state
- AI search and AI summary functions strip email addresses and URLs from note, person, tag, and cached-summary text before sending context to the AI provider
- AI summaries refresh only when the user presses the selected person's AI summary refresh action; note create and update events no longer trigger automatic AI refresh

Required follow-up hardening:

- run Supabase advisors against the live project
- verify table grants in the live database, especially that `anon` does not have unnecessary table privileges
- run `supabase/tests/security_regression_checks.sql` against the live project and extend it with user A/user B mutation checks when a test harness with seeded auth users is available
- keep `SUPABASE_SERVICE_ROLE_KEY` only in local MCP/server environments

## Production Web Controls

The `social.datanode.live` nginx deployment adds:

- `Content-Security-Policy`
- `Cross-Origin-Opener-Policy`
- `Referrer-Policy`
- `X-Content-Type-Options`
- `X-Frame-Options`
- `Permissions-Policy`
- no-cache headers for SPA HTML
- immutable cache headers for hashed static assets
- 404 responses for hidden dotfiles outside `/.well-known`

The CSP allows browser connections to the configured Supabase project and websocket endpoint. If the app adds new browser-side providers, update the CSP intentionally rather than weakening it broadly.

## Data-Minimization Direction

The product value depends on search across relationship data, so removing cloud storage entirely would weaken the product. The better target is explicit data ownership:

- keep signed-out exploration local
- make cloud sync explicit for account-backed persistence
- add one-click export for graph data
- add one-click account data deletion
- keep imported source archives client-side
- store only normalized contact fields that the product actually uses
- expose clear sync status and last-updated timestamps

The app now provides graph import, graph export, graph deletion, and account-data deletion controls from the account menu. Graph import replaces the current graph after confirmation and restores people, tags, notes, and blob groups from a SocialDataNode JSON export. Account-data deletion clears graph rows, AI summaries, tags, blob groups, profile fields, and root-person identity fields while preserving the Auth user record because the current root-person trigger intentionally blocks root deletion.

This preserves searchable cloud data while reducing hidden retention and user surprise.

## Encryption Direction

Current encryption is transport/provider-level only:

- HTTPS in transit
- Supabase/Postgres platform storage controls at rest

This does not prevent a database operator or privileged service role from reading user graph content.

Potential next steps:

- encrypt especially sensitive note bodies client-side before storing them
- use a user-held encryption key derived from a passphrase or platform credential
- keep non-sensitive searchable metadata unencrypted for graph/search UX
- require explicit consent before sending user notes or imported contact data to AI providers

Full end-to-end encryption is a larger architecture change because AI search, AI summaries, server-side sync, and database search cannot read encrypted content without user-side decryption.
