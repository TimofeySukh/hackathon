# Privacy Policy Page

## Purpose

Provide a public Privacy Policy URL for OAuth providers, app store forms, and user
trust. The page describes how Social Datanode collects, uses, stores, and deletes
personal data based on the actual product implementation.

## Route

- Hash route: `#privacy`
- Production URL: `https://social.datanode.live/#privacy`
- Component: [`PrivacyPage.tsx`](../../src/PrivacyPage.tsx)
- Styles: [`privacy.css`](../../src/styles/privacy.css)

## Content Requirements

The policy must stay aligned with real product behavior documented in:

- [`auth.md`](auth.md) — Supabase Auth, Google OAuth, email/password
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md) — graph blob storage, local editing, agent API
- [`../DESIGN_LOG.md`](../DESIGN_LOG.md) — persistence and data-boundary decisions

Do not claim features the product does not have (for example, shared boards, ads, or
analytics trackers).

## Entry Points

- Footer link on landing and contact pages
- Auth dialog notice on sign-in and sign-up
- Direct navigation via `#privacy`

## Maintenance Rule

When data handling changes (new third-party provider, new stored fields, new localStorage
keys, account deletion flow, etc.), update:

1. `PrivacyPage.tsx`
2. This doc
3. A durable note in `../DESIGN_LOG.md` if the decision is architectural

## Contact for Privacy Requests

Use the CEO contact email shown on the page unless the team changes the privacy contact.
