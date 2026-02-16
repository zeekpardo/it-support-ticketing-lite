# Data Model Restructuring: Contact/Organization/Team Architecture

> **Status:** Phase 0 Complete
> **Last Updated:** 2026-02-15
>
> **Tracking Instructions:** Update this document as you complete each phase. Before moving to the next phase, check off all items in the current phase, record any notes/deviations in the "Progress Log" at the bottom, and update the **Status** field above to reflect the current phase (e.g., "Phase 1 In Progress", "Phase 2 Complete"). This document is the source of truth for where this project stands.

---

## Context

The app currently uses a flat "Member-as-client" model where client users are `Member` records with `role='client'`. Contact info (name, email, phone) is stored directly on `SupportTicket`. There's no concept of "client organizations" or standalone contacts.

The goal is to introduce a proper CRM-style hierarchy:

```
Organization (Better Auth tenant) → ClientOrganization (client companies) → Contact (people) → Tickets
```

Plus Teams for agent grouping and polymorphic inbox access.

### Naming Convention (Better Auth constraint)

Better Auth owns `Organization`, `Member`, and `Account` model names in Prisma. We keep those as-is:

| Business Concept | Prisma Model | DB Table |
|---|---|---|
| Tenant (SaaS account) | `Organization` | `organizations` (BA) |
| Agent/admin membership | `Member` | `members` (BA) |
| OAuth credentials | `Account` | `accounts` (BA) |
| Client company | `ClientOrganization` | `client_organizations` (NEW) |
| Client domain | `ClientDomain` | `client_domains` (NEW) |
| Contact person | `Contact` | `contacts` (NEW) |
| Agent team | `Team` | `teams` (NEW) |
| Team membership | `TeamMembership` | `team_memberships` (NEW) |
| Inbox access | `InboxMembership` | `inbox_memberships` (NEW, replaces `InboxAssignment`) |

In the **UI**, we display "Organization" for `ClientOrganization` and treat the tenant as "Account."

---

## Phase 0: Complete Project → Inbox Rename

Finish the in-progress rename before building on this foundation.

- [x] Clean up `backend/src/services/ticketFromEmailFactory.js` — renamed `project` → `inbox` throughout, fixed `projectId` → `inboxId` (bug fix: `storeEmailParticipants` was receiving wrong key)
- [x] Clean up `backend/src/services/emailRuleMatcher.js` — renamed `project:` → `inbox:` in Prisma include
- [x] Search and fix any remaining `project` references in `backend/src/` services/utils
  - Updated `superAdmin/accounts.js` — `projects` → `inboxes` in `_count`, `projectAssignments` → `inboxAssignments`
  - Updated `superAdmin/users.js` — `projectAssignments` → `inboxAssignments`, `projectCode` → `inboxCode`
  - Updated `superAdmin/software.js` — `projectSoftware` → `inboxSoftware`, updated error message
  - Updated `portal.js` — `project:` → `inbox:` in ticket include
  - Updated `lib/auth.js` — `project:` → `inbox:` in RBAC statement and role definitions
  - Updated `middleware/auth.js` — `project:` → `inbox:` in all permission strings
- [x] Delete stale files: `projects.js`, `memberProjects.js`, `project-software.js`, `project-software/` directory (7 files, -1,637 lines)
- [x] Removed `CONVERSION_GUIDE.md` (rename complete, no longer needed)
- [x] **Milestone:** Phase 0 complete — commit `30b6102`

---

## Phase 1: Schema — Add New Models (Additive, Non-Breaking)

All changes are additive. Existing functionality stays untouched. File: `backend/prisma/schema.prisma`

### New models

- [ ] **ClientOrganization** — A client company inside a tenant
  - Fields: `name`, `slug`, `website`, `industry`, `notes`, `isActive`
  - Relations: `belongs_to Organization`, `has_many Contact`, `has_many ClientDomain`, `has_many SupportTicket`
  - Unique: `[organizationId, slug]`

- [ ] **ClientDomain** — Domain → org mapping for routing
  - Fields: `domain`, `isVerified`
  - Relations: `belongs_to ClientOrganization`
  - Unique: `[clientOrganizationId, domain]`, indexed on `domain`

- [ ] **Contact** — Person at a client company
  - Fields: `firstName`, `lastName`, `email`, `phone`, `title`, `notes`, `isActive`
  - Relations: `belongs_to Organization` (denormalized), `belongs_to ClientOrganization` (optional), `belongs_to User` (optional — only if they have portal access)
  - `has_many SupportTicket` (as requester), `has_many TicketComment`, `has_many TicketEmailParticipant`
  - Unique: `[organizationId, email]`

