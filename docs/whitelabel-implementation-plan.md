# Whitelabel Platform — Implementation Plan

> **Goal:** Allow each organization to fully whitelabel the platform — their own branding, email sending domain, and URL — so their end users never see "Groovi Support."

---

## Architecture Overview

**Three pillars, implemented in phases:**

| Phase | What | Status | Value |
|-------|------|--------|-------|
| 1 — Branding | Logo, favicon, app name, colors per org | **Complete** | Org identity everywhere |
| 2 — Email Domains | Custom sending domain per org (+ per inbox override) | **Complete** | Emails from `support@acme.com` |
| 3 — Subdomain Routing | Each org gets `acme.groovi.support` | Pending | Fully isolated tenant URL |

**Future (not in scope):** Custom vanity domains (`support.acme.com`) — requires reverse proxy + cert automation.

---

## How Email Actually Works (Context for Phase 2)

Email has two completely separate layers that most people conflate:

1. **Who hosts your inbox** — where mail is received and stored (Google Workspace, M365)
2. **Who sends your outgoing mail** — SMTP / API sender (Resend, SendGrid, Postmark)

These can be split. A customer keeps Google Workspace managing all their mailboxes and uses Resend only to send outbound email on their behalf. This is standard SaaS architecture.

### Authentication happens at the domain level

Email providers don't care *who* sends — they care whether the **domain** authorizes the sender. This is handled in DNS:

- **SPF** — which servers are allowed to send for this domain
- **DKIM** — cryptographic signature proving authenticity
- **DMARC** — policy enforcement tying SPF + DKIM together

Once a domain is verified, you can send from **any address** at that domain (`support@`, `billing@`, `sales@`, `anything@`). You do not verify individual mailboxes — authentication is domain-wide.

### Sending vs. Receiving are separate pipes

- **Sending** = domain verification (SPF/DKIM records) — authorizes Resend to send on behalf of the domain
- **Receiving** = MX records — determines which server incoming mail is delivered to

Verifying a domain for sending does **not** affect where inbound mail goes. MX records stay pointed at Google. Zero disruption to employees.

### Multi-tenant SaaS sending

Multiple customers, each with completely different domains, can all send through the same Resend account. Resend supports multiple verified domains under one account. Each customer verifies their domain via DNS, and your system sends on their behalf.

**Example:**
- Client A (Planning Center): `support@planningcenter.com`, `people@planningcenter.com`
- Client B (Bike shop): `support@bikebakersfield.com`, `buy@bakersfieldbike.com`

All send through the same SaaS — domain verification is the only requirement.

### Deliverability reputation (at scale)

Email providers track reputation at IP, domain, and DKIM signing domain levels. If one SaaS customer starts sending spam, it can hurt shared sending reputation. At scale, options include dedicated sending IPs, domain-based reputation isolation, or allowing clients to bring their own sending credentials. Not needed initially, but worth knowing about.

---

## Phase 1: Org Branding — COMPLETE

All branding functionality is implemented and live:

- [x] `appName`, `primaryColor`, `favicon`, `logo` fields on Organization model
- [x] `GET /api/branding` + `PUT /api/branding` endpoints
- [x] Logo + favicon upload/remove endpoints
- [x] `getOrgBranding()` service — threaded through all email templates
- [x] `BrandingProvider` context — loads branding on app init
- [x] CSS custom properties (`--color-primary`, `--color-primary-hover`) applied at runtime
- [x] Dynamic `document.title` from `appName`
- [x] Dynamic favicon injection
- [x] Org logo in sidebar
- [x] Admin settings page at `/admin/branding` — color picker, logo/favicon upload, app name input
- [x] All ticket email mailers use `branding.appName` as display name + `branding.primaryColor` for template styling

---

## Phase 2: Email Domains

Custom sending domains with org-level default + per-inbox override. Uses Resend Domains API.

### Conceptual Model

Two distinct concepts, intentionally separated:

1. **Domain** (org-level) — verified via DNS, tracks authentication status
2. **Sender Identity** (inbox-level) — which `user@domain` to send from

A customer verifies `bikebakersfield.com` once. Then each inbox independently controls its sender:
- "General Support" inbox → sends from `support@bikebakersfield.com`
- "Sales" inbox → sends from `buy@bikebakersfield.com`

### Sender Resolution Hierarchy

