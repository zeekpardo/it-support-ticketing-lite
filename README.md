# Groovi Support

A multi-tenant support ticket management platform with email-based ticketing, client portal, software access management, and team collaboration tools.

## Features

### Ticket Management
- **Inboxes** — Organize tickets by team or topic; assign default staff, stages, and SLA due dates per inbox
- **Kanban Stages** — Drag-and-drop ticket pipeline with customizable stages per inbox
- **Priority & Status** — Four priority levels (Low, Medium, High, Urgent) with auto-calculated due dates; status tracking (New, In Progress, Waiting, Review, Resolved)
- **Assignment** — Assign tickets to staff members with in-app and email notifications on assignment
- **Time Entries** — Log billable time directly on tickets
- **Attachments** — File uploads stored in S3-compatible storage
- **Internal Comments** — Private notes visible only to staff; public comments visible to clients

### Email-Based Ticketing
- **Inbound Email** — Receive emails via Resend webhooks; auto-create tickets or thread replies onto existing tickets
- **Email Rules** — Route inbound emails to inboxes by exact address, sender domain, or catch-all
- **Reply Threading** — Full RFC 5322 threading (`Message-ID`, `In-Reply-To`, `References`); handles Outlook and Gmail reply chains
- **Auto-Reply** — Configurable per-inbox auto-reply sent when a new ticket is created via email
- **Outbound Emails** — Threaded reply emails to clients when staff comments on a ticket
- **Custom Email Domains** — Send from your own domain via Resend domain verification

### Client Portal
- **Magic Link Auth** — Passwordless login for clients via email link (no account creation required)
- **Ticket Submission** — Public intake form per organization; clients can also submit via the portal
- **Client Ticket View** — Clients see their own tickets, comment history, and status
- **Software Access Requests** — Clients can request access to software managed by the team

### Software Access Management
- **Software Catalog** — Maintain a catalog of software tools organized by category
- **Inbox Software** — Assign software to inboxes; designate admins responsible for access
- **Access Requests** — Clients request access; admins approve or deny with notification
- **Renewal Notifications** — Track software renewal dates with automated reminders

### Notifications
- **In-App Notifications** — Real-time bell notifications for ticket assignments, new replies, mentions, and access requests
- **Email Notifications** — Email alerts for assignees when clients reply via email or portal

### Organization & Team
- **Multi-Tenancy** — Fully isolated organizations; each with their own inboxes, members, and settings
- **Roles** — Four roles: Owner, Manager, Staff, Client — with scoped access controls
- **Invitations** — Invite staff by email with optional inbox pre-assignment
- **Branding** — Custom logo and colors per organization (applied to client-facing emails and portal)
- **Reports** — Time entry and ticket reports scoped by inbox, staff member, or date range

### Super Admin
- **Platform Admin Panel** — Manage all organizations, impersonate users, and configure system-wide settings

## Tech Stack

### Backend
- **Node.js 22+ + Express** — REST API
- **Prisma ORM + PostgreSQL** — Database (Railway Postgres)
- **Better Auth** — Authentication with organization and magic link plugins
- **Resend** — Transactional email and inbound email webhooks
- **AWS S3 / S3-compatible** — File and attachment storage

### Frontend
- **React 18 + TypeScript**
- **Vite** — Build tool
- **Tailwind CSS v4** — Styling
- **React Router** — Navigation

### Infrastructure
- **Railway** — Two services: backend API + frontend static site
- **Resend** — Email delivery and inbound routing

## Project Structure

