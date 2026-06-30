# Authentication

## Purpose

Authentication lets a visitor claim a personal board and sync it through Supabase while
keeping anonymous editing possible. Registration intentionally asks only for email and
password so a database user is created without forcing profile setup.

## Behavior

- Signed-out visitors can keep editing locally and open the auth dialog from the local-save
  hint.
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
  a hash fragment. The app moves authenticated users from the landing page to `#board`
  only after Supabase has detected a valid session, so auth callback fragments are not
  mixed with the hash router.
- Login attempts remember a short-lived board return target in `sessionStorage`. OAuth
  callbacks that arrive at the clean app URL render the board route while Supabase
  restores the session, avoiding a landing-page flash or a false signed-out prompt.
- After a successful password update, the dialog stays open in a final success state so the
  user sees that the password changed and the session is active.
- New passwords require at least 8 characters, with no composition rule.

## Design

- The auth dialog follows the Material 3 dialog/bottom-sheet direction from
  [`../DESIGN_SYSTEM.md`](../DESIGN_SYSTEM.md).
- The desktop dialog uses `--md-surface-container-low`, `--md-r-xl`, and `--md-elev-3`.
- On narrow screens the dialog sits at the bottom of the viewport like a compact sheet.
- Inputs use the app's rounded tonal shell pattern, matching the search menu and existing
  composer fields: no border, no bottom rule, and a soft primary focus halo.
- Notices use `--md-secondary-container`; errors use `--md-error`.
- The form keeps password-manager friendly `autocomplete` attributes for email,
  current password, and new password.

## Code

- Main file(s): `src/App.tsx`, `src/lib/useAuth.ts`, `src/styles/panels.css`.
- Key functions / components: `useAuth`, `handleEmailAuthSubmit`,
  `handleResendConfirmation`, auth dialog JSX in `App`.
- Related state / hooks: `emailAuthMode`, `emailAuthBusy`, `emailAuthNotice`,
  `emailAuthError`, `isPasswordRecovery`.

## Open questions / TODO

- Supabase confirmation and recovery email templates are still configured in the Supabase
  Dashboard. Customize those templates and the sender domain there for a fully branded
  email experience.