```
Inbox (Project) emailDomainId + fromUser + fromName (if set + domain verified)
  → Organization defaultEmailDomainId + defaults (if set + verified)
    → Global FROM_EMAIL env var (last resort)
```

---

### Sprint 2.1: Schema + Domain Service + API Routes — COMPLETE

> **Scope:** Database foundation + Resend API integration + REST endpoints.
> Everything downstream depends on this. Pure backend — testable via curl/Postman.

**Database:**
- [x] Add `EmailDomain` model to `schema.prisma`:
  - `id` (String, cuid, PK)
  - `organizationId` (FK — not unique, org can have multiple domains)
  - `domain` — e.g., `bikebakersfield.com`
  - `resendDomainId` — Resend's domain ID (returned from `domains.create()`)
  - `status` — enum: `PENDING`, `VERIFIED`, `FAILED`
  - `dnsRecords` — JSON blob of DNS records from Resend (shown in admin UI)
  - `verifiedAt` — nullable timestamp of successful verification
  - `createdAt`, `updatedAt`
  - Unique constraint on `[organizationId, domain]`
- [x] Add to `Organization`:
  - `defaultEmailDomainId` (optional FK → EmailDomain)
  - `defaultFromUser` (String?, default: `support`)
  - `defaultFromName` (String?, falls back to `appName`)
- [x] Add to `Project` (inbox):
  - `emailDomainId` (optional FK → EmailDomain)
  - `fromUser` (String?) — local part override
  - `fromName` (String?) — display name override
- [x] Run migration (`prisma db push` — Railway start script applies on deploy)

**Service — `emailDomainService.js` (new):**
- [x] `addDomain(orgId, domain)` — Resend `domains.create()`, store domain + DNS records
- [x] `verifyDomain(id)` — Resend `domains.verify()`, update status
- [x] `refreshDomainStatus(id)` — Resend `domains.get()`, sync status
- [x] `removeDomain(id)` — Resend `domains.remove()`, clear FK references on org + inboxes (transaction)
- [x] `setOrgDefault(orgId, emailDomainId)` + `clearOrgDefault(orgId)` — manage org default
- [x] `getFromAddress(orgId, projectId?)` — sender resolution with hierarchy:
  1. Check inbox `emailDomainId` + `fromUser` + `fromName`
  2. Fall back to org `defaultEmailDomainId` + `defaultFromUser` + `defaultFromName`
  3. Fall back to global `FROM_EMAIL`
  4. Only use custom domain if status is `VERIFIED`
  5. Returns `{ from: "Display Name <user@domain.com>", domain: "domain.com" }`
- [x] Cache with 5-min TTL, bust on domain/org/inbox changes (`invalidateSenderCache()`)

**Routes — `email-domains.js` (new):**
- [x] `GET /api/email-domains` — list all domains for current org (includes org defaults)
- [x] `POST /api/email-domains` — add domain (validates format), return DNS records
- [x] `POST /api/email-domains/:id/verify` — trigger verification
- [x] `POST /api/email-domains/:id/refresh` — poll latest status
- [x] `DELETE /api/email-domains/:id` — remove (cascade cleanup)
- [x] `PUT /api/email-domains/:id/set-default` — set as org default
- [x] `DELETE /api/email-domains/org-default` — clear org default
- [x] `PUT /api/email-domains/org-defaults` — update org-level `fromUser`/`fromName`
- [x] All routes require owner role
- [x] Register route in `index.js`

**Files touched:**
| File | Change |
|------|--------|
| `backend/prisma/schema.prisma` | EmailDomain model, FKs on Org + Project |
| `backend/src/services/emailDomainService.js` | **New** |
| `backend/src/routes/email-domains.js` | **New** |
| `backend/src/index.js` | Register route |

---

### Sprint 2.2: Domain Management Admin UI — COMPLETE

> **Scope:** Frontend admin page for managing email domains.
> Pure frontend — consumes the API from Sprint 2.1.

- [x] Create `emailDomains.ts` API client (list, add, verify, refresh, remove, setDefault, clearDefault, updateOrgDefaults)
- [x] Create `EmailDomainSettings.tsx` admin page:
  - [x] Domain list with status badges (Pending → yellow, Verified → green, Failed → red)
  - [x] "Add Domain" form — domain name input + submit
  - [x] DNS records table per domain (type, name, value, status) — expandable per domain, copy-to-clipboard
  - [x] SPF merge warning: amber callout about not replacing existing SPF records
  - [x] Verify button (triggers verification) + Refresh button (polls status, animated spinner)
  - [x] "Set as Default" star toggle per domain (only enabled for verified domains) + "Default" badge
  - [x] Remove button with confirmation dialog
  - [x] Org-level default `fromUser` + `fromName` inputs with live sender preview
  - [x] Empty state with globe icon and CTA
