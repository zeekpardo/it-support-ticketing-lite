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
```

### Frontend
The frontend proxies API requests to the backend automatically via Vite config.

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

## Deployment

### Railway

1. Create a new Railway project
2. Add your backend service
3. Add environment variables
4. Deploy!

The SQLite database will be persisted via Railway's volume storage.

## Future Enhancements

- [ ] Chrome extension for quick time tracking
- [ ] Hourly rate configuration per project
- [ ] Invoice generation
- [ ] Integrations (Slack, calendar)
- [ ] Mobile app
