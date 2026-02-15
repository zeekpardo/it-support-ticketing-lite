# Prisma Upgrade Plan: 5.22.0 → 7.x

## Overview

Upgrading Prisma from v5.22.0 to v7.x. This crosses two major versions (5→6→7), each with breaking changes. The upgrade should be done in a single pass to v7, but understanding both sets of breaking changes is critical.

**Current state:**
- `prisma` and `@prisma/client` at `^5.22.0`
- Node.js 22.11.0 (meets v7 minimum of 20.19.0)
- Backend already uses ESM (`"type": "module"`)
- No `$use` middleware, no `Bytes` fields, no `previewFeatures`
- 5 files import `PrismaClient` from `@prisma/client`
- 273 Prisma calls across 28 source files
- 4 `$transaction` usages
- Deployed on Railway via Docker (`node:20-bookworm-slim`)

---

## Breaking Changes Assessment

### From Prisma 6 (passing through)

| Change | Impact on this project |
|--------|----------------------|
| Node.js ≥18.18.0 required | **None** — already on 22.11.0 |
| TypeScript ≥5.1.0 required | **None** — backend is plain JS |
| `Buffer` → `Uint8Array` for `Bytes` fields | **None** — no `Bytes` fields in schema |
| `NotFoundError` removed from Prisma | **None** — we use a custom `NotFoundError` in `utils/errors.js`, not Prisma's |
| `fullTextSearch` preview changes | **None** — no preview features used |
| PostgreSQL many-to-many implicit relation index → PK | **None** — no implicit many-to-many relations (all explicit join tables) |
| `$use` middleware deprecated | **None** — not used |

### From Prisma 7 (target)

| Change | Impact on this project | Action needed |
|--------|----------------------|---------------|
| **Generator provider change** | `prisma-client-js` → `prisma-client` | Update `schema.prisma` |
| **`output` field now mandatory** | Client no longer generates into `node_modules` | Add `output` to generator block |
| **Import path changes** | `from '@prisma/client'` no longer works by default | Update all 5 import sites |
| **Driver adapter required** | Must use `@prisma/adapter-pg` for PostgreSQL | Install adapter, update client init |
| **`prisma.config.ts` required** | Database URL config moves out of schema | Create config file |
| **`url`/`directUrl` deprecated in schema** | `datasource.url` moves to `prisma.config.ts` | Move env reference |
| **Env vars not auto-loaded** | Prisma CLI won't read `.env` automatically | Already using `dotenv` — need to ensure CLI picks it up via config |
| **`--skip-generate` flag removed** | From `prisma migrate dev` and `db push` | Update `start` script if affected |
| **SSL validation stricter** | Node.js pg driver rejects invalid certs by default | Verify Railway PG connection |
| **Automatic seeding removed** | `migrate dev` no longer auto-seeds | Already using explicit `db:seed` script |
| **Dockerfile Node.js version** | Needs `node:22` for best compatibility | Update Dockerfile base image |

---

## Implementation Steps

### Phase 1: Preparation (non-breaking)

- [ ] **1.1** Create a new branch: `feat/prisma-7-upgrade`
- [ ] **1.2** Take a database backup (Railway dashboard or `pg_dump`)
- [ ] **1.3** Update Dockerfile from `node:20-bookworm-slim` → `node:22-bookworm-slim`

### Phase 2: Install packages

- [ ] **2.1** Install new Prisma packages:
  ```bash
  npm i prisma@latest @prisma/client@latest
  npm i @prisma/adapter-pg pg
  ```
- [ ] **2.2** Verify installed versions match (`npx prisma -v`)

### Phase 3: Schema and config changes

- [ ] **3.1** Update `prisma/schema.prisma` generator block:
  ```prisma
  generator client {
    provider = "prisma-client"
    output   = "../src/generated/prisma"
  }
  ```

- [ ] **3.2** Create `prisma.config.ts` at backend root:
  ```ts
  import path from 'node:path'
  import { defineConfig } from 'prisma/config'

  export default defineConfig({
    earlyAccess: true,
    schema: path.join(__dirname, 'prisma', 'schema.prisma'),
  })
  ```

- [ ] **3.3** Run `npx prisma generate` to generate the client in the new output location

