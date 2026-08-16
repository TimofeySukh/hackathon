# Embedded OAuth Callback Design

**Status:** Approved for immediate production rollout on 2026-08-16.

## Goal

Let the moi-only production embed complete Google OAuth without navigating the workspace,
without relying on cross-tab storage propagation, and without changing standalone or normal
embedded authentication behavior.

## Scope

- Enable the new flow only when the embedded app URL contains `embed_auth=popup-v1`.
- Keep standalone Google OAuth and unflagged `/embed` behavior unchanged.
- Reuse the already allowlisted `/embed` redirect path. Supabase has been probed and preserves
  `sdn_auth_popup_callback=v1`, `sdn_auth_nonce`, and `sdn_auth_return=board` query parameters.
- Do not use `localStorage` or `sessionStorage` to identify or complete the popup.

## Architecture

The flagged iframe generates a cryptographically random nonce before opening the popup. Its
Supabase `redirectTo` points to `/embed` with `sdn_auth_popup_callback=v1`, the nonce, and the
board return marker. Nginx serves a small static callback document for that exact query mode
and serves the normal SPA for every other `/embed` request.

The callback document receives the implicit OAuth tokens in the URL fragment, immediately
removes the fragment from browser history, and sends one same-origin `postMessage` to its
opener. The iframe accepts the message only when all of these match:

- `event.origin` equals the production app origin;
- `event.source` equals the popup handle opened by that iframe;
- the message type is the versioned Social Datanode OAuth result type;
- the message nonce equals the in-memory nonce created before navigation.

The iframe calls `supabase.auth.setSession()` with the received access and refresh tokens. It
sends an acknowledgement only after Supabase returns an authenticated session. The callback
closes after that acknowledgement. Errors remain visible in the popup and are also reported
to the iframe without exposing tokens in logs or storage.

## Security and headers

The callback response uses `Cross-Origin-Opener-Policy: unsafe-none` so the opener relationship
survives the Google round trip. It remains non-embeddable with `frame-ancestors 'none'` and
`X-Frame-Options: DENY`, uses a same-origin script only, sends no referrer, and is never cached.
The ordinary `/embed` response retains its current framing allowlist and `same-origin` COOP.

## Verification

- Unit tests cover feature gating, nonce creation, callback URL construction, strict message
  validation, success acknowledgement, error propagation, and unchanged standalone behavior.
- Nginx tests prove query-mode routing and header isolation.
- A real Chromium test runs a sandboxed cross-origin iframe through a Google-like origin into
  the callback document, verifies `setSession()`, acknowledgement, popup close, and parent
  survival, then verifies unflagged and standalone flows remain unchanged.
- Before production handoff, run the auth tests, lint, production build, public callback probe,
  public bundle inspection, and moi runtime log check.
