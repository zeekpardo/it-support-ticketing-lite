# Public Embeddable Ticket Form — Implementation Plan

## Overview

A public (unauthenticated) ticket submission form that can be embedded on external websites via iframe, scoped per inbox using the existing `clientSignupToken`. On submission, the system creates a passwordless user account, creates the ticket, and sends a single confirmation email with ticket details + a magic link to the client portal. Email domain restrictions ensure only authorized company domains can submit.

## Progress Tracking

> **Instructions:** Check off each item (`- [x]`) immediately after completing it.
> Do NOT wait until the end to update — mark items complete as you go.
> Each phase should be fully complete (including testing the changes work) before moving to the next.

---

## Phase 1: Database Migration

- [x] Add `allowedEmailDomains String[] @default([]) @map("allowed_email_domains")` to `Inbox` model in `backend/prisma/schema.prisma` (after `clientSignupEnabled` field, line ~220)
- [x] Run `prisma db push` (used db push instead of migrate dev due to Better Auth shadow DB incompatibility; requires `NODE_OPTIONS="--experimental-require-module"` for Prisma 7 + Node 22)
- [x] Verify migration succeeded and column exists (`allowed_email_domains text[] DEFAULT ARRAY[]::text[]`)

**Key files:**
- `backend/prisma/schema.prisma`

---

## Phase 2: Backend — Inbox CRUD Support for `allowedEmailDomains`

- [x] Add `'allowedEmailDomains'` to `INBOX_UPDATE_FIELDS` array in `backend/src/routes/inboxes.js` (line 28-32)
- [x] Accept `allowedEmailDomains` in the POST `/` create handler (line 112-148) and pass through to `prisma.inbox.create`
- [x] Add `validateEmailDomains(domains)` function to `backend/src/utils/inboxValidation.js` — validates each entry looks like a domain (contains dot, no `@`, no spaces), normalizes to lowercase, returns cleaned array
- [x] Call `validateEmailDomains` in both create and update handlers when `allowedEmailDomains` is provided

**Key files:**
- `backend/src/routes/inboxes.js`
- `backend/src/utils/inboxValidation.js`

**Reuses:** `pickDefined()` from `inboxValidation.js` already handles the update path — just needs the field name in the list.

---

## Phase 3: Frontend — Inbox Settings UI (Domain Restriction)

### Form Hook + API Client

- [x] Add `allowedEmailDomains: string[]` to `InboxFormData` and `Inbox` interfaces in `frontend/src/hooks/useInboxForm.ts`
- [x] Add `allowedEmailDomains: []` to `INITIAL_FORM`
- [x] Handle in `populateFromInbox`: `allowedEmailDomains: data.allowedEmailDomains || []`
- [x] Include in `handleSubmit` payload: `allowedEmailDomains: form.allowedEmailDomains`
- [x] Add `allowedEmailDomains?: string[]` to `createInbox` and `updateInbox` type signatures in `frontend/src/api/inboxes.ts`
- [x] Pass `allowedEmailDomains` through in `InboxNew.tsx` create call (add to initial data as `[]`)

### General Tab UI

- [x] Add domain chip input section to `frontend/src/components/inbox/InboxGeneralTab.tsx` after the Active toggle
  - Text input + "Add" button
  - Each domain renders as a `Badge` (from `ui/badge.tsx`) with an `x` remove button
  - Auto-strip leading `@` from input
  - Validate domain format before adding (contains `.`, no spaces)
  - Helper text: "Only emails from these domains can submit tickets via the public form. Leave empty to allow any domain."
- [ ] Verify: edit an inbox, add domains, save, reload — domains persist

**Key files:**
- `frontend/src/hooks/useInboxForm.ts`
- `frontend/src/api/inboxes.ts`
- `frontend/src/components/inbox/InboxGeneralTab.tsx`
- `frontend/src/pages/admin/InboxNew.tsx`

**Reuses:** `Badge` from `ui/badge.tsx`, `Field/Label/Description` from `ui/fieldset`, existing `setField` pattern.

---

## Phase 4: Backend — Magic Link Context Bridge + Confirmation Email

### Context Bridge (in auth mailers)

- [x] Add `pendingTicketEmails` Map, `markPublicTicketEmail(email, context)`, and `consumePublicTicketContext(email)` to `backend/src/lib/email/mailers/auth.js` — follows the exact `pendingWelcomeEmails` pattern already in this file
- [x] Update `sendMagicLink` callback in `backend/src/lib/auth.js` to check for ticket context:
  ```js
  const ticketCtx = consumePublicTicketContext(email);
  if (ticketCtx) {
    void sendPublicTicketConfirmationEmail({ ...ticketCtx, magicLinkUrl: url });
  } else {
    void sendMagicLinkEmail({ email, url });
  }
  ```
