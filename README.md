# SLBS Academy Sales CRM

A unified, single-tenant Academy Sales CRM built for managing BDE (Business Development Executive) lead workflows with call intelligence, payment tracking, and team management.

## Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite + Tailwind CSS |
| Backend | Node.js + Express + Sequelize ORM |
| Database | PostgreSQL (Supabase) / SQLite (local dev) |
| Auth | JWT + bcrypt |
| Deployment | Vercel (frontend) + Render (backend) |

## Features

- **Unified Academy CRM** — no branch separation; single sales team
- **BDE Working Queue** — prioritized lead queue (missed follow-ups → today's follow-ups → new leads)
- **Lead Management** — upload via CSV/Excel, manual entry, IDOR-protected lead access
- **Call Lifecycle** — full call state machine with talk-time calculation
- **AI Call Intelligence** — async transcript + analysis pipeline (202 Accepted pattern)
- **Payment Tracking** — ₹9,000 verified payment before batch allocation
- **Admin Controls** — branding (CRM name, logo, location), team management, TL operations
- **Security** — JWT hardening, rate limiting, 30-min inactivity timeout, timing-attack protection

## Local Development

```bash
# Backend (SQLite — no DB setup needed)
cd server
npm install
npm run dev       # http://localhost:5000

# Frontend
cd client
npm install
npm run dev       # http://localhost:3001
```

**Default dev credentials:**
- Admin: `admin@test.com` / `Password123!`
- BDE: `sales.kochi@test.com` / `Password123!`

## Production Deployment

See [render.yaml](render.yaml) for Render config and [client/vercel.json](client/vercel.json) for Vercel config.

### Environment Variables (Render)

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Supabase PostgreSQL URI |
| `JWT_SECRET` | Strong random secret (64+ chars) |
| `CORS_ORIGIN` | Your Vercel frontend URL |
| `ADMIN_EMAIL` | Production admin email |
| `ADMIN_PASSWORD` | Production admin password |

### Environment Variables (Vercel)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Your Render backend URL + `/api` |

## License

Private — SLBS Academy internal use only.
