# Whitelabel Platform — Implementation Plan

> **Goal:** Allow each organization to fully whitelabel the platform — their own branding, email sending domain, and URL — so their end users never see "Groovi Support."

---

## Architecture Overview

**Three pillars, implemented in phases:**

| Phase | What | Value | Effort |
|-------|------|-------|--------|
| 1 — Branding | Logo, favicon, app name, colors per org | Org identity everywhere | Low-Medium |
| 2 — Email Domains | Custom sending domain per org (+ per project override) | Emails from `support@acme.com` | Medium |
| 3 — Subdomain Routing | Each org gets `acme.groovi.support` | Fully isolated tenant URL | Medium |

**Future (not in scope):** Custom vanity domains (`support.acme.com`) — requires reverse proxy + cert automation.

---

## Phase 1: Org Branding

Store branding config per organization. Frontend loads it on init and applies throughout.

### Database

- [ ] Add branding fields to `Organization` model (or new `BrandingConfig` model):
  - `appName` — custom app name (default: "Groovi Support")
  - `logo` — already exists on Organization (unused) — logo URL
  - `favicon` — favicon URL
  - `primaryColor` — hex color for buttons, links, accents (default: `#2563eb` blue)
  - `emailHeaderHtml` — optional custom HTML header for emails
- [ ] Create migration

### Backend

- [ ] `GET /api/branding` — public endpoint (no auth required), returns branding for current org
  - Org resolved from: `X-Organization-Id` header, subdomain (Phase 3), or default
  - Returns: `{ appName, logo, favicon, primaryColor }` or defaults
- [ ] `PUT /api/branding` — owner-only, update branding config
- [ ] Upload endpoints for logo + favicon (or reuse existing file upload if any)
- [ ] Modify `email.js` — email templates use org branding:
  - `APP_NAME` → org's `appName`
  - Email footer uses org name + logo
  - Button colors use org's `primaryColor`
  - Base template can include org logo header

### Frontend

- [ ] Create `BrandingProvider` context — loads branding on app init
- [ ] Apply CSS custom properties at runtime:
  ```css
  --color-primary: {org.primaryColor};
  --color-primary-hover: {darken(org.primaryColor)};
  ```
- [ ] Replace hardcoded "Groovi Support" text:
  - [ ] `index.html` `<title>` — set dynamically via `document.title`
  - [ ] `Register.tsx` — "Get started with {appName}"
  - [ ] `Onboarding.tsx` — "Welcome to {appName}!"
  - [ ] Favicon `<link>` — swap dynamically
- [ ] Admin settings page: "Branding" — logo upload, color picker, app name input, favicon upload
- [ ] Sidebar/header: show org logo if set

### Files Affected

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add branding fields to Organization |
| `backend/src/routes/branding.js` | **New** — branding API routes |
| `backend/src/index.js` | Register branding route |
| `backend/src/lib/email.js` | Use org branding in templates |
| `frontend/src/contexts/BrandingProvider.tsx` | **New** — branding context |
| `frontend/src/index.css` | CSS variables for theming |
| `frontend/src/pages/Register.tsx` | Dynamic app name |
| `frontend/src/pages/Onboarding.tsx` | Dynamic app name |
| `frontend/src/pages/admin/BrandingSettings.tsx` | **New** — admin UI |
| `frontend/src/App.tsx` | Add route + wrap with BrandingProvider |
| `frontend/src/components/Layout.tsx` | Show org logo, add sidebar link |

---

## Phase 2: Email Domains

Custom sending domains with org-level default + per-project override. Uses Resend Domains API.

### Hierarchy

```
Project emailDomainId (if set + verified)
  → Organization defaultEmailDomainId (if set + verified)
    → Global FROM_EMAIL env var (last resort)
```

### Database

- [ ] Add `EmailDomain` model:
  - `id`, `organizationId` (FK, not unique — org can have multiple)
  - `domain` — e.g., `acme.com`
  - `resendDomainId` — Resend's domain ID
  - `status` — enum: `PENDING`, `VERIFIED`, `FAILED`
  - `fromName` — display name (e.g., "Acme Support")
  - `fromUser` — local part before @ (default: `support`)
  - `dnsRecords` — JSON blob of DNS records from Resend
  - `verifiedAt`, `createdAt`, `updatedAt`