- [x] Export new functions from `backend/src/lib/email/index.js`

### Confirmation Email

- [x] Add `sendPublicTicketConfirmationEmail()` to `backend/src/lib/email/mailers/ticket.js`
  - Params: `{ to, recipientName, inboxName, ticketSubject, description, ticketId, magicLinkUrl, branding }`
  - Subject: `Request received: {ticketSubject}`
  - Body: greeting, "your request has been submitted" paragraph, quote block with truncated description, "View Your Ticket" button pointing to `magicLinkUrl`
  - Footer note: "This link expires in 5 minutes. You can request a new sign-in link from the login page."
  - Uses `buildThreadingChain()` + `storeOutboundEmail()` for email thread continuity
- [x] Export from `backend/src/lib/email/index.js`

**Key files:**
- `backend/src/lib/email/mailers/auth.js`
- `backend/src/lib/auth.js`
- `backend/src/lib/email/mailers/ticket.js`
- `backend/src/lib/email/index.js`

**Reuses:** `pendingWelcomeEmails` pattern (context bridge), `buildHtmlEmail`/`buildTextEmail`/`quoteBlock` from `templates.js`, `truncateDescription` from `mailers/ticket.js`, `buildThreadingChain`/`storeOutboundEmail` from `threading.js`.

---

## Phase 5: Backend — Public Ticket Submission Endpoint

- [x] Create `backend/src/routes/publicTicket.js` — public, token-gated (no auth middleware), follows `clientSignup.js` pattern

### GET `/:token` — Form config + branding

- [x] Implement: find inbox by `clientSignupToken`, check `clientSignupEnabled` + `isActive`
- [x] Return: `{ inboxId, inboxName, allowedEmailDomains, branding: { appName, primaryColor, logoUrl } }`

### POST `/:token` — Submit ticket

- [x] Validate token → find inbox
- [x] Validate email domain against `inbox.allowedEmailDomains` (if non-empty). Return 400 if mismatch.
- [x] Validate required fields: firstName, lastName, email, subject, description
- [x] Find-or-create user (reuse `clientSignup.js` logic):
  - Existing user + existing client member → add inbox assignment if missing
  - Existing user + not in org → create client member + inbox assignment
  - New user → create user (no password, `emailVerified: true`), client member, inbox assignment
- [x] Create ticket (reuse `portal/tickets.js` logic):
  - Fetch default stage for inbox
  - Calculate due date from MEDIUM priority + inbox settings
  - Set `ownerId` to `inbox.defaultAssigneeId`
  - Set `priorityLevel: 'MEDIUM'`
- [x] Send combined email: call `markPublicTicketEmail()` then `auth.api.signInMagicLink()` with `callbackURL: '/portal/tickets/{ticketId}'`
- [x] Notify staff: call `createNotification()` with `NEW_TICKET_ASSIGNED` for default assignee
- [x] Return `201` with `{ success: true, ticketId }`

### Mount + CSP

