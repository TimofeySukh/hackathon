# Moi production embed design

## Goal

Expose the real `social.datanode.live` application inside the Summer moi workspace without
duplicating the frontend bundle, replacing persistence, or weakening framing protection on the
normal production routes. The embedded application must use the existing Supabase project,
browser storage, and authenticated graph path.

## Constraints

- Do not change graph data, Supabase schema, RLS, API behavior, or normal application routes.
- Do not enable framing for `/`, `#board`, assets, or other existing responses.
- Do not use CI. Validate locally, commit on the current branch, and promote by pushing the tested
  commit directly to the existing `production` branch so the home-server poller can deploy it.
- Preserve the existing non-embedded Google OAuth behavior.
- Keep the moi applet isolated from the production origin through the browser's same-origin policy.

## Approaches considered

1. **Dedicated `/embed` response with an explicit OpenAI/ChatGPT ancestor allowlist.** This keeps
   the normal site protected and gives the iframe the real production origin, storage, backend,
   and authentication. This is the selected approach.
2. **Dedicated `/embed` response with `frame-ancestors *`.** This works for unknown parents but
   exposes authenticated UI to clickjacking from arbitrary sites, so it is rejected.
3. **Runtime mirror inside moi.** This bypasses response headers but runs under an opaque origin,
   which breaks durable IndexedDB, OAuth redirects, and persisted sessions. This is the current
   temporary implementation and will be removed.

## Production route

The nginx deployment adds an exact-match `/embed` location before the existing SPA fallback.
It serves the same built `index.html` with the same security, cache, permissions, and content
policies as the normal HTML response except for framing:

- `frame-ancestors` allows `https://chatgpt.com`, `https://*.chatgpt.com`, and
  `https://*.openai.com`.
- `X-Frame-Options` is omitted for this exact response because it cannot express the required
  multi-origin allowlist.
- Every other route retains `frame-ancestors 'none'` and `X-Frame-Options: DENY`.
- `/embed` remains `no-cache, no-store, must-revalidate`, matching `index.html`.

Assets continue to use their existing immutable-cache locations and headers. Framing directives
on subresources do not grant framing access to the application document.

## Authentication behavior

Email/password authentication, Supabase session persistence, IndexedDB, PostgREST, Edge Functions,
and Realtime use the real `https://social.datanode.live` origin inside the iframe.

Google OAuth cannot render its provider page inside an iframe. When the application detects that
it is embedded, the Google action opens the Supabase OAuth URL in a user-initiated popup. The popup
returns to `social.datanode.live`; the resulting Supabase session is written to the same-origin
storage shared with the embedded application. The existing redirect behavior remains unchanged
when the site is not embedded. Popup failure produces a clear auth error and does not mutate graph
state.

Confirmation and recovery links remain normal top-level links. Their callback routing continues to
use the existing `sdn_auth_return=board` marker and does not require a new backend endpoint.

## Moi view

The `Social board` view becomes a small full-height iframe wrapper around
`https://social.datanode.live/embed`. Its sandbox allows scripts, forms, same-origin storage,
downloads, modals, and user-initiated popups. Because the framed document is cross-origin from moi,
`allow-same-origin` restores production storage without granting access to the moi parent document.

The runtime asset mirror, import-map rewriting, fake IndexedDB, and in-memory storage are removed.
If production is unavailable or the frame is rejected, the view keeps a direct link to production
as recovery; it never substitutes demo data for a signed-in graph.

## Verification

Before deployment:

1. Run lint, TypeScript/build, bundle validation, and relevant local tests without CI.
2. Validate nginx syntax in an nginx container or installed nginx binary.
3. Serve the production container locally and assert:
   - `/` still returns `frame-ancestors 'none'` and `X-Frame-Options: DENY`;
   - `/embed` returns the explicit ancestor allowlist and no `X-Frame-Options`;
   - `/embed` serves the SPA and production assets successfully.
4. Exercise standalone auth routing and an embedded Google OAuth unit or browser test without using
   real user credentials.

Deployment and post-deployment:

1. Commit all hackathon changes on the existing branch.
2. Push that commit directly to `origin/production`; do not run a CI workflow.
3. Poll the public `/embed` headers until the home-server poller publishes the commit.
4. Verify that `/` retains its original anti-framing headers.
5. Switch and bundle the moi view, then verify that the production landing and `#board` render.
6. Authentication requiring personal credentials is handed to the user; no credentials are read,
   entered, or stored by the implementation process.

## Rollback

If `/embed` fails or changes existing headers, revert the production commit and push the revert
directly to `production`. The normal site remains the safety boundary throughout deployment. The
current moi runtime mirror is kept until public header checks pass, so the view is not switched to
the direct iframe prematurely.
