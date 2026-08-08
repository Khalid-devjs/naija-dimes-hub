# Naija Dimes Hub — Premium Free Fire Diamonds Store
Fast. Simple. Reliable.

## Quick Start (Local)

```bash
git clone https://github.com/Khalid-devjs/naija-dimes-hub.git
cd naija-dimes-hub
cp .env.example .env
# EDIT .env: change SESSION_SECRET, set your bank details, etc.
npm install
npm start   # http://localhost:3000
```

## Overview

- **Stack**: Express + EJS + SQLite3 + bcryptjs + helmet + CSRF
- **Money**: NGN stored as kobo (₦1 = 100)
- **Auth**: session cookies, bcrypt password hashing, role‑based (super_admin | manager | support)
- **Order flow**: 7 steps → payment screenshot → manual admin approval → COMPLETED

## Admin credentials

Default (set in `.env` or seed on first run):
- username: `admin`
- password: `NaijaDimes2026!`  
- role: `super_admin`

**CHANGE THESE on first admin login.**

## Directory layout

```
naija-dimes-hub/
├─ package.json
├─ server.js           # Express entry point
├─ src/
│  ├─ db.js            # SQLite3 connection + schema
│  ├─ config.js        # Environment config
│  ├─ lib/
│  │  ├─ money.js      # kobo ↔ naira helpers
│  │  ├─ orderId.js    # NDH-YYYYMMDD-XXXX generator
│  │  ├─ orderMachine.js # state machine
│  │  ├─ audit.js      # activity logging
│  ├─ routes/
│  │  ├─ public.js     # client pages
│  │  └─ admin.js      # dashboard
│  └─ views/
│     ├─ layout.ejs
│     └─ ...
├─ data/
│  └─ uploads/         # payment screenshots (not public)
└─ views/
```

## Deploy to Render

1. Fork / clone this repo
2. Sign in to Render → New → Web Service
3. Build command: `npm install`
4. Start command: `npm start`
5. Environment: set `NODE_ENV=production`, set `SESSION_SECRET` to a secure random hex
6. Add a Render PostgreSQL instance **optional** (defaults to SQLite)
7. Custom domain: point A record to Render’s IP or use Render’s default sub‑domain

## Environment variables

| Variable | Default | Description |
|----------|---------|-------------|
| PORT | 3000 | Server port |
| SESSION_SECRET | — | Random 64-char hex required |
| APP_URL | (auto) | Public URL for links |
| TRUST_PROXY | 1 | Set 1 behind nginx |
| MAINTENANCE_MODE | 0 | 1 = show maintenance page |
| RATE_LOGIN | 20 | 15-min limit per IP |
| RATE_ORDER | 15 | 10-min limit |
| RATE_PAYMENT | 10 | 10-min limit |
| RATE_CONTACT | 5 | 10-min limit |
| MAX_UPLOAD_MB | 5 | Payment screenshot size |

## TODO

- [ ] Admin login page
- [ ] Hero + announcement CMS
- [ ] Package cards (with edit UI)
- [ ] Checkout → order creation → payment upload  
- [ ] Admin panel: orders, packages, bank details
- [ ] CSS: dark glassmorphism theme
- [ ] Email notifications
- [ ] PWA support