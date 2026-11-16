# Customer Relationship Management System

A full-stack CRM prototype built from the project synopsis (Lingaya's Vidyapeeth, B.Tech CSE).

**Stack:** React (Vite) · Node.js + Express · MongoDB + Mongoose · JWT · bcrypt hashing · Recharts

## Features

| Module | What it does |
| --- | --- |
| Authentication | Login with JWT, bcrypt-hashed passwords, rate-limited login endpoint, change-password API |
| Role-based access | Super Admin, Admin/Manager, Salesman/Agent, enforced on the backend for both routes and individual records |
| Dashboard | Live customer, revenue, MRR, retention, pipeline forecast, conversion, follow-up and meeting metrics; recent customers and team activity |
| Workspace tools | Global search across accessible leads, customers, employees and tasks (`Ctrl+K`), plus task alerts for overdue and next-7-day follow-ups |
| Leads | Create, search, filter (stage/source), paginate, edit, assign, delete, CSV import/export with row-level validation and duplicate-email checks, per-lead detail page |
| Deal forecasting | Track estimated deal value, win probability, expected close date, and priority; dashboard reports open pipeline and probability-weighted forecast |
| Customers | Profiles with company details, category/status, owner, tags, notes, lifetime value, MRR, purchase records, communication timeline, search, filters and CSV export |
| Pipeline | Kanban board (New → Contacted → Qualified → Converted, plus Lost) with drag-and-drop stage changes |
| Tasks | Due dates, follow-up/meeting/call/email types, priority, status, assignment, overdue alerts and upcoming meetings |
| Interaction history | Notes, calls, emails and meetings per lead; stage changes and assignments are logged automatically |
| Reports (managers) | Lead sources, pipeline values, customer growth, monthly revenue, team sales/targets, date filters, CSV and print/PDF |
| User management | Employee department/title, sales targets, roles, account status and performance tracking |
| Settings | Profile, password/session security, company identity, reporting currency/timezone, and light/dark theme |

## Prerequisites

- Node.js 18 or newer
- MongoDB running locally (`mongodb://127.0.0.1:27017`) or a MongoDB Atlas connection string

## Setup

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env        # set MONGODB_URI, JWT_SECRET, and seed passwords
npm run seed                # optional demo data; clears existing CRM collections
npm run dev                 # API on http://localhost:5000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev                 # app on http://localhost:5173
```

The Vite dev server proxies `/api` to `http://localhost:5000`, so no extra configuration is needed. Set `VITE_DEV_API_PROXY` to change the local API target. See [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel setup and production environment variables.

### Demo accounts (after `npm run seed`)

The seed script creates a Super Admin username `admin` and manager/agent demo accounts. Set `SEED_ADMIN_PASSWORD` and `SEED_DEMO_PASSWORD` in `backend/.env` to separate unique values of at least 16 characters before seeding. The script does not print passwords.

| Role | Login identifier |
| --- | --- |
| Super Admin | `admin` (also `admin@crm.test`) |
| Admin/Manager | manager@crm.test |
| Salesman/Agent | agent1@crm.test, agent2@crm.test |

Change or delete these accounts before any real deployment.

## Role matrix

| Action | Super Admin | Manager | Agent |
| --- | :-: | :-: | :-: |
| View all leads / tasks / contacts | ✔ | ✔ | Own only |
| Create leads | ✔ | ✔ | ✔ (assigned to self) |
| Edit lead name/source | ✔ | ✔ | ✘ (contact details and notes only) |
| Assign leads | ✔ | ✔ | ✘ |
| Change pipeline stage | ✔ | ✔ | ✔ (own leads) |
| Delete leads / tasks | ✔ | ✔ | ✘ |
| Create tasks for others | ✔ | ✔ | ✘ (self only) |
| Update task status | ✔ | ✔ | ✔ (own tasks) |
| View reports | ✔ | ✔ | ✘ |
| Manage users | All roles | Agents only | ✘ |

"Own" means records assigned to that agent. The checks live in the API (`src/middleware/auth.js`, `src/utils/helpers.js`); the React app only hides controls as a convenience.

## API overview

All routes except `POST /api/auth/login` need `Authorization: Bearer <token>`.

```
POST   /api/auth/login              GET    /api/auth/me
POST   /api/auth/change-password

GET    /api/users                   POST   /api/users             PATCH /api/users/:id

GET    /api/leads  (?q&stage&source&assignedTo&from&to&page&limit)
GET    /api/leads/board             POST   /api/leads
POST   /api/leads/import            (up to 500 CSV-parsed lead records; returns row-level errors)
GET    /api/leads/:id               PATCH  /api/leads/:id         DELETE /api/leads/:id
PATCH  /api/leads/:id/stage         PATCH  /api/leads/:id/assign
POST   /api/leads/:id/activities

GET    /api/contacts                POST   /api/contacts
GET    /api/contacts/:id            PATCH  /api/contacts/:id        DELETE /api/contacts/:id
POST   /api/contacts/:id/activities POST   /api/contacts/:id/purchases

GET    /api/tasks  (?q&status&lead&overdue&assignedTo&page)
GET    /api/tasks/notifications  (overdue and next-7-day tasks for the signed-in user)
POST   /api/tasks                   PATCH  /api/tasks/:id         DELETE /api/tasks/:id

GET    /api/dashboard
GET    /api/reports/overview        GET    /api/reports/team      (?from&to)
GET    /api/settings                PATCH  /api/settings          (manager)
```

Lead CSV files use the headers `name,email,phone,organization,source,stage,notes`. The `name` column is required; blank source/stage values use the normal defaults. Duplicate email addresses are skipped within the signed-in user's accessible lead scope. Agent imports are assigned to that agent; manager imports remain unassigned. The Leads page export includes all records matching the current search and stage/source filters.

## Project structure

```
crm-system/
├── backend/
│   ├── server.js
│   └── src/
│       ├── config/        db connection, shared constants (roles, stages, sources)
│       ├── models/        User, Lead, Contact, Task, Activity
│       ├── middleware/    auth (JWT + roles), error handling
│       ├── controllers/   auth, user, lead, contact, task, dashboard, report
│       ├── routes/
│       ├── utils/         helpers (validation, record-level access, pagination)
│       └── seed.js        demo data
└── frontend/
    └── src/
        ├── pages/         Login, Dashboard, Leads, LeadDetail, Contacts, Pipeline, Tasks, Reports, Users
        ├── components/    Layout, shared UI
        ├── AuthContext.jsx
        └── api.js         axios instance, constants, formatters
```

## Testing checklist (from the synopsis, Chapter 14)

Run these manually with the seeded accounts, or with Postman, and record the observed results for your report.

1. Login with valid credentials creates a session; a wrong password is rejected (401).
2. Calling a protected API without a token returns 401.
3. An agent calling `POST /api/users` or `GET /api/reports/overview` gets 403.
4. An agent opening another agent's lead (`GET /api/leads/:id`) gets 403.
5. Manager creates a lead, assigns it to an agent, and creates a follow-up task.
6. Lead search and stage/source filters return matching records.
7. Agent logs a note and moves the lead from New to Contacted; the activity timeline shows both entries.
8. Invalid data (bad email, unknown stage, missing title) returns a 400 with a clear message.
9. Dashboard counts match the stored leads and tasks; the report totals match the dashboard.
10. Check the layout at desktop and phone widths.

## Differences from the synopsis

- **bcryptjs** is used instead of native `bcrypt`. It uses the same algorithm and needs no compilation, which avoids install problems on Windows.
- **Plain CSS** is used instead of Tailwind/SCSS to keep the setup to `npm install` and `npm run dev`.
- **Nodemailer and Socket.IO** are not included. The synopsis lists them as optional, so they are left as future enhancements.
- A **Lost** stage is included alongside the four stages in the synopsis (the synopsis allows this in section 7.3).
- The **conversion rate** on the dashboard is Converted ÷ (Converted + Lost), shown as "—" until at least one lead has a final outcome.

## Before deploying

- Set a long random `JWT_SECRET` and never commit `.env`.
- Serve over HTTPS and restrict `CLIENT_ORIGIN` to your real frontend URL.
- Use a secured MongoDB instance with backups.
- Remove the demo seed accounts.
