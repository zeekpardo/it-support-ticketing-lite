# TimeTracker

A multi-tenant time tracking application with team management, project tracking, and reporting capabilities.

## Features

- **Timer & Manual Entry**: Start/stop timer or log time manually
- **Multi-tenant Organizations**: Create and manage multiple organizations
- **Team Management**: Invite members, assign roles (Owner, Admin, Member)
- **Project Management**: Create and organize projects with codes and client names
- **Reports & Export**: View summaries by project/user/date, export to CSV
- **Role-based Access**:
  - **Members**: Log own time, view own reports
  - **Admins**: Manage projects, view all team time
  - **Owners**: Full control including member management

## Tech Stack

### Backend
- **Node.js + Express** - REST API
- **Prisma ORM** - Database access with SQLite
- **Better Auth** - Authentication with organization plugin
- **Railway** - Deployment platform

### Frontend
- **React 18** + TypeScript
- **Vite** - Build tool
- **Tailwind CSS v4** - Styling
- **Catalyst UI** - Component library
- **React Router** - Navigation

## Project Structure

```
timetracking/
├── backend/
│   ├── prisma/
│   │   └── schema.prisma      # Database schema
│   ├── src/
│   │   ├── index.js           # Express app
│   │   ├── lib/
│   │   │   └── auth.js        # Better Auth config
│   │   ├── middleware/
│   │   │   └── auth.js        # Auth middleware
│   │   ├── routes/
│   │   │   ├── timeEntries.js # Time entry CRUD
│   │   │   ├── projects.js    # Project management
│   │   │   └── reports.js     # Reports & export
│   │   └── utils/
│   │       └── csv.js         # CSV generation
│   ├── package.json
│   └── .env
├── frontend/
│   ├── src/
│   │   ├── components/        # Reusable components
│   │   │   ├── ui/           # Catalyst UI components
│   │   │   ├── Layout.tsx
│   │   │   ├── Timer.tsx
│   │   │   └── ...
│   │   ├── context/          # React contexts
│   │   ├── pages/            # Page components
│   │   ├── api/              # API client
│   │   └── lib/              # Auth client
│   ├── package.json
│   └── vite.config.ts
└── README.md
```

## Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env
# Edit .env with your settings

# Initialize database
npx prisma db push

# Start development server
npm run dev
```

### Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will be available at http://localhost:5173

## Environment Variables

### Backend (.env)
```
DATABASE_URL="file:./dev.db"
BETTER_AUTH_SECRET="your-secret-key-min-32-characters"
BETTER_AUTH_URL="http://localhost:3001"
PORT=3001
FRONTEND_URL="http://localhost:5173"
```

### Frontend (.env)
```
VITE_API_URL="http://localhost:3001"
```

In development, the frontend proxies API requests to the backend automatically via Vite config.

## API Endpoints

### Authentication (handled by Better Auth)
- `POST /api/auth/sign-up/email` - Register
- `POST /api/auth/sign-in/email` - Login
- `POST /api/auth/sign-out` - Logout

### Time Entries
- `GET /api/time-entries` - List entries
- `POST /api/time-entries` - Create entry
- `PUT /api/time-entries/:id` - Update entry
- `DELETE /api/time-entries/:id` - Delete entry
- `POST /api/time-entries/:id/stop` - Stop timer

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `PUT /api/projects/:id` - Update project
- `DELETE /api/projects/:id` - Delete/archive project

### Reports
- `GET /api/reports/summary` - Get summary report
- `GET /api/reports/export` - Export to CSV
- `GET /api/reports/billing` - Billing report

## Deployment on Railway

This app is configured for deployment on Railway as two separate services.

### Option A: Deploy via Railway Dashboard (Recommended)

#### 1. Deploy Backend

1. Go to [railway.app](https://railway.app) and create a new project
2. Click "New Service" → "GitHub Repo" and select this repository
3. Set the **Root Directory** to `backend`
4. Add a **Postgres database** (recommended) or use SQLite with a volume
5. Configure environment variables:
   ```
   DATABASE_URL         → (auto-provided if using Railway Postgres)
   BETTER_AUTH_SECRET   → (generate a secure 32+ char string)
   BETTER_AUTH_URL      → https://your-backend.up.railway.app
   FRONTEND_URL         → https://your-frontend.up.railway.app
   ```
6. Deploy and note the generated URL

#### 2. Deploy Frontend

1. In the same project, click "New Service" → "GitHub Repo"
2. Set the **Root Directory** to `frontend`
3. Configure environment variables:
   ```
   VITE_API_URL → https://your-backend.up.railway.app
   ```
4. Deploy

### Option B: Deploy via Railway CLI

```bash
# Install Railway CLI
npm install -g @railway/cli

# Login
railway login

# Create project
railway init

# Deploy backend
cd backend
railway link
railway up

# Deploy frontend (in separate service)
cd ../frontend
railway link
railway up
```

### Database Options

**PostgreSQL (Recommended for production):**
- Add a Postgres database in Railway dashboard
- Railway auto-injects `DATABASE_URL`
- Update your Prisma schema provider from `sqlite` to `postgresql`

**SQLite with Volume:**
- Add a volume mounted at `/data`
- Set `DATABASE_URL="file:/data/prod.db"`
- Note: SQLite has limitations for concurrent connections

### Post-Deployment

1. Update `BETTER_AUTH_URL` to match your backend's Railway URL
2. Update `FRONTEND_URL` to match your frontend's Railway URL
3. Update `VITE_API_URL` in frontend to match backend URL
4. Redeploy both services after updating URLs

## Future Enhancements

- [ ] Chrome extension for quick time tracking
- [ ] Hourly rate configuration per project
- [ ] Invoice generation
- [ ] Integrations (Slack, calendar)
- [ ] Mobile app
