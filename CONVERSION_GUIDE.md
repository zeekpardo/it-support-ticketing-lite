# Project → Inbox Conversion Guide

## Phase 1: Prisma Schema
**File:** `backend/prisma/schema.prisma`

### Model Renames
| Current Model | New Model | DB map (unchanged) |
|---|---|---|
| `Project` | `Inbox` | `@@map("projects")` |
| `ProjectAssignment` | `InboxAssignment` | `@@map("project_assignments")` |
| `InvitationProject` | `InvitationInbox` | `@@map("invitation_projects")` |
| `ProjectSoftware` | `InboxSoftware` | `@@map("project_software")` |
| `ProjectSoftwareAdmin` | `InboxSoftwareAdmin` | `@@map("project_software_admins")` |

### Field Renames (keep @map unchanged)
- `projectCode` → `inboxCode` (keeps `@map("project_code")`)
- `projectId` → `inboxId` (keeps `@map("project_id")`) across all models
- Relation fields: `projects` → `inboxes`, `projectAssignments` → `inboxAssignments`, `invitationProjects` → `invitationInboxes`, `projectSoftware` → `inboxSoftware`
- Relation names: `"ProjectDefaultAssignee"` → `"InboxDefaultAssignee"`, `"ProjectSoftwareAddedBy"` → `"InboxSoftwareAddedBy"`

After schema changes, run `npx prisma generate` (no db push needed).

- [ ] Rename models
- [ ] Rename fields and relations
- [ ] Run `npx prisma generate`

---

## Phase 2: Backend Files

### 2a. Rename Files
| Current | New |
|---|---|
| `routes/projects.js` | `routes/inboxes.js` |
| `routes/memberProjects.js` | `routes/memberInboxes.js` |
| `routes/project-software.js` | `routes/inbox-software.js` |
| `routes/project-software/` dir | `routes/inbox-software/` dir |
| `utils/projectValidation.js` | `utils/inboxValidation.js` |

- [ ] Rename route files
- [ ] Rename utility files

### 2b. Update `index.js` — imports and route paths
```js
import inboxesRoutes from './routes/inboxes.js'
import memberInboxesRoutes from './routes/memberInboxes.js'
import inboxSoftwareRoutes from './routes/inbox-software.js'

app.use('/api/inboxes', inboxesRoutes)
app.use('/api/inboxes', ticketStagesRoutes)
app.use('/api/members', memberInboxesRoutes)
app.use('/api/software', inboxSoftwareRoutes)
```

- [ ] Update imports
- [ ] Update route mounts

### 2c. Route Files — update param names and Prisma queries
Every file: `req.params.projectId` → `req.params.inboxId`, `prisma.project.` → `prisma.inbox.`, `prisma.projectAssignment.` → `prisma.inboxAssignment.`, etc.

| File | Changes |
|---|---|
| `routes/inboxes.js` | route params, Prisma calls, variable names |
| `routes/memberInboxes.js` | same |
| `routes/ticketStages.js` | `:projectId` → `:inboxId` in route paths + params |
| `routes/inbox-software/crud.js` | `/projects/:projectId` → `/inboxes/:inboxId` |
| `routes/inbox-software/admins.js` | same |
| `routes/inbox-software/access-requests.js` | same |
| `routes/inbox-software/catalog.js` | variable names only |
| `routes/email-rules.js` | projectId references in queries |
| `routes/tickets/crud.js` | projectId field references |
| `routes/timeEntries.js` | projectId field references |
| `routes/clientSignup.js` | Project references |
| `routes/portal/tickets.js` | ProjectAssignment references |
| `routes/portal-software.js` | `/projects/:projectId` → `/inboxes/:inboxId` |
| `routes/import.js` | project assignment references |
| `routes/reports.js` | project grouping references |
| `routes/members.js` | project assignment references |

- [ ] `routes/inboxes.js`
- [ ] `routes/memberInboxes.js`
- [ ] `routes/ticketStages.js`
- [ ] `routes/inbox-software/crud.js`
- [ ] `routes/inbox-software/admins.js`
- [ ] `routes/inbox-software/access-requests.js`
- [ ] `routes/inbox-software/catalog.js`
- [ ] `routes/email-rules.js`
- [ ] `routes/tickets/crud.js`
- [ ] `routes/timeEntries.js`
- [ ] `routes/clientSignup.js`
- [ ] `routes/portal/tickets.js`
- [ ] `routes/portal-software.js`
- [ ] `routes/import.js`
- [ ] `routes/reports.js`
- [ ] `routes/members.js`

### 2d. Utility/Service Files
| File | Changes |
|---|---|
| `utils/entityHelpers.js` | `findProjectOrFail` → `findInboxOrFail`, `hasProjectAccess` → `hasInboxAccess`, `getAssignedProjectIds` → `getAssignedInboxIds`, `createProjectAssignments` → `createInboxAssignments` |
| `utils/inboxValidation.js` | `validateProjectCodeUnique` → `validateInboxCodeUnique` |
| `utils/prismaFragments.js` | `PROJECT_ASSIGNMENT_INCLUDE` → `INBOX_ASSIGNMENT_INCLUDE` |
| `services/cronService.js` | project references |
| `services/emailParticipantManager.js` | project references |
| `services/inboundEmailService.js` | project references if any |
| `lib/email/mailers/software.js` | URL strings `/projects/` → `/inboxes/` |

