# PayPilot AI — Agentic Commerce & Payment Assistant

> **Track 1: AI Growth & Agentic Commerce**  
> An autonomous conversational commerce platform powered by Google Gemini, PostgreSQL (Supabase), Express/TypeScript, React/Vite, and Razorpay Standard Checkout & Webhooks.

---

## 🌟 Overview

**PayPilot AI** transforms traditional e-commerce into an intelligent, interactive shopping experience. Customers discover products via natural conversation, compare technical specs side-by-side, manage cart items dynamically, and complete real-time checkout through Razorpay Standard Checkout with cryptographic HMAC-SHA256 server verification and asynchronous webhook lifecycle handling.

---

## 🚀 Key Features

- 🔍 **Natural-Language Product Discovery**: Semantic search and multi-attribute filtering (category, price range, stock, specs) executed by Google Gemini with function calling.
- ⚖️ **Contextual Product Comparison**: Multi-turn conversation awareness allowing users to compare attributes (e.g., "compare the first two", "which has better battery?").
- 🛒 **Conversational Cart Management**: Add, update, view, and remove cart items directly via chat or the interactive slide-over cart drawer.
- 💳 **Razorpay Standard Checkout**: Seamless checkout flow generating server-side Razorpay orders with paise conversion.
- 🔐 **Server-Side Cryptographic Verification**: Tamper-proof HMAC-SHA256 signature verification (`crypto.timingSafeEqual`) guaranteeing payment authenticity.
- ⚡ **Razorpay Webhooks & Lifecycle**: Asynchronous handling of `payment.captured` and `payment.failed` with idempotent `WebhookEvent` logging.
- 📦 **Order Management & History**: Server-authenticated order tracking, line items with historical price snapshots, and payment status badges.
- 📊 **Growth Dashboard & Business Analytics**: Real-time sales telemetry, gross revenue, paid order volume, average order value (AOV), top products, and conversion rates.
- 🛡️ **Session Isolation & Security**: Anonymous cookie-based session management (`paypilot_session`) with strict IDOR protection and rate limiting.

---

## 🏗️ Architecture

```mermaid
graph TD
    User([Shopper / User]) -->|Browser| Frontend[Vercel: React + Vite SPA]
    Frontend -->|REST API + Cookies| Backend[Render: Express + TypeScript API]
    Backend -->|Function Calling| Gemini[Google Gemini 2.5 Flash]
    Backend -->|Prisma ORM / pgBouncer :6543| Supabase[(Supabase PostgreSQL)]
    Frontend -->|Standard Checkout JS| Razorpay[Razorpay Gateway]
    Razorpay -->|Payment Signature| Frontend
    Frontend -->|Verify Signature| Backend
    Razorpay -->|Raw Webhooks : HMAC SHA256| Backend
```

### Tech Stack

| Layer | Technologies |
|---|---|
| **Frontend** | React 18, Vite, TypeScript, Tailwind CSS, Lucide Icons, Axios |
| **Backend** | Node.js, Express, TypeScript, Zod, express-rate-limit, cors |
| **Database & ORM** | PostgreSQL (Supabase), Prisma ORM (Connection Pooler via pgBouncer) |
| **AI Intelligence** | Google Gemini API (`gemini-2.5-flash`), Structured Function Calling |
| **Payments** | Razorpay Standard Checkout (JS SDK), Razorpay Node SDK, HMAC-SHA256 Webhooks |
| **Deployment** | Vercel (Frontend SPA), Render (Backend Web Service), Supabase (Database) |

---

## 📁 Project Structure