- [ ] **Team** — Group of agents
  - Fields: `name`, `description`
  - Relations: `belongs_to Organization`, `has_many TeamMembership`, `has_many InboxMembership`

- [ ] **TeamMembership** — Links members to teams
  - Relations: `belongs_to Team`, `belongs_to Member`
  - Unique: `[teamId, memberId]`

- [ ] **InboxMembership** — Polymorphic inbox access (replaces `InboxAssignment`)
  - Fields: `memberType` (enum: `USER` or `TEAM`), `memberId` (Member ID), `teamId` (Team ID) — one of the two is set
  - Relations: `belongs_to Inbox`, `belongs_to Member` (optional), `belongs_to Team` (optional)
  - Note: Not truly polymorphic via Prisma (no polymorphic FK support) — use two optional FKs with a check constraint

### Modifications to existing models

- [ ] **SupportTicket** — Add new optional FKs alongside existing ones:
  - `contactId` → `Contact` (optional during transition, required in Phase 7)
  - `clientOrganizationId` → `ClientOrganization` (optional)
  - Keep existing `clientId` → `Member` (for backward compatibility during transition)

- [ ] **TicketComment** — Add optional contact author:
  - `contactId` → `Contact` (for comments authored by contacts)

- [ ] **TicketEmailParticipant** — Add contact link:
  - `contactId` → `Contact`

- [ ] **Organization** — Add relations:
  - `has_many ClientOrganization`, `has_many Contact`, `has_many Team`

- [ ] **User** — Add relation:
  - `has_many Contact` (a user can be linked from multiple tenant contacts)

### Run migration

- [ ] Run `npx prisma db push` (or `prisma migrate dev --name add-contact-org-team`)
- [ ] Verify all new tables created without errors
- [ ] **Milestone: update this doc** — mark Phase 1 complete, note any schema deviations in Progress Log

---

## Phase 2: Backend — CRUD Routes for New Models

### New route files

- [ ] **`backend/src/routes/clientOrganizations.js`** (NEW)
  - `GET /api/client-organizations` — List all (requireStaff), with contact count
  - `POST /api/client-organizations` — Create (requireAdmin)
  - `GET /api/client-organizations/:id` — Detail with contacts + domains (requireStaff)
  - `PUT /api/client-organizations/:id` — Update (requireAdmin)
  - `DELETE /api/client-organizations/:id` — Delete (requireAdmin)
  - `POST /api/client-organizations/:id/domains` — Add domain
  - `DELETE /api/client-organizations/:id/domains/:domainId` — Remove domain

- [ ] **`backend/src/routes/contacts.js`** (NEW)
  - `GET /api/contacts` — List, filterable by `clientOrganizationId` (requireStaff)
  - `POST /api/contacts` — Create (requireStaff)
  - `GET /api/contacts/:id` — Detail with tickets, org (requireStaff)
  - `PUT /api/contacts/:id` — Update (requireStaff)
  - `DELETE /api/contacts/:id` — Soft-delete via `isActive=false` (requireAdmin)
  - `GET /api/contacts/search?q=` — Typeahead search by name/email

- [ ] **`backend/src/routes/teams.js`** (NEW)
  - `GET /api/teams` — List teams (requireStaff)
  - `POST /api/teams` — Create (requireAdmin)
  - `GET /api/teams/:id` — Detail with members (requireStaff)
  - `PUT /api/teams/:id` — Update (requireAdmin)
  - `DELETE /api/teams/:id` — Delete (requireAdmin)
  - `POST /api/teams/:id/members` — Add member to team
  - `DELETE /api/teams/:id/members/:memberId` — Remove member from team

- [ ] **`backend/src/routes/inboxMemberships.js`** (NEW, replaces memberInboxes.js)
  - `GET /api/inboxes/:inboxId/memberships` — List inbox members + teams
  - `POST /api/inboxes/:inboxId/memberships` — Add member or team to inbox
  - `DELETE /api/inboxes/:inboxId/memberships/:id` — Remove access

### Updates to existing files

- [ ] **`backend/src/utils/entityHelpers.js`:**
  - Add `findContactOrFail(contactId, organizationId)`
  - Add `findClientOrganizationOrFail(clientOrgId, organizationId)`
  - Add `findOrCreateContact(email, firstName, lastName, organizationId)` — replaces `findOrCreateClient`
  - Update `hasInboxAccess()` to check both direct member access AND team-based access via `InboxMembership`
  - Update `getAssignedInboxIds()` to include team-based assignments