- [ ] `utils/entityHelpers.js`
- [ ] `utils/inboxValidation.js`
- [ ] `utils/prismaFragments.js`
- [ ] `services/cronService.js`
- [ ] `services/emailParticipantManager.js`
- [ ] `services/inboundEmailService.js`
- [ ] `lib/email/mailers/software.js`

---

## Phase 3: Frontend Files

### 3a. Rename Files
| Current | New |
|---|---|
| `api/projects.ts` | `api/inboxes.ts` |
| `hooks/useProjectForm.ts` | `hooks/useInboxForm.ts` |
| `hooks/useProjectSoftwareCatalog.ts` | `hooks/useInboxSoftwareCatalog.ts` |
| `pages/Projects.tsx` | `pages/Inboxes.tsx` |
| `pages/ProjectTickets.tsx` | `pages/InboxTickets.tsx` |
| `pages/admin/Projects.tsx` | `pages/admin/Inboxes.tsx` |
| `pages/admin/ProjectNew.tsx` | `pages/admin/InboxNew.tsx` |
| `pages/admin/ProjectEdit.tsx` | `pages/admin/InboxEdit.tsx` |
| `pages/admin/ProjectDetail.tsx` | `pages/admin/InboxDetail.tsx` |
| `pages/admin/ProjectSoftwareCatalog.tsx` | `pages/admin/InboxSoftwareCatalog.tsx` |
| `pages/admin/ProjectSoftwareDetail.tsx` | `pages/admin/InboxSoftwareDetail.tsx` |
| `pages/admin/ProjectEmailRules.tsx` | `pages/admin/InboxEmailRules.tsx` |
| `pages/portal/PortalProjectSoftware.tsx` | `pages/portal/PortalInboxSoftware.tsx` |
| `pages/portal/PortalProjectSoftwareDetail.tsx` | `pages/portal/PortalInboxSoftwareDetail.tsx` |
| `pages/admin/members/ProjectAssignmentModal.tsx` | `pages/admin/members/InboxAssignmentModal.tsx` |
| `pages/admin/members/ProjectCheckboxList.tsx` | `pages/admin/members/InboxCheckboxList.tsx` |
| `components/project/` dir | `components/inbox/` dir |
| `components/project/ProjectGeneralTab.tsx` | `components/inbox/InboxGeneralTab.tsx` |
| `components/project/ProjectAutoReplyTab.tsx` | `components/inbox/InboxAutoReplyTab.tsx` |
| `components/project/ProjectEmailRulesTab.tsx` | `components/inbox/InboxEmailRulesTab.tsx` |
| `components/software/ProjectSoftwareTab.tsx` | `components/software/InboxSoftwareTab.tsx` |

- [ ] Rename API files
- [ ] Rename hook files
- [ ] Rename page files
- [ ] Rename component files/dirs

### 3b. Update Content in All Files
| File | Changes |
|---|---|
| `App.tsx` | lazy imports, route paths (`/projects` → `/inboxes`, `/admin/projects` → `/admin/inboxes`) |
| `api/inboxes.ts` | function names (`getProjects` → `getInboxes`, etc.), endpoint paths |
| `api/software.ts` | function names and endpoint paths |
| `api/emailRules.ts` | param names |
| `api/types.ts` | type names (`ProjectSoftware` → `InboxSoftware`) |
| `components/Layout.tsx` | nav labels ("Projects" → "Inboxes", "Manage Projects" → "Manage Inboxes"), route paths |
| All page components | imports, variable names, UI text, route params |
| All hooks | function names, variable names, imports |

- [ ] `App.tsx`
- [ ] `api/inboxes.ts`
- [ ] `api/software.ts`
- [ ] `api/emailRules.ts`
- [ ] `api/types.ts`
- [ ] `components/Layout.tsx`
- [ ] All page components
- [ ] All hooks

---

## Phase 4: Other References
- [ ] Check `components/tickets/` for project references (TicketTimer, ticket forms, etc.)
- [ ] Check any test files
- [ ] Check email templates for `/projects/` URL references

---

## Execution Order
1. Prisma schema rename → `prisma generate`
2. Backend utility files (`entityHelpers`, `validation`, `fragments`) — these are imported everywhere
3. Backend route files (rename + update content)
4. Backend `index.js` (update imports and mounts)
5. Frontend API layer (`api/inboxes.ts`, `api/software.ts`, `api/types.ts`)
6. Frontend hooks
7. Frontend components
8. Frontend pages
9. Frontend `App.tsx` + `Layout.tsx`
10. Sweep for any remaining `project`/`Project` references (excluding `node_modules`, `.git`, prisma migrations)