```
Razorpay/
├── backend/
│   ├── src/
│   │   ├── ai/               # Gemini system prompt & function tools
│   │   ├── config/           # Validated environment schemas (Zod)
│   │   ├── controllers/      # Route controllers (Cart, Chat, Checkout, Orders, etc.)
│   │   ├── middleware/       # Session, Error, Rate Limiting, Request Logger
│   │   ├── routes/           # REST API endpoints
│   │   ├── schemas/          # Zod request/response validation schemas
│   │   ├── services/         # Business logic, Prisma transactions, Razorpay service
│   │   ├── utils/            # Money utilities, custom error types
│   │   └── index.ts          # Express server entry point
│   ├── tsconfig.json
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── components/       # Chat, Cart, Catalog, Orders, Dashboard components
│   │   ├── lib/              # API client & Razorpay checkout helper
│   │   ├── types/            # TypeScript data contracts
│   │   ├── App.tsx           # Main application view switcher
│   │   └── main.tsx          # React DOM root
│   ├── vercel.json           # Vercel SPA routing rewrite rules
│   └── package.json
├── prisma/
│   ├── migrations/           # Versioned SQL migrations
│   ├── schema.prisma         # Prisma data model
│   └── seed.ts               # Demo catalog seed script
├── DEPLOYMENT.md             # Complete step-by-step production deployment guide
├── walkthrough.md            # Verification results and test suites audit
├── render.yaml               # Render Infrastructure-as-Code Blueprint
└── README.md
```

---

## ⚙️ Environment Variables

### Backend (`backend/.env` / Render Dashboard)

| Variable | Description | Example |
|---|---|---|
| `PORT` | Backend listening port | `10000` (Render default) or `3001` (local) |
| `NODE_ENV` | Environment mode | `production` / `development` / `test` |
| `FRONTEND_URL` | Allowed CORS origin (Vercel URL or local) | `https://paypilot-ai.vercel.app` |
| `DATABASE_URL` | Supabase connection pooler URL (Port 6543) | `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Supabase direct PostgreSQL URL (Port 5432) | `postgresql://postgres.[ref]:[pass]@aws-0-[region].pooler.supabase.com:5432/postgres` |
| `GEMINI_API_KEY` | Google AI Studio API Key | `AIzaSy...` |
| `GEMINI_MODEL` | Gemini model version | `gemini-2.5-flash` |
| `RAZORPAY_KEY_ID` | Razorpay Key ID (Test Mode) | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay Key Secret (**Backend Only**) | `your_secret` |
| `RAZORPAY_WEBHOOK_SECRET` | Secret configured on Razorpay Webhook | `your_webhook_secret` |

> ⚠️ **SECURITY NOTICE**: Never expose `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `GEMINI_API_KEY`, or `DATABASE_URL` to frontend client environments or public repositories.

### Frontend (`frontend/.env` / Vercel Dashboard)

| Variable | Description | Example |
|---|---|---|
| `VITE_API_URL` | Backend URL (no trailing slash) | `https://paypilot-backend.onrender.com` |
| `VITE_RAZORPAY_KEY_ID` | Public Razorpay Key ID | `rzp_test_...` |

---

## 🚦 Local Development Setup

### 1. Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL database instance or Supabase project

### 2. Clone & Install
```bash
git clone https://github.com/santhoshh005/PayPilot_AI.git
cd PayPilot_AI

# Install backend dependencies
cd backend && npm install

# Install frontend dependencies
cd ../frontend && npm install
```

### 3. Database Migration & Seed
```bash
cd backend
npx prisma migrate dev --schema="../prisma/schema.prisma"
npx ts-node ../prisma/seed.ts
```

### 4. Run Locally
```bash
# Start backend (from backend directory)
npm run dev

# Start frontend (from frontend directory in a separate terminal)
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## 🧪 Testing & Quality Assurance

The codebase includes a comprehensive 13-suite automated test suite covering all security, payment verification, session isolation, and regression scenarios:

```bash
cd backend
npm test
```

**Results**:
- **13/13 Test Suites Passing**
- **176/176 Unit, Integration & Security Tests Passing**
- Strict timing-safe HMAC-SHA256 signature verification verified
- Webhook duplicate idempotency verified
- Anonymous session isolation & IDOR prevention verified

---

## 🚢 Production Deployment

Refer to [`DEPLOYMENT.md`](./DEPLOYMENT.md) for full deployment instructions:
1. **Supabase**: Managed PostgreSQL with Connection Pooling (`pgBouncer`).
2. **Render**: Backend Node.js Web Service deployed via `render.yaml` Blueprint.
3. **Vercel**: Frontend React SPA with automatic rewrite rules (`vercel.json`).
4. **Razorpay Dashboard**: Configured for Test Mode with webhook endpoint pointing to `https://<render-url>/api/payment/webhook`.

---

## 📄 License
MIT License. Created for the Razorpay & AI Hackathon / Track 1: AI Growth & Agentic Commerce.
