# AdEarn

**Ad Revenue to Customer — Get Paid to Watch Ads and Buy Products**

AdEarn is a production-level cashback advertising platform where users declare purchase intent, watch matched video ads, complete purchases, and receive 1–5% cashback automatically split into four pools. Advertisers are billed only after cashback is committed — never on impressions.

---

## What It Does

Users declare purchase intent and are shown only ads that match their profile via JSONB overlap queries. When a purchase is confirmed via Stripe webhook, the cashback engine runs a single atomic PostgreSQL transaction that splits earnings into four pools: **liquid (40%) / self-savings (30%) / parent fund (20%) / charity (10%)** — a split each user can re-tune anytime. Advertisers pay only on verified conversions.

**Three invariants are always enforced:**
1. Cashback distribution is always one atomic PostgreSQL transaction — partial writes are a financial bug.
2. Advertiser billing happens only after cashback is committed — never before.
3. Every webhook is idempotent — double-processing is architecturally impossible via Redis SETNX.

---

## Features

### 🛍️ Consumer
| Feature | Description |
|---|---|
| OTP login | Mobile-number auth, JWT RS256 (OTP mocked to `123456` in dev) + one-click demo logins |
| Intent onboarding | Pick shopping categories → only matching ads are ever shown |
| 🎬 Video ad feed | Matched ads play a full-screen video creative → "Shop Now" → Stripe checkout |
| Atomic cashback | Payment webhook triggers the 5-write atomic cashback engine (< 3s) |
| Wallet | Live pool balances (liquid/savings/parent/charity) + recent activity |
| 💸 Withdraw | Cash out the liquid pool to UPI/bank (mocked payout, race-safe, audited) |
| ⚙️ Cashback split | Re-adjust the 40/30/20/10 pool split anytime with live-rebalancing sliders |
| 🎯 Savings goals | Set a savings target and watch the progress ring fill |
| 📊 Insights | Cashback growth chart, pool-split donut, top-earning brands |
| 🏆 Rewards | Shopping-day streaks + unlockable milestone badges |
| ⭐ Ad ratings | Rate ads (relevance/honesty/value) — feeds advertiser quality scores |
| 🔔 Notifications | In-app bell: cashback credited, review prompts, goal reached |
| Transactions | Full cashback ledger with statuses and rating actions |

### 📢 Advertiser
| Feature | Description |
|---|---|
| Campaign management | Create campaigns with video creatives, category targeting, budgets |
| Performance billing | Pay only on confirmed conversions — never impressions |
| Campaign stats | Conversions, spend, budget burn-down, recent conversion table |
| Analytics dashboard | Spend trends, conversion-rate charts, KPI tiles, PDF export |

### 🛡️ Admin
| Feature | Description |
|---|---|
| Financials | Platform-wide cashback totals, pool liabilities, active users |
| Fraud queue | Review transactions flagged by the 4-rule weighted fraud scorer (threshold 0.8) |
| User management | Suspend / reinstate users |
| Advertiser approvals | Approve or reject advertiser applications |
| Audit log | Filterable viewer over every financial write |

### 🌍 Public
| Feature | Description |
|---|---|
| Charity Impact Ledger | No-login transparency page (`/impact`): total raised, NGO partners, disbursement history |

### 📱 Mobile-ready
Responsive layout — desktop gets a sidebar, phones get a native-style **bottom tab bar**, safe-area insets, and app-capable meta tags. **Add to Home Screen** opens fullscreen like an installed app. A Flutter app for consumers lives in `mobile/`.

---

## Tech Stack

| Layer | Tech |
|---|---|
| Backend | Node.js 20 + Express 4 + TypeScript 5 strict |
| Database | PostgreSQL 16 (raw `pg`, no ORM) |
| Cache / Queue | Redis 7 via ioredis |
| Payments | Stripe (test mode) behind `IPaymentProvider` interface |
| Auth | JWT RS256 |
| Frontend | React 18 + Vite + TanStack Router/Query + Zustand + Tailwind CSS |
| Charts | recharts |
| Mobile | Flutter 3 + Riverpod + Dio + flutter_stripe |
| Monitoring | Sentry (server + web) |
| CI/CD | GitHub Actions → Railway (server) + Vercel (web) |

