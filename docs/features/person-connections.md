# Person Connections

## Purpose

Provides a compact links menu for person nodes inside the inspector. Connections are separate from notes so profiles, handles, phone-based app links, and imported LinkedIn URLs stay quick to open and manage.

## Behavior

- Imported LinkedIn profile URLs from `Connections.csv` are saved as LinkedIn connections on the imported person.
- LinkedIn profile URLs pasted into board search create one person when enrichment succeeds.
  If server-side enrichment explicitly fails, the UI shows an error and does not create a
  fallback person (see [`board-search.md`](board-search.md)).
- Profile descriptions are saved as a regular note titled "Profile"; the
  LinkedIn profile URL is still saved as a LinkedIn connection.
- Users can add any custom URL, social profile, handle, or phone number from the person inspector.
- URL-like input is normalized into an openable `https://` link when needed.
- `@handle` input opens a quick service picker for Telegram, Instagram, or X before saving.
- Phone-like input opens a quick service picker for WhatsApp, Telegram, or a custom website before saving.
- Unsaved connection input and the service picker are discarded whenever the inspector selection changes or closes, so draft link state never carries from one person to another.
- Existing connections render with a service icon, label, external-open action, and delete control.

## Design

- The menu is intentionally dense and sits below Notes in the person inspector, without a divider line between the two blocks.
- Each connection row uses a left service icon, one-line label, and a small external-link icon.
- The block uses the same Material 3 neutral container roles as the inspector and notes list.

## Code

- Main files:
  - [`../../src/App.tsx`](../../src/App.tsx)
  - [`../../src/styles/inspector-fields.css`](../../src/styles/inspector-fields.css)
- Key functions: `inferLinkService`, `normalizeLinkInput`, `addPersonLink`, `deletePersonLink`, `handleSaveNewLink`

## Open questions / TODO

- Brand SVG icons replace text badges where applicable (see `ConnectionServiceIcon` in App).
