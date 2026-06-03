# Security

This document records the current security and privacy model for the social graph board.

## Current State

The app has two storage modes:

- signed-out local board state in browser memory
- signed-in Supabase-backed private board state

Signed-in data currently stored in Supabase includes profiles, boards, people, tags, notes, AI summaries, and connections. This is sensitive relationship data. Treat it as private user data.

LinkedIn archive import is parsed in the browser. The archive itself is not uploaded as a file. Imported connection fields are saved only after the app creates people and source notes from the selected `Connections.csv` data.

## Supabase Controls

Current database controls:

- row-level security is enabled on `profiles`, `boards`, `tags`, `people`, `notes`, `connections`, and `person_ai_notes`
- user-owned RLS policies scope rows with `auth.uid()`
- triggers validate tag, note, AI-note, and connection ownership
- root people are protected against deletion and movement
- graph writes go through the frontend graph storage layer rather than direct UI calls scattered through components

Current Edge Function controls:

- AI Edge Functions are configured with `verify_jwt = false` at the Supabase gateway
- each AI function validates the caller with `supabase.auth.getUser()`
- each AI function performs owner checks before reading or writing graph data
- AI provider keys stay in Supabase function secrets, not browser-exposed `VITE_` variables

Required follow-up hardening:

- run Supabase advisors against the live project
- verify table grants in the live database, especially that `anon` does not have unnecessary table privileges
- add SQL regression checks or integration tests proving that user A cannot read or mutate user B graph rows
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