---

## Monorepo Structure

```
adearn/
├── server/               Node.js API (Express)
│   ├── src/
│   │   ├── routes/       auth, feed, attribution, wallet (+withdraw), reviews,
│   │   │                 charity (public), advertiser, admin, webhooks
│   │   ├── services/     cashbackEngine, fraudDetection, adMatcher, poolDistributor…
│   │   ├── repositories/ All SQL lives here — none in services
│   │   ├── middleware/   authenticate, authorize, validate, rateLimiter, errorHandler
│   │   └── jobs/         parentFundTransfer (1st), charityDisbursement (15th), expireAttributions
│   ├── migrations/       001–013 SQL files
│   └── seeds/            demo.seed.ts (full demo scenario)
├── web/                  React 18 frontend
│   └── src/
│       ├── pages/        consumer/ (Feed, Wallet, Insights, Rewards, Transactions,
│       │                 PoolSettings…) · advertiser/ · admin/ · ImpactPage (public)
│       ├── components/   VideoAdModal, CheckoutModal, WithdrawModal, AdReviewModal,
│       │                 NotificationBell, SavingsGoalCard, MobileNav, Sidebar…
│       └── lib/api.ts    axios instance + typed API calls
├── mobile/               Flutter consumer app
├── packages/shared/      Shared TypeScript types + zod schemas
├── docs/                 API spec, business logic, schema reference
├── docker-compose.yml
└── CLAUDE.md             Full build instructions and phase tracker
```

---

## Local Setup

**Prerequisites:** Node.js 20 LTS, Docker Desktop, Stripe CLI

```bash
# 1. Clone and install
git clone https://github.com/suprita0101/ADEARN-A.git
cd ADEARN-A
npm install

# 2. Start infrastructure (Postgres :5433 + Redis :6380)
docker compose up -d postgres redis

# 3. Configure server
cp server/.env.example server/.env
# Edit server/.env — add JWT RS256 keys and Stripe test keys
# Dev-friendly extras: PROFILE_UPDATE_COOLDOWN_DAYS=0  AD_RESHOW_WINDOW_HOURS=0

# 4. Configure web
# web/.env → VITE_API_URL=/api/v1   (relative — Vite proxies to the backend)

# 5. Run migrations and load demo data
cd server && npm run migrate && npm run seed:demo

# 6. Start backend (terminal 1)
npm run dev                     # http://localhost:3000

# 7. Start frontend (terminal 2)
cd ../web && npm run dev        # http://localhost:5173 + Network URL

# 8. Forward Stripe webhooks — required for cashback (terminal 3)
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
```

> ⚠️ If Docker auto-starts an `adearn-server-1` container on port 3000, stop it
> (`docker stop adearn-server-1`) — it's a stale production build. Use the host
> dev server (`npm run dev`) during development.

| Service | URL |
|---|---|
| API | http://localhost:3000 |
| Health check | http://localhost:3000/health |
| Frontend | http://localhost:5173 |
| Public charity ledger | http://localhost:5173/impact |

### 📱 Open on your phone

The Vite dev server binds to the network (`host: true`) and proxies `/api` to the
backend, so no IP configuration is needed in the app:

1. Phone and PC on the **same Wi-Fi**.
2. Allow inbound ports once (admin PowerShell):
   `New-NetFirewallRule -DisplayName "AdEarn Dev" -Direction Inbound -Action Allow -Protocol TCP -LocalPort 3000,5173`
3. Start the frontend — it prints a **Network** URL like `http://192.168.x.x:5173`.
4. Open that URL on the phone. *Add to Home Screen* for the full-screen app feel.

---

## Demo Accounts

Seeded by `npm run seed:demo`. OTP is always `123456` in dev (`OTP_MOCK=true`).
The login page also has **one-click demo buttons** for all three roles.

| Role | Mobile | OTP |
|---|---|---|
| Consumer | 9876543210 | 123456 |
| Advertiser | 9123456789 | 123456 |
| Admin | 9000000000 | 123456 |

> If login says **"Account suspended"**, reinstate the user from Admin → Users.

