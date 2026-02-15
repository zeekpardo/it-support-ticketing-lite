# Security Hardening Plan

## Overview

Findings from a full-stack security audit. Items are grouped by priority and organized so each fix builds on a shared foundation of utilities introduced early on.

---

## Phase 1 — Foundation (shared utilities)

These create reusable modules that later phases depend on.

### 1.1 Add a `sanitize` utility module ✅

> `backend/src/utils/sanitize.js`

A single module exporting small, composable functions used across routes, email templates, and validation:

- **`sanitizeUrl(url)`** — ✅ Implemented. Parses with `new URL()`, allows only `http:` / `https:` protocols, throws `ValidationError` otherwise. Returns `null` for empty/undefined input.
- **`escapeHtml(str)`** — ✅ Implemented. Encodes `& < > " '` for safe HTML interpolation. Used by email templates via `greeting()`, `headerComponent()`, `quoteBlock()`, and inline paragraph interpolations.
- **`isAllowedMimeType(mimetype, allowlist)`** — ✅ Implemented. Generic MIME type checker used by `uploadAttachments` in upload middleware.

A frontend companion utility was also added at `frontend/src/utils/sanitize.ts` exporting `safeHref()` for defense-in-depth URL validation on the rendering side.

### 1.2 Install and configure Helmet ✅

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

### 2.1 Validate URL fields on the backend ✅

Apply `sanitizeUrl()` in the route handlers that accept URL input. Throws a 400 `ValidationError` for non-HTTP(S) URLs.

| Route file | Field(s) | Status |
|---|---|---|
| `tickets/crud.js` | `screenRecordingLink` | ✅ Done — create (line 241) and update (line 298) |
| `portal.js` | `screenRecordingLink` | ✅ Done — portal ticket creation (line 270) |
| `project-software/catalog.js` | `iconUrl`, `websiteUrl` | ✅ Done |

Frontend defense-in-depth: `safeHref()` applied in `TicketDetail.tsx` and `PortalTicketDetail.tsx` to prevent rendering dangerous URIs from legacy data.

### 2.2 Switch attachment uploads to an allowlist ✅

Replace the `blockedExtensions` array in `upload.js` with a call to `isAllowedMimeType()` using a whitelist of safe types (images, PDFs, Office documents, plain text, CSV). Same pattern already used by `uploadAvatar` and `uploadIcon` — make `uploadAttachments` consistent with them.

### 2.3 Sanitize rich text editor link insertion ✅

In `rich-text-editor.tsx`, use TipTap's `setLink({ href })` API for the "no selection" code path instead of raw `insertContent` with string interpolation. This matches how the "has selection" path already works — just use the same approach for both branches.

---

## Phase 3 — Output encoding

### 3.1 HTML-encode user data in email templates ✅

In `email.js`, wrap every user-provided variable (`authorName`, `clientName`, `projectName`, `recipientName`, etc.) with `escapeHtml()` before interpolation. This is a find-and-replace across the template functions — the encoding function is already available from Phase 1.

A quick way to identify all spots: search for `${` inside backtick strings in that file and assess each one. Static values (colors, URLs to the app) don't need encoding; anything sourced from the database does.

---

## Phase 4 — Access control gaps

### 4.1 Protect the `/api/email-config` endpoint ✅

Removed entirely — it was a debugging endpoint that leaked environment configuration to unauthenticated users.

### 4.2 Replace static file serving with authenticated downloads ✅

Migrated all uploads (avatars, icons, attachments) from local disk to S3 (Railway bucket) and removed `express.static('/uploads')` entirely. All files are now stored with an `s3:` prefix in the database and resolved to short-lived presigned URLs on retrieval.