```
timetracking/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma          # Database schema
│   ├── src/
│   │   ├── index.js               # Express app entry point
│   │   ├── lib/
│   │   │   ├── auth.js            # Better Auth config + Prisma client
│   │   │   └── email/
│   │   │       ├── client.js      # Resend email sender
│   │   │       ├── threading.js   # Message-ID generation + References chain
│   │   │       ├── templates.js   # Email HTML templates
│   │   │       ├── branding.js    # Per-org branding helpers
│   │   │       ├── index.js       # Public email API
│   │   │       └── mailers/       # Specific email senders (ticket, software, auth)
│   │   ├── middleware/
│   │   │   ├── auth.js            # requireStaff, requireAdmin, etc.
│   │   │   └── asyncHandler.js
│   │   ├── routes/
│   │   │   ├── tickets/           # Ticket CRUD, comments, attachments, time entries
│   │   │   ├── inboxes.js         # Inbox management
│   │   │   ├── email-rules.js     # Email routing rules
│   │   │   ├── email-domains.js   # Custom domain setup
│   │   │   ├── members.js         # Team member management
│   │   │   ├── notifications.js   # In-app notifications
│   │   │   ├── portal/            # Client portal routes
│   │   │   ├── inbox-software.js  # Software catalog per inbox
│   │   │   ├── branding.js        # Org branding settings
│   │   │   ├── reports.js         # Time & ticket reports
│   │   │   ├── webhooks/          # Resend inbound email webhook
│   │   │   └── superAdmin.js      # Platform admin routes
│   │   ├── services/
│   │   │   ├── inboundEmailService.js   # Webhook processing + threading logic
│   │   │   ├── emailReplyHandler.js     # Reply-to-comment matching
│   │   │   ├── ticketFromEmailFactory.js # New ticket creation from email
│   │   │   ├── emailRuleMatcher.js      # Inbox routing rule matching
│   │   │   ├── notificationService.js   # In-app + email notifications
│   │   │   └── emailParticipantManager.js # CC/To participant tracking
│   │   └── utils/
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── pages/                 # Page components
│   │   ├── components/            # Shared UI components
│   │   ├── context/               # React contexts (auth, org)
│   │   └── api/                   # API client helpers
│   └── package.json
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 22+
- PostgreSQL database
- Resend account (for email)
- S3-compatible storage (for attachments)

### Backend Setup

```bash
cd backend

npm install

# Copy and configure environment variables
cp .env.example .env

# Push schema to database
npx prisma db push

# (Optional) Seed initial data
npm run db:seed

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd frontend

npm install

npm run dev
```

The app runs at `http://localhost:5173` with the backend at `http://localhost:3001`.

## Environment Variables

### Backend

```env
# Database
DATABASE_URL="postgresql://user:pass@host:5432/dbname"

# Auth
BETTER_AUTH_SECRET="your-secret-key-min-32-characters"
BETTER_AUTH_URL="https://api.yourdomain.com"
FRONTEND_URL="https://app.yourdomain.com"

# Email (Resend)
RESEND_API_KEY="re_..."
FROM_EMAIL="Groovi Support <support@yourdomain.com>"
EMAIL_DOMAIN="yourdomain.com"

# Client portal base URL (for magic links)
BASE_DOMAIN="yourdomain.com"

# Storage (S3-compatible)
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
AWS_REGION="us-east-1"
AWS_S3_BUCKET="your-bucket"
AWS_S3_ENDPOINT="https://..."   # optional, for non-AWS providers

NODE_ENV="production"
PORT=3001
```

### Frontend

```env
VITE_API_URL="https://api.yourdomain.com"
```

## Email Setup (Resend)

1. **Add your domain** in Resend → Domains and verify DNS records
2. **Configure inbound routing** — Point your MX records to Resend's inbound servers and register a webhook pointing to `https://api.yourdomain.com/api/webhooks/inbound-email`
3. **Create email rules** in the app (Settings → Email Rules) to route inbound emails to the correct inbox:
   - `EXACT_ADDRESS` — Match a specific recipient address (e.g. `support@yourdomain.com`)
   - `DOMAIN` — Match all emails from a sender domain
   - `CATCH_ALL` — Fallback for any unmatched inbound email
4. Set `FROM_EMAIL` to an address on your verified Resend domain

## Deployment on Railway

Two services — backend and frontend — deployed from the same GitHub repository.

### Backend Service
- Root directory: `backend`
- Start command: `npm run start` (runs `prisma generate && prisma db push && node src/index.js`)
- Add a **PostgreSQL** database; Railway injects `DATABASE_URL` automatically
- Set all backend environment variables listed above

### Frontend Service
- Root directory: `frontend`
- Build command: `npm run build`
- Publish directory: `dist`
- Set `VITE_API_URL` to your backend's public URL

### Custom Domains (Required for Auth)

Modern browsers block third-party cookies, which breaks authentication when frontend and backend are on different domains. Use subdomains of the same root domain:

- Frontend: `app.yourdomain.com`
- Backend: `api.yourdomain.com`

Add custom domains in each Railway service under Settings → Networking → Custom Domain, then update your DNS with the provided CNAME records.

### Super Admin Access

Grant super admin access by setting a user's role in the database:

```sql
UPDATE "user" SET role = 'admin' WHERE email = 'your@email.com';
```

The super admin panel is available at `/super-admin`.