---

## Demo Flow

End-to-end scenario with the Mamaearth Vitamin C Serum campaign (₹1,499, 3% cashback):

1. Consumer login → OTP `123456`
2. Purchase profile → pick **Health & Beauty**
3. Feed → Mamaearth **video ad** card → *Watch & Shop* → video plays
4. Shop Now → Stripe checkout → `4242 4242 4242 4242` / any future expiry / any CVC
5. Stripe CLI forwards `payment_intent.succeeded` → atomic cashback commits (< 3s)
6. Wallet → pools update live (₹44.97 split 40/30/20/10) + 🔔 notification
7. Transactions → **Rate** the ad (feeds advertiser quality score)
8. Rewards → streak + badges unlock · Insights → charts populate
9. Wallet → **Withdraw** liquid balance to UPI (mocked payout)
10. `/impact` → charity pool grows on the public ledger
11. Advertiser login → 1 conversion · ₹44.97 spend | Admin → financials & audit log

---

## API Reference

Full route table: [`docs/API.md`](docs/API.md) · OpenAPI spec: [`docs/openapi.yaml`](docs/openapi.yaml)

**Base URL:** `/api/v1` · **Auth:** `Authorization: Bearer <JWT>` except `/auth/*`, `/health`, `/charity/impact`

```
Auth:        POST /auth/request-otp · POST /auth/verify-otp
Profile:     GET/PUT /profile · GET/PUT /pool-config
Feed:        GET /feed · POST /feed/:id/view
Attribution: POST /attribution/start · POST /attribution/:id/pay · GET /attribution/:id
Wallet:      GET /wallet · GET /wallet/transactions · POST /wallet/withdraw
Reviews:     POST /reviews
Charity:     GET /charity/impact                    (public)
Advertiser:  POST/GET /advertiser/campaigns · GET …/:id/stats · GET /advertiser/analytics
Admin:       /admin/financials · /admin/fraud-queue · /admin/users · /admin/advertisers · /admin/audit-log
Webhooks:    POST /webhooks/stripe                  (Stripe-Signature only)
```

**Response envelope:** `{ "success": true, "data": … }` / `{ "success": false, "error": { "code", "message" } }`

---

## Testing

```bash
cd server
npm run test:unit          # no infrastructure required
docker compose up -d postgres redis && npm run migrate
npm test                   # integration tests
npm run test:coverage
```

Covers: cashback engine atomicity, fraud scoring, pool distributor integer arithmetic, ad matcher JSONB queries, webhook happy path + idempotency replay, wallet reads.

---

## Deployment

**Backend — Railway:** connect the repo; Railway builds `server/Dockerfile` via `railway.toml`; add PostgreSQL + Redis plugins; set secrets from `server/.env.example`.

**Frontend — Vercel:** import the repo (`web/` dir, `vercel.json`); set `VITE_API_URL` to the Railway API URL and `VITE_STRIPE_PUBLISHABLE_KEY`.

**Load test:** `k6 run server/tests/load/webhook-flood.js` — target 500 webhooks/min, p(95) < 500ms.

---

## Architecture Decisions

| Decision | Rationale |
|---|---|
| Raw `pg`, no ORM | Full SQL control for JSONB overlap queries and atomic financial writes |
| `IPaymentProvider` interface | Stripe → Cashfree/Razorpay swap is a config change, not a rewrite |
| Webhook route before `express.json()` | Stripe signature verification needs the raw body |
| Integer arithmetic (paise) in pool distributor | Floats can't be trusted for money; charity gets the remainder |
| Guarded UPDATE on withdrawals | `WHERE liquid_balance >= amount` makes concurrent cash-outs race-safe |
| Redis SETNX idempotency | Double-processing Stripe events is architecturally impossible |
| HTTP 200 before async webhook processing | Prevents Stripe retry storms |
| Relative `VITE_API_URL` + Vite proxy in dev | Phone/LAN access survives IP changes with zero reconfiguration |
| TanStack Query polling | Live wallet/notification updates without manual state management |

---

*AdEarn — Project 16 · Built by Abhishek K · Stripe test mode → Cashfree/Razorpay at production*