- [ ] **`backend/src/utils/prismaFragments.js`:**
  - Add `CONTACT_SELECT_BRIEF` (id, firstName, lastName, email)
  - Add `CONTACT_WITH_ORG` (id, firstName, lastName, email, clientOrganization: { id, name })
  - Add `CLIENT_ORG_SELECT_BRIEF` (id, name)
  - Add `TEAM_SELECT_BRIEF` (id, name)

- [ ] **`backend/src/index.js`** — Mount new routes

- [ ] Test all CRUD endpoints via REST client
- [ ] **Milestone: update this doc** — mark Phase 2 complete in Progress Log

---

## Phase 3: Data Migration Script

One-time script: `backend/scripts/migrateClientsToContacts.js`

- [ ] **Write migration script** with the following steps:
  1. Find all `Member` records where `role = 'client'`
  2. For each, look up `User` to get email, name
  3. Create `Contact` with `organizationId`, `firstName`/`lastName` (parsed from `user.name`), `email`, `userId` (for portal link)
  4. Update `SupportTicket` records: set `contactId` where `clientId = member.id`
  5. Update `TicketEmailParticipant` records: set `contactId` where `memberId = member.id`
  6. Auto-create `ClientOrganization` from email domains (group contacts by domain)
  7. Create `ClientDomain` records linking domains to orgs
  8. Log results

- [ ] **Migrate `InboxAssignment` → `InboxMembership` records**

- [ ] Run against staging data
- [ ] Verify contact count matches client count
- [ ] Verify ticket `contactId` fields populated correctly
- [ ] Verify `ClientOrganization` and `ClientDomain` records created
- [ ] Verify `InboxMembership` records migrated from `InboxAssignment`
- [ ] **Milestone: update this doc** — mark Phase 3 complete, record migration stats in Progress Log

---

## Phase 4: Update Ticket System to Use Contact

### Ticket creation (staff-side)

- [ ] **`backend/src/routes/tickets/crud.js`** — Update POST:
  - Accept `contactId` instead of (or alongside) `clientId`
  - Validate contact belongs to org
  - Populate `firstName/lastName/email/phone` from Contact (keep on ticket for audit)
  - Set `clientOrganizationId` from contact's org
  - Transition: support both `clientId` and `contactId` parameters

### Email-to-ticket flow

- [ ] **`backend/src/services/emailParticipantManager.js`:**
  - `findOrCreateClient()` → `findOrCreateContact()`: search `Contact` by email + organizationId; if not found, create `Contact` (no User/Member needed for email-only contacts); auto-assign `clientOrganizationId` via `ClientDomain` lookup
  - `storeEmailParticipants()` sets `contactId` instead of `memberId`

- [ ] **`backend/src/services/ticketFromEmailFactory.js`:**
  - Use `findOrCreateContact()` instead of `findOrCreateClient()`
  - Set `contactId` on ticket

### Ticket queries

- [ ] **`backend/src/routes/tickets/crud.js`** — Update queries:
  - All `include` queries: add `contact: { select: CONTACT_WITH_ORG }`
  - API returns both `client` and `contact` during transition

### Portal routes

- [ ] **`backend/src/routes/portal/tickets.js`:**
  - Add `resolveContact` middleware: finds Contact where `userId = req.user.id` and `organizationId = req.organization.id`
  - Filter tickets by `contactId` (resolved from authenticated user)
  - Portal ticket creation sets `contactId`

- [ ] **`backend/src/routes/clientSignup.js`:**
  - After creating `User` + `Member`, also create `Contact` linked to both

- [ ] **`backend/src/routes/import.js`:**
  - Import creates `Contact` records alongside User/Member

### Verify

- [ ] Test email-to-ticket flow end-to-end
- [ ] Test portal ticket access with contactId
- [ ] **Milestone: update this doc** — mark Phase 4 complete in Progress Log

---

## Phase 5: Frontend Updates

### New API layer files

- [ ] **`frontend/src/api/clientOrganizations.ts`** (NEW) — CRUD functions for client organizations + domains
- [ ] **`frontend/src/api/contacts.ts`** (NEW) — CRUD + search functions for contacts
- [ ] **`frontend/src/api/teams.ts`** (NEW) — CRUD + membership functions for teams
- [ ] **`frontend/src/api/types.ts`** — Add `ClientOrganization`, `ClientDomain`, `Contact`, `Team`, `TeamMembership`, `InboxMembership` interfaces