- [ ] Add to `Organization`: `defaultEmailDomainId` (optional FK)
- [ ] Add to `Project`: `emailDomainId` (optional FK)
- [ ] Create migration

### Backend

- [ ] Create `emailDomainService.js`:
  - `addDomain(orgId, { domain, fromName, fromUser })` — Resend `domains.create()`
  - `verifyDomain(id)` — Resend `domains.verify()` + `domains.get()`
  - `refreshDomainStatus(id)` — poll Resend for status update
  - `removeDomain(id)` — Resend `domains.remove()`, clear references
  - `getFromAddress(orgId, projectId?)` — the key lookup (with 5-min cache)
  - `getEmailDomain(orgId, projectId?)` — domain string for Message-ID
  - `invalidateCache(orgId)` — bust on changes
- [ ] Create `email-domains.js` routes:
  - `GET /api/email-domains` — list all for org
  - `POST /api/email-domains` — add domain, returns DNS records
  - `POST /api/email-domains/:id/verify` — trigger verification
  - `POST /api/email-domains/:id/refresh` — poll status
  - `PUT /api/email-domains/:id` — update fromName/fromUser
  - `DELETE /api/email-domains/:id` — remove domain
  - `PUT /api/email-domains/:id/set-default` — set as org default
- [ ] Modify `email.js`:
  - `sendEmail()` — add optional `from` parameter
  - `generateMessageId()` — add optional `domain` parameter
  - All org-scoped email functions — add `organizationId` + `projectId`, look up from address
- [ ] Modify `notificationService.js` — pass `organizationId` through to email callbacks
- [ ] Modify `notificationTypes.js` — all `sendEmail` callbacks accept + forward `organizationId`
- [ ] Update direct email call sites:
  - `members.js` — pass `organizationId` to `sendWelcomeEmail`
  - `auth.js` — pass `organizationId` to `sendInvitationEmail`

### Frontend

- [ ] Create `emailDomains.ts` API client
- [ ] Create `EmailDomainSettings.tsx` admin page:
  - Domain list with status badges
  - Add domain form
  - DNS records table per domain
  - Verify / Refresh buttons
  - Set as Default toggle
  - Remove with confirmation
- [ ] Add email domain selector to project settings (`ProjectEdit.tsx`)
- [ ] Add route + sidebar link

### Files Affected

| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | Add EmailDomain model, FKs on Org + Project |
| `backend/src/services/emailDomainService.js` | **New** |
| `backend/src/routes/email-domains.js` | **New** |
| `backend/src/lib/email.js` | Add `from` param, thread org/project IDs |
| `backend/src/services/notificationTypes.js` | Forward `organizationId` |
| `backend/src/services/notificationService.js` | Thread IDs to email dispatch |
| `backend/src/routes/members.js` | Pass `organizationId` |
| `backend/src/lib/auth.js` | Pass `organizationId` |
| `backend/src/index.js` | Register route |
| `frontend/src/api/emailDomains.ts` | **New** |
| `frontend/src/pages/admin/EmailDomainSettings.tsx` | **New** |
| `frontend/src/pages/admin/ProjectEdit.tsx` | Domain selector |
| `frontend/src/App.tsx` | Add route |
| `frontend/src/components/Layout.tsx` | Add sidebar link |

---

## Phase 3: Subdomain Routing

Each org accessible at `{slug}.groovi.support`. The app detects the subdomain, resolves the org, and loads their branding.

### Prerequisites

