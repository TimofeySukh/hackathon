# Authentication

## Purpose

Authentication lets a visitor claim a personal board and sync it through Supabase while
keeping anonymous editing possible. Registration intentionally asks only for email and
password so a database user is created without forcing profile setup.

## Behavior

- Signed-out visitors can edit locally. They are nudged to sign in via a red `!` badge on
  the Settings gear and a **Sign in** block inside Settings (no floating banner).
- Sign-in also opens from the landing header (**Log in** / **Sign up**) and opens the same
  auth dialog as the board.
- The dialog supports Google sign-in, email sign-in, email/password registration, password
  reset request, and password update from a Supabase recovery link.
- Email registration requires only an email and a password. Email confirmation is still
  required when enabled in Supabase.
- After registration that needs confirmation, the dialog keeps the email address and offers
  a resend confirmation action.
- Password reset requests use a generic success message so the UI does not reveal whether
  an email address is registered.
- Password recovery links are handled by Supabase URL session detection. When the app sees
  the `PASSWORD_RECOVERY` auth event, it opens the dialog directly in the new-password state.
- Supabase OAuth, confirmation, and recovery callbacks return to the clean app URL without
  a hash fragment. Authenticated users can still view the landing, docs, contact, and
  privacy screens; the app opens `#board` only after an explicit board CTA, a direct
  `#board` URL, or a stored auth callback return target.
- Login attempts include a `sdn_auth_return=board` callback URL parameter and mirror that
  return target in `localStorage` and `sessionStorage`. Supabase callback signatures
  (`code`, token hash parameters, recovery/error parameters) also resolve to the board
  route on the first app render while Supabase restores the session.
- Email login stores the board return marker before calling Supabase. Navigating from
  `#board` back to the clean domain clears stale board return markers.
- After a successful password update, the dialog stays open in a final success state.
- New passwords require at least 8 characters, with no composition rule.

## Design

- The auth dialog follows the Material 3 dialog/bottom-sheet direction from
  [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md).
- The desktop dialog uses `--md-surface-container-low`, `--md-r-xl`, and `--md-elev-3`.
- On narrow screens the dialog sits at the bottom of the viewport like a compact sheet.
- Inputs use the app's rounded tonal shell pattern (no border, no bottom rule).
- Notices use `--md-secondary-container`; errors use `--md-error`.

## Code

- Main file(s): `src/App.tsx`, `src/lib/useAuth.ts`, `src/styles/panels.css`.
- Key functions / components: `useAuth`, `openSignInModal`, `handleEmailAuthSubmit`,
  `handleResendConfirmation`, auth dialog JSX in `App`.
- Related state: `showSignInModal`, `emailAuthMode`, `emailAuthBusy`, `emailAuthNotice`,
  `emailAuthError`, `isPasswordRecovery`.

## Open questions / TODO

- Supabase confirmation and recovery email templates are configured in the Supabase
  Dashboard. Customize templates and sender domain for a fully branded email experience.