### Phase 4: Update client initialization

- [ ] **4.1** Update `src/lib/auth.js` — PrismaClient init with driver adapter:
  ```js
  import { PrismaClient } from '../generated/prisma/client.js'
  import { PrismaPg } from '@prisma/adapter-pg'

  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  const prisma = new PrismaClient({ adapter })
  ```

- [ ] **4.2** Update all other files that import PrismaClient (4 files):
  - `prisma/seed.js`
  - `delete-test-users.js`
  - `make-admin.js`
  - `scripts/migrate-ticket-stages.js`

  All change from:
  ```js
  import { PrismaClient } from '@prisma/client'
  ```
  to the new generated path (adjust relative path per file location).

- [ ] **4.3** Consider extracting a shared `src/lib/prisma.js` module that handles adapter setup and exports the client instance — avoids duplicating adapter config across files.

### Phase 5: Update package.json scripts

- [ ] **5.1** Update `start` script — `prisma generate` and `prisma db push` still work but verify no removed flags are used
- [ ] **5.2** Verify `db:seed` still works (already explicit, not relying on auto-seed)
- [ ] **5.3** Add the generated Prisma client directory to `.gitignore`:
  ```
  src/generated/
  ```

### Phase 6: Update Dockerfile

- [ ] **6.1** Update base image:
  ```dockerfile
  FROM node:22-bookworm-slim
  ```
- [ ] **6.2** The OpenSSL runtime dependency may no longer be needed (v7 uses Node.js native pg driver instead of Rust engine), but keep it for safety initially
- [ ] **6.3** Ensure `prisma generate` runs during build (already happens via `npm start`)

### Phase 7: Test locally

- [ ] **7.1** Run `npx prisma generate` — confirm client generates to `src/generated/prisma/`
- [ ] **7.2** Run `npx prisma db push` — confirm schema syncs without errors
- [ ] **7.3** Start the app locally (`npm run dev`) and verify:
  - Auth flows (Better Auth uses the same PrismaClient)
  - CRUD operations on tickets, projects, time entries
  - `$transaction` calls in `ticketStages.js`, `projects.js`, `memberProjects.js`
  - Email webhook processing
- [ ] **7.4** Test the seed script: `npm run db:seed`

### Phase 8: Railway deployment

- [ ] **8.1** Set any new required env vars on Railway (if `prisma.config.ts` needs them)
- [ ] **8.2** Verify Railway PostgreSQL SSL configuration works with stricter Node.js pg defaults
- [ ] **8.3** Deploy to a preview environment first if possible
- [ ] **8.4** Monitor logs for connection errors or query failures after deploy

---

## Files to modify

| File | Change |
|------|--------|
| `package.json` | Update prisma deps, add `@prisma/adapter-pg`, `pg` |
| `prisma/schema.prisma` | Update generator block (provider + output) |
| `prisma.config.ts` | **New file** — Prisma v7 config |
| `src/lib/auth.js` | Update PrismaClient import + add driver adapter |
| `prisma/seed.js` | Update PrismaClient import |
| `delete-test-users.js` | Update PrismaClient import |
| `make-admin.js` | Update PrismaClient import |
| `scripts/migrate-ticket-stages.js` | Update PrismaClient import |
| `Dockerfile` | Update to `node:22-bookworm-slim` |
| `.gitignore` | Add `src/generated/` |

## Risk areas

1. **Driver adapter connection pooling** — v7 uses Node.js `pg` instead of Prisma's Rust engine. Connection pool defaults will differ. Monitor for connection exhaustion under load.
2. **SSL certificate validation** — Railway PG may use self-signed certs. If connections fail, may need `ssl: { rejectUnauthorized: false }` in the adapter config.
3. **Better Auth compatibility** — Better Auth creates its own Prisma queries. Verify it works with the new client output path and driver adapter. May need to pass the prisma instance explicitly.
4. **Generated output path** — The `src/generated/prisma/` path must be generated before the app starts. The current `start` script already runs `prisma generate` first, so this should work.

## Rollback plan

If the upgrade causes issues in production:
1. Revert the branch / deploy the previous commit
2. The database schema itself is unchanged (no destructive migrations)
3. The old `@prisma/client@5` will continue to work against the same database