Key changes:
- `storage.js` — added `generateStorageKey()` and `resolveFileUrl()` utilities
- `upload.js` — switched all uploads to `memoryStorage()`, reduced avatar limit to 512KB
- `profile.js` — avatar upload/delete via S3, added `/profile/avatar-url` endpoint
- `superAdmin.js` — icon upload via S3, presigned URL resolution in all software responses
- `entityHelpers.js` — ticket attachments uploaded to S3
- `catalog.js`, `crud.js`, `portal-software.js`, `members.js` — resolve `iconUrl` in all responses
- `index.js` — removed `express.static('/uploads')` and unused `path` import
- `vite.config.ts` — removed `/uploads` proxy
- `Settings.tsx` — avatar loaded via presigned URL endpoint, size limit updated to 512KB

### 4.3 Add production guard to webhook validation ✅

In `webhookAuth.js`, if `RESEND_WEBHOOK_SECRET` is unset and `NODE_ENV === 'production'`, throw an error instead of silently skipping validation. Dev behavior stays unchanged.

---

## Phase 5 — Auth hardening

### 5.1 Verify production `BETTER_AUTH_SECRET` ✅

Verified — production `timer` service has a real random base64 secret, not the local `.env` placeholder. No action needed.

### 5.2 Remove dead legacy auth route ✅

Deleted `backend/src/routes/auth.js`. It was not imported or mounted anywhere in `index.js` (Better Auth handles all auth via `app.all('/api/auth/*')`).

### 5.3 Replace plaintext password in welcome emails ✅

Changed the member creation flow to use Better Auth's `forgetPassword` API to generate a time-limited reset token. A context bridge (`markWelcomeEmail`/`consumeWelcomeContext`) lets the `sendResetPassword` callback distinguish welcome emails from normal password resets and send the appropriate template. Added a `/reset-password` frontend page that accepts the token and lets the user set their password.

### 5.4 Consider reducing session duration ✅

Reduced from 7-day sliding window to 4-hour sliding window with hourly refresh. Configured in `lib/auth.js` under the `session` object.

---

## Phase 6 — Dependency maintenance

### 6.1 Run `npm audit fix` in backend ✅

Resolved the `qs` low-severity DoS vulnerability. Non-breaking — 1 package changed, 0 vulnerabilities remaining.

### 6.2 Evaluate Vite upgrade for frontend ✅

Upgraded from Vite 5.4.21 to 7.3.1 (with `@vitejs/plugin-react` v5). The `esbuild` moderate vulnerability is resolved — 0 vulnerabilities remaining. `manualChunks` (vendor-react, vendor-ui, vendor-editor) and `React.lazy()` code splitting all work correctly. No config changes were needed.

---

## Checklist

| # | Item | Phase | Severity | Status |
|---|---|---|---|---|
| 1 | Create `sanitize.js` utility module | 1 | — | ✅ Done (`sanitizeUrl`, `isAllowedMimeType`, `escapeHtml`) |
| 2 | Install and configure Helmet | 1 | High | ✅ Done |
| 3 | Validate `screenRecordingLink` URL | 2 | High | ✅ Done (backend + frontend defense-in-depth) |
| 4 | Validate `iconUrl` / `websiteUrl` | 2 | Medium | ✅ Done |
| 5 | Switch attachment uploads to allowlist | 2 | Medium | ✅ Done |
| 6 | Fix rich text editor link insertion | 2 | Medium | ✅ Done |
| 7 | HTML-encode email template variables | 3 | Medium | ✅ Done |
| 8 | Protect or remove `/api/email-config` | 4 | High | ✅ Removed |
| 9 | Authenticated file downloads | 4 | High | ✅ Done (migrated to S3) |
| 10 | Production guard on webhook secret | 4 | Medium | ✅ Done |
| 11 | Verify production auth secret | 5 | Medium | ✅ Verified |
| 12 | Delete legacy `routes/auth.js` | 5 | Low | ✅ Deleted |
| 13 | Replace password email with reset link | 5 | Medium | ✅ Done |
| 14 | Reduce session duration | 5 | Low | ✅ Done |
| 15 | `npm audit fix` backend | 6 | Low | ✅ Done |
| 16 | Evaluate Vite upgrade | 6 | Low | ✅ Done (v5.4→v7.3) |