- [x] Add route to `App.tsx` — `/admin/email-domains` → lazy-loaded `EmailDomainSettings`
- [x] Add sidebar link in `Layout.tsx` — "Email Domains" with `GlobeAltIcon` in settings section

**Files touched:**
| File | Change |
|------|--------|
| `frontend/src/api/emailDomains.ts` | **New** — API client |
| `frontend/src/pages/admin/EmailDomainSettings.tsx` | **New** — admin page |
| `frontend/src/App.tsx` | Add route |
| `frontend/src/components/Layout.tsx` | Add sidebar link |

---

### Sprint 2.3: Wire Up Email Sending to Custom Domains — COMPLETE

> **Scope:** Make outbound emails actually use verified custom domains.
> This is the "flip the switch" sprint — emails start going out from `support@clientdomain.com`.

**Email client (`client.js` — 63 lines):**
- [x] Add optional `from` parameter to `sendEmail()` — overrides global `FROM_EMAIL`
- [x] Add optional `domain` parameter — used for `Message-ID` header generation

**Ticket mailers (`mailers/ticket.js` — 383 lines, 8 functions):**
- [x] Add `organizationId` + `projectId` params to all 8 mailer functions
- [x] At top of each function: resolve sender via `getFromAddress(orgId, projectId)`
- [x] Pass resolved `from` to `sendEmail()`
- [x] Pass resolved `domain` to threading chain (for `Message-ID`)
- [x] Functions to update:
  - [x] `sendTicketCommentEmail()`
  - [x] `sendTicketAssignmentEmail()`
  - [x] `sendMentionEmail()`
  - [x] `sendTicketSubmittedEmail()`
  - [x] `sendNewTicketAssignedEmail()`
  - [x] `sendPublicTicketConfirmationEmail()`
  - [x] `sendThreadedTicketReply()`
  - [x] `sendAutoReplyEmail()`

**Files touched:**
| File | Change |
|------|--------|
| `backend/src/lib/email/client.js` | Add `from` + `domain` params |
| `backend/src/lib/email/mailers/ticket.js` | Thread org/project IDs through 8 mailers |

---

### Sprint 2.4: Notification Threading + Inbox Sender Identity UI — COMPLETE

> **Scope:** Thread org/project context through the notification dispatch pipeline so
> every email — whether triggered by a comment, assignment, or mention — resolves the
> correct sender. Plus inbox-level sender identity fields in the frontend.

**Notification service (`notificationService.js`):**
- [x] `createNotification()` — inject `organizationId` into `config.sendEmail()` data
- [x] `notifyMultiple()` — inject `organizationId` into email data
- [x] `sendCommentNotifications()` — extract `projectId` from `ticket.inboxId`, add to `notificationData`
- [x] `sendCommentNotifications()` — pass `organizationId` + `projectId` to both `sendThreadedTicketReply` calls

**Notification types (`notificationTypes.js` — 12 types):**
- [x] Update all `sendEmail` callbacks to forward `organizationId` + `projectId` to mailer functions
- [x] Types with email callbacks updated:
  - [x] `TICKET_ASSIGNED` → `sendTicketAssignmentEmail()`
  - [x] `TICKET_COMMENT` → `sendTicketCommentEmail()`
  - [x] `TICKET_COMMENT_CLIENT` → `sendTicketCommentEmail()`
  - [x] `MENTION` → `sendMentionEmail()`
  - [x] `MENTION_CLIENT` → `sendMentionEmail()`
  - [x] `TICKET_SUBMITTED` → `sendTicketSubmittedEmail()`
  - [x] `NEW_TICKET_ASSIGNED` → `sendNewTicketAssignedEmail()`
  - [x] `ACCESS_REQUEST_SUBMITTED` → `sendAccessRequestEmail()`
  - [x] `ACCESS_REQUEST_APPROVED` → `sendAccessStatusEmail()`
  - [x] `ACCESS_REQUEST_DECLINED` → `sendAccessStatusEmail()`
  - [x] `ACCESS_REQUEST_REVOKED` → `sendAccessStatusEmail()`
  - [x] `SOFTWARE_RENEWAL_REMINDER` → `sendRenewalReminderEmail()`