- [ ] Wildcard DNS: `*.groovi.support` → your server (A/CNAME record)
- [ ] Wildcard SSL cert: `*.groovi.support` (via Let's Encrypt or Cloudflare)
- [ ] Cookie domain `.groovi.support` already configured in `auth.js` — no change needed

### Backend

- [ ] Add tenant detection middleware:
  - Extract subdomain from `Host` header
  - Look up Organization by `slug`
  - Attach `req.tenantOrg` for downstream use
  - Skip for API-only requests that already use `X-Organization-Id`
- [ ] Update CORS to allow `*.groovi.support`:
  - Replace hardcoded `app.groovi.support` with dynamic origin check
  - Validate origin against `*.groovi.support` pattern
- [ ] Update `trustedOrigins` in `auth.js`:
  - Replace hardcoded list with dynamic check against `*.groovi.support`
- [ ] Add `GET /api/tenant` — public endpoint, returns org info for current subdomain
  - Used by frontend on init to know which org to load

### Frontend

- [ ] On app init: detect subdomain from `window.location.hostname`
  - Extract slug from `{slug}.groovi.support`
  - Call `GET /api/tenant` or `GET /api/branding?slug={slug}` to resolve org
  - Set `organizationId` in API base (already uses `X-Organization-Id` header)
- [ ] Auto-select organization based on subdomain (skip org picker)
- [ ] Login page: brand with org's logo/name/colors
- [ ] Registration: associate new user with subdomain org (or disable public registration per org)
- [ ] Update all frontend links that generate URLs (e.g., invite links, email links):
  - Use `{slug}.groovi.support` instead of `app.groovi.support`

### Admin (Super Admin)

- [ ] Dashboard showing all orgs with their subdomain URLs
- [ ] Option to enable/disable whitelabel per org (free vs paid feature)

### Files Affected

| File | Change |
|------|--------|
| `backend/src/middleware/tenantDetection.js` | **New** |
| `backend/src/index.js` | Add middleware, update CORS |
| `backend/src/lib/auth.js` | Dynamic trustedOrigins, remove hardcoded domain |
| `backend/src/routes/tenant.js` | **New** — public tenant info endpoint |
| `frontend/src/lib/tenant.ts` | **New** — subdomain detection utility |
| `frontend/src/App.tsx` | Tenant init on load |
| `frontend/src/lib/auth-client.ts` | Dynamic base URL |
| `frontend/src/pages/Login.tsx` | Branded login |
| `frontend/src/pages/Register.tsx` | Scoped registration |

---

## Cross-Cutting Concerns

### What Auth Emails Do (All Phases)

Auth emails (verification, password reset, magic link) are called from Better Auth hooks with no org context. These always use the global `FROM_EMAIL`. This is acceptable because:
- Users authenticate against the platform, not a whitelabel instance
- The auth email domain doesn't need to match the org's domain

### Inbound Email with Custom Domains (Phase 2)

Customers wanting inbound email on their domain (e.g., receive at `support@acme.com`) set up a **forwarding rule** in their email provider:
- `support@acme.com` → `{orgslug}@inbound.groovi.support`
- Their MX records stay untouched (Google Workspace / M365 keeps working)
- Outbound replies go FROM `support@acme.com` via Resend (verified domain)
- Full email threading loop works seamlessly

### DNS Changes for Customers (Phase 2)

Customers only need to add to their DNS:
- **SPF**: Add `include:amazonses.com` to existing TXT record (additive, non-breaking)
- **DKIM**: 2-3 CNAME records (non-breaking)
- **No MX changes** — existing email keeps working
- **Forwarding rule** in email admin (Google Admin / Exchange) for inbound

---

## Implementation Order

```
Phase 1 (Branding)        ████████████░░░░░░░░░░░░░░░░░░
Phase 2 (Email Domains)   ░░░░░░░░░░░░████████████░░░░░░
Phase 3 (Subdomain)       ░░░░░░░░░░░░░░░░░░░░░░████████
```

Phases are sequential — each builds on the prior:
- Phase 2 uses branding from Phase 1 in email templates
- Phase 3 uses branding + email domains from Phases 1-2

---

## Verification Checklist

### Phase 1
- [ ] Create org with custom branding (name, logo, color)
- [ ] Confirm login page shows org branding
- [ ] Confirm email notifications use org name + color
- [ ] Confirm another org sees different branding

### Phase 2
- [ ] Add a domain via admin UI, see DNS records
- [ ] Verify domain, confirm status updates
- [ ] Send ticket notification — `From` uses org domain
- [ ] Set project-specific domain — confirm it overrides org default
- [ ] Remove domain — confirm fallback to global

### Phase 3
- [ ] Access `acme.groovi.support` — see Acme branding
- [ ] Access `other.groovi.support` — see different branding
- [ ] Login on subdomain — session works, correct org loaded
- [ ] Email links point to correct subdomain URL