### New admin pages

- [ ] `admin/ClientOrganizations.tsx` — List client orgs with contact count
- [ ] `admin/ClientOrganizationDetail.tsx` — View org, domains, contacts
- [ ] `admin/Contacts.tsx` — List contacts, filter by org
- [ ] `admin/ContactDetail.tsx` — View/edit contact, see their tickets
- [ ] `admin/Teams.tsx` — List teams, manage members
- [ ] `admin/TeamDetail.tsx` — View team, add/remove members, see inbox access

### Updated pages

- [ ] **`frontend/src/components/dashboard/NewTicketDialog.tsx`** — Replace "Client" dropdown with Contact typeahead search
- [ ] **`frontend/src/components/tickets/TicketForm.tsx`** — Auto-populate fields from selected Contact
- [ ] **`frontend/src/pages/TicketDetail.tsx`** — Display contact info with link to contact detail
- [ ] **`frontend/src/pages/Dashboard.tsx`** — Update filters to use Contact/ClientOrganization
- [ ] **`frontend/src/components/Layout.tsx`** — Add "Organizations", "Contacts", "Teams" nav items under admin

### Routing

- [ ] **`frontend/src/App.tsx`** — Add routes:
  - `/admin/organizations`, `/admin/organizations/:id`
  - `/admin/contacts`, `/admin/contacts/:id`
  - `/admin/teams`, `/admin/teams/:id`

- [ ] **Milestone: update this doc** — mark Phase 5 complete in Progress Log

---

## Phase 6: Domain-Based Email Routing Enhancement

- [ ] **`backend/src/services/emailParticipantManager.js`:**
  - In `findOrCreateContact()`, extract domain from email
  - Look up `ClientDomain` for the organization
  - If found, auto-assign `clientOrganizationId` to the contact

- [ ] **`backend/src/services/emailRuleMatcher.js`:**
  - After matching inbox, also return matched `clientOrganizationId` via domain lookup
  - MVP routing: `clientDomain.defaultInboxId` → `clientOrg.defaultInboxId` → fallback to existing EmailRule

- [ ] Test inbound email auto-assigns Contact to ClientOrganization via domain
- [ ] **Milestone: update this doc** — mark Phase 6 complete in Progress Log

---

## Phase 7: Cleanup

- [ ] Make `SupportTicket.contactId` required, `clientId` optional
- [ ] Remove `TicketEmailParticipant.memberId` (replaced by `contactId`)
- [ ] Remove client endpoints from `backend/src/routes/members.js`: `GET /clients`, `GET /clients/:id`, `PATCH /clients/:id`
- [ ] Remove `InboxAssignment` model (replaced by `InboxMembership`)
- [ ] Remove `getClients()`, `getClientDetail()` from `frontend/src/api/members.ts`
- [ ] Update `frontend/src/hooks/useDashboardFilters.ts` to filter by Contact/ClientOrg
- [ ] Retire `frontend/src/pages/admin/ClientDetail.tsx` (replaced by ContactDetail)
- [ ] Run full migration, verify no broken references
- [ ] **Milestone: update this doc** — mark Phase 7 complete, project done

---

## Final Verification

End-to-end checks after all phases:

- [ ] **Schema**: All new tables exist, constraints valid
- [ ] **Migration**: Contact count matches former client count
- [ ] **Backend routes**: CRUD works for client-organizations, contacts, teams
- [ ] **Email flow**: Inbound email creates Contact (not Member), auto-assigns to ClientOrganization via domain
- [ ] **Portal**: Client login scoped by contactId works correctly
- [ ] **Frontend**: Ticket creation with Contact typeahead works, detail shows contact + org
- [ ] **Teams**: Create team, add members, assign to inbox, verify team-based access works

---

## Progress Log

Record milestone completions, deviations, and decisions here as each phase is finished.

| Date | Phase | Notes |
|---|---|---|
| 2026-02-15 | Phase 0 | Complete. Deleted 7 stale project route files (-1,637 lines). Renamed all `project` references to `inbox` across services, super admin routes, portal, auth RBAC. Fixed bug where `ticketFromEmailFactory` passed `projectId` but `storeEmailParticipants` expected `inboxId`, causing inbox assignments to silently fail for TO/CC email participants. Removed `CONVERSION_GUIDE.md`. Commit: `30b6102`. |