**Software mailers (`software.js`):**
- [x] Added `resolveSender()` + `organizationId`/`projectId` params to all 3 functions
- [x] Wire custom domain sender into `sendAccessRequestEmail()`, `sendAccessStatusEmail()`, `sendRenewalReminderEmail()`

**Notification call sites — added `projectId` to data:**
- [x] `ticketFromEmailFactory.js` — `projectId: inbox.id`
- [x] `publicTicket.js` — `projectId: inbox.id`
- [x] `portal/tickets.js` — `projectId: inboxId`
- [x] `tickets/crud.js` (NEW_TICKET_ASSIGNED) — `projectId: inbox.id`
- [x] `tickets/crud.js` (TICKET_ASSIGNED) — `projectId: ticket.inboxId`
- [x] Software notification types use existing `data.inboxId` as `projectId`

**Direct email call sites:**
- [x] Note: auth emails (password reset, verification, magic link, invitation) stay on global `FROM_EMAIL` — no org context in Better Auth hooks

**Backend — inbox sender identity:**
- [x] Added `emailDomainId`, `fromUser`, `fromName` to `INBOX_UPDATE_FIELDS` in `inboxes.js`
- [x] Validation: verify emailDomainId belongs to org and is VERIFIED before saving
- [x] Cache invalidation: bust sender cache on inbox email identity field changes

**Frontend — inbox sender identity:**
- [x] Add sender identity fields to inbox edit form (`InboxEdit.tsx` / `InboxGeneralTab`):
  - [x] Email domain selector — dropdown of org's verified domains, or "Use org default"
  - [x] `fromUser` input — local part (e.g., `support`, `buy`, `billing`)
  - [x] `fromName` input — display name (e.g., "Bakersfield Bikes Sales")
  - [x] Preview line: assembled address like `Bakersfield Bikes Sales <buy@bikebakersfield.com>`
  - [x] Empty state when no verified domains exist (links to Email Domain Settings)
- [x] Update inbox form hook to save sender identity fields
- [x] Update API client with new fields

**Files touched:**
| File | Change |
|------|--------|
| `backend/src/services/notificationService.js` | Thread `organizationId` + `projectId` to email dispatch |
| `backend/src/services/notificationTypes.js` | Forward org/project IDs to all 12 email callbacks |
| `backend/src/lib/email/mailers/software.js` | Add `resolveSender()` + custom domain support |
| `backend/src/services/ticketFromEmailFactory.js` | Add `projectId` to notification data |
| `backend/src/routes/publicTicket.js` | Add `projectId` to notification data |
| `backend/src/routes/portal/tickets.js` | Add `projectId` to notification data |
| `backend/src/routes/tickets/crud.js` | Add `projectId` to notification data |
| `backend/src/routes/inboxes.js` | Add sender identity fields + validation + cache bust |
| `frontend/src/api/inboxes.ts` | Add sender identity fields to updateInbox |
| `frontend/src/hooks/useInboxForm.ts` | Add sender identity to form state |
| `frontend/src/pages/admin/InboxEdit.tsx` | Load email domains, pass to general tab |
| `frontend/src/components/inbox/InboxGeneralTab.tsx` | Sender identity UI section |

---

## Inbound Email with Custom Domains

### The problem: avoiding catch-all inbox ingestion

When a customer verifies their domain for **sending**, that does not affect **receiving**. But the customer also wants inbound email to their ticketing inboxes — e.g., replies to `support@bikebakersfield.com` should create tickets.

The danger: accidentally routing ALL domain email into the SaaS (employee personal mail, HR, etc.).

### The solution: specific address forwarding (already in place) — COMPLETE

The current architecture already handles this correctly. Customers set up forwarding rules in their email provider (Google Workspace / M365):

```
support@bikebakersfield.com  →  forward to  →  {inboxcode}@inbound.groovi.support
buy@bakersfieldbike.com      →  forward to  →  {inboxcode}@inbound.groovi.support
```

**What this means:**
- MX records stay pointed at Google — all employee mail continues working normally
- Only the specific addresses with forwarding rules send mail to the SaaS
- No catch-all risk — `john@bikebakersfield.com` stays in Google, untouched
- The existing `emailRules` system routes inbound email to the correct inbox
- Resend's inbound webhook fires only for mail that Resend actually receives
- Auto-reply emails now pass `organizationId` + `projectId` to use custom domain sender

