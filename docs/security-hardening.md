# Security Hardening Plan

## Overview

Findings from a full-stack security audit. Items are grouped by priority and organized so each fix builds on a shared foundation of utilities introduced early on.

---

## Phase 1 — Foundation (shared utilities)

These create reusable modules that later phases depend on.

### 1.1 Add a `sanitize` utility module ✅ (partial)

> `backend/src/utils/sanitize.js`

A single module exporting small, composable functions used across routes, email templates, and validation:

- **`sanitizeUrl(url)`** — ✅ Implemented. Parses with `new URL()`, allows only `http:` / `https:` protocols, throws `ValidationError` otherwise. Returns `null` for empty/undefined input.
- **`escapeHtml(str)`** — Pending. Encodes `& < > " '` for safe HTML interpolation. Used by email templates and anywhere user text lands inside HTML strings.
- **`isAllowedMimeType(mimetype, allowlist)`** — Pending. Generic MIME type checker that replaces the current blocklist logic in upload middleware.

A frontend companion utility was also added at `frontend/src/utils/sanitize.ts` exporting `safeHref()` for defense-in-depth URL validation on the rendering side.

### 1.2 Install and configure Helmet

> `backend/src/index.js`

Add `helmet` as middleware before all route handlers. Use sensible defaults, then override only what's necessary (e.g. relax CSP for presigned S3 image URLs). This single addition covers:

- `Content-Security-Policy`
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Strict-Transport-Security`
- Removes `X-Powered-By`

No custom header logic needed — Helmet's defaults handle it.

---

## Phase 2 — Input validation

Each item reuses `validateUrl` and `escapeHtml` from Phase 1.

### 2.1 Validate URL fields on the backend ✅ (partial)

Apply `sanitizeUrl()` in the route handlers that accept URL input. Throws a 400 `ValidationError` for non-HTTP(S) URLs.

| Route file | Field(s) | Status |
|---|---|---|
| `tickets/crud.js` | `screenRecordingLink` | ✅ Done — create (line 241) and update (line 298) |
| `portal.js` | `screenRecordingLink` | ✅ Done — portal ticket creation (line 270) |
| `project-software/catalog.js` | `iconUrl`, `websiteUrl` | Pending |

Frontend defense-in-depth: `safeHref()` applied in `TicketDetail.tsx` and `PortalTicketDetail.tsx` to prevent rendering dangerous URIs from legacy data.

### 2.2 Switch attachment uploads to an allowlist

Replace the `blockedExtensions` array in `upload.js` with a call to `isAllowedMimeType()` using a whitelist of safe types (images, PDFs, Office documents, plain text, CSV). Same pattern already used by `uploadAvatar` and `uploadIcon` — make `uploadAttachments` consistent with them.

### 2.3 Sanitize rich text editor link insertion

In `rich-text-editor.tsx`, use TipTap's `setLink({ href })` API for the "no selection" code path instead of raw `insertContent` with string interpolation. This matches how the "has selection" path already works — just use the same approach for both branches.

---

## Phase 3 — Output encoding

### 3.1 HTML-encode user data in email templates

In `email.js`, wrap every user-provided variable (`authorName`, `clientName`, `projectName`, `recipientName`, etc.) with `escapeHtml()` before interpolation. This is a find-and-replace across the template functions — the encoding function is already available from Phase 1.

A quick way to identify all spots: search for `${` inside backtick strings in that file and assess each one. Static values (colors, URLs to the app) don't need encoding; anything sourced from the database does.

---

## Phase 4 — Access control gaps

### 4.1 Protect the `/api/email-config` endpoint

Either:
- **Remove it entirely** if it was only for early debugging, or
- **Gate it** behind `authenticate` + `requireAdmin` middleware (same pattern used by every other admin route)

### 4.2 Replace static file serving with authenticated downloads

Currently `express.static('/uploads')` serves all uploaded files without auth. Replace with a route handler that:

1. Looks up the file record in the database (attachment, avatar, or icon)
2. Checks the requesting user has access to the parent entity (ticket, project, member)
3. Streams the file or returns a short-lived presigned URL

This mirrors how S3 attachments already work — apply the same pattern to local uploads for consistency. Consider migrating all uploads to S3 to have a single storage strategy.

### 4.3 Add production guard to webhook validation

In `webhookAuth.js`, if `RESEND_WEBHOOK_SECRET` is unset and `NODE_ENV === 'production'`, throw an error at startup instead of silently skipping validation. Dev behavior stays unchanged.

---

## Phase 5 — Auth hardening

### 5.1 Verify production `BETTER_AUTH_SECRET`

Check the Railway `timer` service environment to confirm the secret is a real random value, not the placeholder from the local `.env`. Generate a new one if needed:

```
openssl rand -base64 48
```

Set it via Railway CLI or dashboard — no code change required.

### 5.2 Remove dead legacy auth route

Delete `backend/src/routes/auth.js`. It is not imported or mounted anywhere in `index.js` (Better Auth handles all auth via `app.all('/api/auth/*')`). Keeping it risks a future developer accidentally mounting it, re-introducing JWT signing with an undefined secret.

### 5.3 Replace plaintext password in welcome emails

Change the member creation flow to:
1. Create the user with a random password (already happening)
2. Generate a time-limited password-reset token
3. Send a welcome email with a "Set your password" link instead of the raw password

Better Auth has built-in password reset support — use its token generation rather than building a custom one.

### 5.4 Consider reducing session duration

Current: 7-day sliding window. Recommended: 24-hour absolute expiry, or a shorter sliding window (4 hours). This is a one-line config change in `lib/auth.js` under the `session` object.

---

## Phase 6 — Dependency maintenance

### 6.1 Run `npm audit fix` in backend

Resolves the `qs` low-severity DoS vulnerability. Non-breaking.

### 6.2 Evaluate Vite upgrade for frontend

The `esbuild` moderate vulnerability only affects the dev server (not production builds). Upgrading Vite to v6.2+ resolves it but is a major version bump — test locally before merging.

**Note:** `vite.config.ts` now includes `manualChunks` config (vendor-react, vendor-ui, vendor-editor) and the frontend uses `React.lazy()` code splitting in `App.tsx`. Verify these work correctly after a major Vite upgrade — Rollup chunk config may need adjustments for v6.

---

## Checklist

| # | Item | Phase | Severity | Status |
|---|---|---|---|---|
| 1 | Create `sanitize.js` utility module | 1 | — | ✅ Partial (`sanitizeUrl` done, `escapeHtml` + `isAllowedMimeType` pending) |
| 2 | Install and configure Helmet | 1 | High | |
| 3 | Validate `screenRecordingLink` URL | 2 | High | ✅ Done (backend + frontend defense-in-depth) |
| 4 | Validate `iconUrl` / `websiteUrl` | 2 | Medium | |
| 5 | Switch attachment uploads to allowlist | 2 | Medium | |
| 6 | Fix rich text editor link insertion | 2 | Medium | |
| 7 | HTML-encode email template variables | 3 | Medium | |
| 8 | Protect or remove `/api/email-config` | 4 | High | |
| 9 | Authenticated file downloads | 4 | High | |
| 10 | Production guard on webhook secret | 4 | Medium | |
| 11 | Verify production auth secret | 5 | Medium | |
| 12 | Delete legacy `routes/auth.js` | 5 | Low | |
| 13 | Replace password email with reset link | 5 | Medium | |
| 14 | Reduce session duration | 5 | Low | |
| 15 | `npm audit fix` backend | 6 | Low | |
| 16 | Evaluate Vite upgrade | 6 | Low | |