- [x] Mount in `backend/src/index.js`: `app.use('/api/public/submit', publicTicketRoutes)` (after `express.json()`, no auth middleware)
- [x] Add CSP override for `/api/public/submit` route to allow iframe embedding (override helmet's `frameAncestors: ["'none'"]`)

**Key files:**
- `backend/src/routes/publicTicket.js` (new)
- `backend/src/index.js`

**Reuses:** `findInboxByToken` pattern from `clientSignup.js`, user find-or-create from `clientSignup.js`/`import.js`, ticket creation from `portal/tickets.js`, `createNotification` from `notificationService.js`, `auth.api.signInMagicLink` from `import.js`.

---

## Phase 6: Frontend — Public Ticket Form Page

### API Functions

- [x] Add `getPublicFormInfo(token)` to `frontend/src/api/inboxes.ts` — `publicRequest` GET to `/public/submit/:token`
- [x] Add `submitPublicTicket(token, data)` to `frontend/src/api/inboxes.ts` — `publicRequest` POST to `/public/submit/:token`

### Form Page

- [x] Create `frontend/src/pages/PublicTicketForm.tsx` — follows `ClientSignup.tsx` pattern (standalone public page)
  - States: `loading` → `invalid` | `ready` → `submitted`
  - **Loading:** Fetches config via `getPublicFormInfo(token)`
  - **Invalid:** "This form is no longer available" message
  - **Ready:** Shows org branding (logo, app name), renders `TicketForm` with:
    - `showContactFields={true}`
    - `showPriority={false}`
    - `showAttachments={false}`
    - `preselectedInboxId` set from GET response
    - `inboxes` = `[{ id, name, inboxCode }]` from GET response
    - Email validation: if `allowedEmailDomains` non-empty, validate domain client-side in `onSubmit` wrapper before calling API
    - `onSuccess` → transition to submitted state
  - **Submitted:** "Your request has been submitted! Check your email for a link to track your ticket."
  - Detect `?embed=true` query param → minimal padding, no extra chrome

### Route

- [x] Add public route in `frontend/src/App.tsx`: `<Route path="/submit/:token" element={<PublicTicketForm />} />` (alongside `/join/:token`, no ProtectedRoute wrapper)

**Key files:**
- `frontend/src/api/inboxes.ts`
- `frontend/src/pages/PublicTicketForm.tsx` (new)
- `frontend/src/App.tsx`

**Reuses:** `TicketForm` component (renders all form fields), `publicRequest` from `api/base.ts`, `ClientSignup.tsx` as structural pattern.

---

## Phase 7: End-to-End Verification

- [ ] **Inbox settings:** Edit inbox, add allowed domains, save, reload — domains persist
- [ ] **Public form (happy path):** Generate signup link for inbox (provides token), visit `/submit/{token}`, fill form with allowed email, submit
- [ ] **Ticket created:** Verify ticket appears in inbox admin UI with correct data
- [ ] **Confirmation email:** Verify email received with ticket subject, description, and magic link button
- [ ] **Magic link:** Click button → signs into portal → lands on `/portal/tickets/{ticketId}`
- [ ] **Domain restriction:** Submit with disallowed domain → inline error on form + 400 from API
- [ ] **Staff notification:** Verify default assignee receives NEW_TICKET_ASSIGNED notification
- [ ] **Returning user:** Submit again with same email → ticket links to existing user, no duplicate account
- [ ] **Embed mode:** Visit `/submit/{token}?embed=true` → minimal chrome, no header
- [ ] **No allowed domains:** If no domains configured on inbox, any email is accepted

---

## Files Summary

| File | Action | Description |
|------|--------|-------------|
| `backend/prisma/schema.prisma` | Edit | Add `allowedEmailDomains` field |
| `backend/src/routes/inboxes.js` | Edit | Add to update fields + create handler |
| `backend/src/utils/inboxValidation.js` | Edit | Add `validateEmailDomains()` |
| `backend/src/routes/publicTicket.js` | **New** | Public GET + POST endpoints |
| `backend/src/index.js` | Edit | Mount public route + CSP override |
| `backend/src/lib/auth.js` | Edit | Update `sendMagicLink` callback |
| `backend/src/lib/email/mailers/auth.js` | Edit | Add ticket context bridge |
| `backend/src/lib/email/mailers/ticket.js` | Edit | Add `sendPublicTicketConfirmationEmail()` |
| `backend/src/lib/email/index.js` | Edit | Export new functions |
| `frontend/src/hooks/useInboxForm.ts` | Edit | Add `allowedEmailDomains` to form state |
| `frontend/src/api/inboxes.ts` | Edit | Add types + public form API functions |
| `frontend/src/components/inbox/InboxGeneralTab.tsx` | Edit | Domain chip input UI |
| `frontend/src/pages/admin/InboxNew.tsx` | Edit | Pass `allowedEmailDomains` |
| `frontend/src/pages/PublicTicketForm.tsx` | **New** | Public form page |
| `frontend/src/App.tsx` | Edit | Add `/submit/:token` route |

## Key Reuse Points

- `findInboxByToken()` pattern → `clientSignup.js`
- `TicketForm` component → renders all form fields with conditional sections
- `buildHtmlEmail()`/`buildTextEmail()`/`quoteBlock()` → `templates.js`
- `buildThreadingChain()`/`storeOutboundEmail()` → `threading.js`
- `truncateDescription()` → `mailers/ticket.js`
- `createNotification()` → `notificationService.js`
- `publicRequest()` → `api/base.ts`
- `Badge` component → `ui/badge.tsx`
- `pickDefined()` → `inboxValidation.js`
- Context bridge pattern → `pendingWelcomeEmails` in `mailers/auth.js`
- User find-or-create → `clientSignup.js` / `import.js`
- `auth.api.signInMagicLink()` → `import.js`