### The complete email loop (per inbox)

```
1. Customer replies to support@bikebakersfield.com
2. Google receives it (MX → Google)
3. Forwarding rule sends copy to {inboxcode}@inbound.groovi.support
4. Resend receives it, fires webhook → POST /webhooks/inbound-email
5. inboundEmailService.js matches email rule → routes to correct inbox
6. Agent replies in the app
7. App sends outbound via Resend FROM support@bikebakersfield.com (verified domain)
8. Customer sees reply from support@bikebakersfield.com — seamless threading
```


## Phase 3: Subdomain Routing

Each org accessible at `{slug}.groovi.support`. The app detects the subdomain, resolves the org, and loads their branding.

### Prerequisites

- [ ] Wildcard DNS: `*.groovi.support` → Railway server (A/CNAME record)
- [ ] Wildcard SSL cert: `*.groovi.support` (via Let's Encrypt, Cloudflare, or Railway)
- [x] Cookie domain `.groovi.support` already configured in `auth.js` — cookies work across subdomains today

### Backend

- [x] Add tenant detection middleware (`tenantDetection.js`):
  - Extract subdomain from `Host` header
  - Look up Organization by `slug` (already unique in schema)
  - Attach `req.tenantOrg` for downstream use
  - Skip for `app.groovi.support` (main app) and `api.groovi.support` (API)
  - Skip for requests that already use `X-Organization-Id` header
- [x] Update CORS to allow `*.groovi.support`:
  - Replace hardcoded `app.groovi.support` with dynamic origin validation
  - Check origin against `*.groovi.support` pattern
  - Keep localhost origins for development
- [x] Update `trustedOrigins` in `auth.js`:
  - Replace hardcoded domain list with dynamic `*.groovi.support` pattern check
  - Better Auth's `trustedOrigins` accepts a function — dynamically validates subdomain origins
- [x] Add `GET /api/tenant` — public endpoint, returns org info for current subdomain
  - Used by frontend on init to resolve which org to load
  - Returns: `{ organizationId, slug, appName, logo, primaryColor, favicon }`

### Frontend

- [x] On app init: detect subdomain from `window.location.hostname`
  - Extract slug from `{slug}.groovi.support`
  - Call `GET /api/tenant` to resolve org
  - Set `organizationId` in API client (already uses `X-Organization-Id` header)
- [x] Auto-select organization based on subdomain (skip org picker if subdomain is set)
- [x] Login page: brand with resolved org's logo/name/colors
- [x] Registration: associate new user with subdomain org (or disable public registration per org)
- [x] Update all URL generation (invite links, email links, public form links):
  - Use `{slug}.groovi.support` instead of `app.groovi.support`
  - Backend email templates resolve the correct frontend URL per org via `getFrontendUrl()`

### Super Admin — COMPLETE

- [x] Dashboard showing all orgs with their subdomain URLs (in AccountsTab)
- [x] Option to enable/disable subdomain per org (`subdomainEnabled` flag + inline toggle)
- [x] Tenant detection middleware respects `subdomainEnabled` flag

### Files Affected

| File | Change |
|------|--------|
| `backend/src/middleware/tenantDetection.js` | **New** — subdomain → org resolution |
| `backend/src/index.js` | Add middleware, update CORS to `*.groovi.support` |
| `backend/src/lib/auth.js` | Dynamic `trustedOrigins` function, invite URL per org |
| `backend/src/routes/tenant.js` | **New** — public tenant info endpoint |
| `backend/src/lib/email/client.js` | `getFrontendUrl(orgId)` — resolves `https://{slug}.groovi.support` |
| `backend/src/lib/email/index.js` | Re-export `getFrontendUrl` |
| `backend/src/lib/email/mailers/ticket.js` | Use `getFrontendUrl()` for all ticket URLs |
| `backend/src/lib/email/mailers/software.js` | Use `getFrontendUrl()` for all software URLs |
| `backend/src/routes/publicTicket.js` | Use `getFrontendUrl()` for magic link + portal URLs |
| `backend/src/routes/import.js` | Use `getFrontendUrl()` for callback URL |
| `frontend/src/lib/tenant.ts` | **New** — subdomain detection + tenant API |
| `frontend/src/context/TenantContext.tsx` | **New** — tenant context provider |
| `frontend/src/App.tsx` | Wrap with `TenantProvider`, tenant loading gate |
| `frontend/src/context/OrganizationContext.tsx` | Auto-select org from tenant |
| `frontend/src/pages/Login.tsx` | Tenant branding (logo + app name) |
| `frontend/src/pages/Register.tsx` | Tenant branding (logo + app name) |
| `frontend/src/pages/Onboarding.tsx` | Skip to "join" on subdomain |
| `frontend/src/components/Layout.tsx` | Hide org switcher on subdomain |
| `backend/prisma/schema.prisma` | Add `subdomainEnabled` field to Organization |
| `backend/src/routes/superAdmin/accounts.js` | Return + accept `subdomainEnabled` |
| `frontend/src/api/superAdmin.ts` | Add `subdomainEnabled` to types + API |
| `frontend/src/pages/admin/super-admin/AccountsTab.tsx` | Subdomain column + inline toggle |

---

## Cross-Cutting Concerns

### Auth Emails (All Phases)

Auth emails (verification, password reset, magic link) are triggered from Better Auth hooks with no org context. These always use the global `FROM_EMAIL`. This is acceptable because:
- Users authenticate against the platform, not a whitelabel instance
- The auth email domain doesn't need to match the org's domain
- Better Auth controls the email sending pipeline — injecting per-org context would require hook customization

### Reply-To Threading with Custom Domains (Phase 2)

When outbound emails use a customer's verified domain (e.g., `support@bikebakersfield.com`), replies go directly to that address. The customer's forwarding rule catches it and routes it back to the SaaS. This creates a seamless loop:

- Customer sees `From: support@bikebakersfield.com` — it's their brand
- Customer replies to that address — it's natural
- Forwarding rule catches the reply — it reaches the SaaS
- Email threading headers (`In-Reply-To`, `References`) maintain the conversation

The `Message-ID` header should use the customer's domain (not `groovi.support`) so threading works correctly across email clients. This is why `generateMessageId()` needs the domain parameter.

### Shared Sending Reputation

All orgs send through the same Resend account, which means shared IP reputation. Mitigations:
- Resend handles IP warming and reputation management
- Domain-level DKIM provides per-domain reputation isolation
- Monitor bounce/complaint rates per org — suspend sending for abusers
- Future: dedicated IPs or per-org Resend sub-accounts if needed

---

## Implementation Order

```
Phase 1 (Branding)        ████████████████████████████████  COMPLETE
Phase 2 (Email Domains)   ████████████████████████████████  COMPLETE
Phase 3 (Subdomain)       ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
```

Phase 2 first because:
- It's the highest-value whitelabel feature — "why does the email say groovi.support?" is the first thing customers notice
- It's more complex (Resend API integration, DNS record UI), better to tackle while architecture is fresh
- Phase 3 is largely infrastructure config + one middleware — a quicker win to finish with

---

## Verification Checklist

### Phase 1 — COMPLETE
- [x] Create org with custom branding (name, logo, color)
- [x] Confirm email notifications use org name + color
- [x] Confirm branding admin page works (upload, color picker, preview)

### Phase 2 — Code Complete (needs live verification)
- [ ] Add a domain via admin UI → see DNS records displayed
- [ ] Verify domain → confirm status updates from Pending → Verified
- [ ] Configure inbox sender identity (fromUser, fromName, domain)
- [ ] Send ticket notification → `From:` uses inbox's custom domain
- [ ] Set org default domain → inboxes without override inherit it
- [ ] Remove domain → confirm fallback to global `FROM_EMAIL`
- [ ] Send reply → `Message-ID` uses custom domain
- [ ] Customer replies → forwarding routes to SaaS → threading works
- [ ] Auto-reply uses custom domain (not global `FROM_EMAIL`)
- [ ] SPF merge instructions are clearly displayed in UI

### Phase 3
- [ ] Wildcard DNS + SSL configured
- [ ] Super Admin: toggle subdomain on for an org → subdomain URL becomes active
- [ ] Super Admin: toggle subdomain off → subdomain falls through to main app
- [ ] Access `acme.groovi.support` → see Acme branding on login page
- [ ] Access `other.groovi.support` → see different branding
- [ ] Login on subdomain → session works, correct org loaded
- [ ] Email links in notifications point to correct subdomain URL
- [ ] Invite links use the org's subdomain
- [ ] Public ticket form works on org subdomain
