# PayPilot AI — Production Deployment Guide

This guide details the step-by-step procedure for deploying **PayPilot AI (Agentic Commerce & Payment Assistant)** to production using:
- **Frontend**: [Vercel](https://vercel.com) (React 18 / Vite SPA)
- **Backend**: [Render](https://render.com) (Node.js / Express / TypeScript Web Service)
- **Database**: [Supabase](https://supabase.com) (Managed PostgreSQL + Prisma ORM)
- **AI Intelligence**: [Google Gemini API](https://aistudio.google.com) (Gemini 2.5 Flash backend-only)
- **Payment Gateway**: [Razorpay](https://razorpay.com) (Test Mode Standard Checkout + Webhooks)

---

## 1. Deployment Architecture

```text
┌───────────────────────────────┐
│     Vercel (Frontend SPA)     │
│   React + Vite + Tailwind     │
│    https://<app>.vercel.app   │
└──────────────┬────────────────┘
               │ HTTPS (X-Session-Id, API calls)
               ▼
┌───────────────────────────────┐        ┌────────────────────────────┐
│      Render (Backend API)     │◄───────┤    Razorpay Webhooks       │
│    Express + TypeScript       │        │  POST /api/payment/webhook │
│  https://<api>.onrender.com   │        └────────────────────────────┘
└──────┬────────────────┬───────┘
       │                │
       │ Prisma ORM     │ SDK (Server-Side Only)
       ▼                ▼
┌──────────────┐ ┌──────────────┐
│   Supabase   │ │ Google AI    │
│  PostgreSQL  │ │ Gemini Flash │
└──────────────┘ └──────────────┘
```

---

## 2. Environment Variables Specification

### Backend Variables (Render Environment)

| Variable Name | Required | Description | Example / Format |
|---|---|---|---|
| `PORT` | Yes | Port for Express server | `10000` (Render default) or `3001` |
| `NODE_ENV` | Yes | Environment mode | `production` |
| `FRONTEND_URL` | Yes | Allowed CORS origin (Vercel domain) | `https://your-app.vercel.app` |
| `DATABASE_URL` | Yes | Supabase connection pooler URL (port 6543) | `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:6543/postgres?pgbouncer=true` |
| `DIRECT_URL` | Yes | Supabase direct connection URL (port 5432) | `postgresql://postgres.[REF]:[PASSWORD]@aws-0-[REGION].pooler.supabase.com:5432/postgres` |
| `GEMINI_API_KEY` | Yes | Google AI Studio API Key | `AIzaSy...` |
| `GEMINI_MODEL` | No | Gemini model designation | `gemini-2.5-flash` |
| `RAZORPAY_KEY_ID` | Yes | Razorpay Test Mode Key ID | `rzp_test_...` |
| `RAZORPAY_KEY_SECRET` | Yes | Razorpay Test Mode Secret (Backend Only!) | `your_key_secret` |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Razorpay Webhook Secret (Backend Only!) | `your_webhook_secret` |

> [!CAUTION]
> `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `GEMINI_API_KEY`, and `DATABASE_URL` must **NEVER** be provided to the frontend or committed into version control.

### Frontend Variables (Vercel Environment)

| Variable Name | Required | Description | Example / Format |
|---|---|---|---|
| `VITE_API_URL` | Yes | Base URL to Render backend API | `https://your-backend.onrender.com/api` |
| `VITE_RAZORPAY_KEY_ID` | Yes | Razorpay Test Mode Key ID (Public Key) | `rzp_test_...` |

---

## 3. Database Setup (Supabase PostgreSQL)

1. **Create Supabase Project**:
   - Create a project at [database.new](https://database.new) or in your Supabase dashboard.
   - Note the database password set during project creation.
2. **Retrieve Connection Strings**:
   - In Supabase, navigate to **Project Settings → Database → Connection String**.
   - Copy the **URI (Session mode / Direct connection, Port 5432)** for `DIRECT_URL`.
   - Copy the **URI (Transaction mode / Pooler connection, Port 6543)** with `?pgbouncer=true` for `DATABASE_URL`.
3. **Run Migrations & Seed Data**:
   From your local development machine:
   ```bash
   npx prisma migrate deploy --schema="./prisma/schema.prisma"
   npm --prefix backend run seed
   ```
   This initializes all schema tables (`products`, `sessions`, `carts`, `cart_items`, `orders`, `order_items`, `webhook_events`, `conversations`, `messages`) and populates the audio/electronics product catalog.

---

## 4. Backend Deployment (Render)

### Option A: Using Blueprint (`render.yaml`)
1. Connect your repository to Render.
2. Click **New → Blueprint** and select your repository.
3. Render reads `render.yaml` and configures the `paypilot-backend` service.
4. In the Render Dashboard, fill in the secret environment variables (`DATABASE_URL`, `DIRECT_URL`, `GEMINI_API_KEY`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `FRONTEND_URL`).

### Option B: Manual Web Service Setup
1. In Render, click **New → Web Service**.
2. Select repository and set:
   - **Name**: `paypilot-backend`
   - **Root Directory**: `backend`
   - **Runtime**: `Node`
   - **Build Command**: `npm install && npx prisma migrate deploy --schema=../prisma/schema.prisma && npm run build`
   - **Start Command**: `npm start`
   - **Health Check Path**: `/api/health`
3. Under **Environment Variables**, add the variables specified in Section 2.
4. Deploy the service and note your backend URL: `https://<service-name>.onrender.com`.

---

## 5. Frontend Deployment (Vercel)

1. Connect your GitHub repository to [Vercel](https://vercel.com).
2. Click **Add New Project** and configure:
   - **Framework Preset**: `Vite`
   - **Root Directory**: `frontend`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add **Environment Variables**:
   - `VITE_API_URL`: `https://<your-render-backend-domain>.onrender.com/api`
   - `VITE_RAZORPAY_KEY_ID`: `rzp_test_...`
4. Click **Deploy**.
5. Note your deployed frontend domain: `https://<project-name>.vercel.app`.
6. Return to Render and update `FRONTEND_URL` to match this Vercel domain.

> [!NOTE]
> Client-side SPA routing fallback is handled automatically by [`frontend/vercel.json`](file:///c:/Users/saisa/Documents/Razorpay/frontend/vercel.json) ensuring direct navigation to `/orders` or `/dashboard` never produces a 404 error.

---

## 6. Razorpay Test Mode & Webhook Configuration

1. **Obtain Test Mode Credentials**:
   - Log in to the [Razorpay Dashboard](https://dashboard.razorpay.com).
   - Ensure the mode toggle is switched to **Test Mode** (orange badge in top navigation).
   - Navigate to **Account & Settings → API Keys**.
   - Generate Key ID (`rzp_test_...`) and Key Secret.
2. **Configure Webhook**:
   - In Razorpay Dashboard, navigate to **Account & Settings → Webhooks**.
   - Click **Add New Webhook**.
   - **Webhook URL**: `https://<your-render-backend-domain>.onrender.com/api/payment/webhook` (must use HTTPS).
   - **Secret**: Enter a strong random string (e.g. 32-character hexadecimal string).
   - Set this exact secret as `RAZORPAY_WEBHOOK_SECRET` in Render.
   - **Active Events**: Check ONLY the events handled by PayPilot:
     - `payment.captured`
     - `payment.failed`
   - Click **Create Webhook**.
3. **Verify Webhook Delivery**:
   - Make a test purchase in the app.
   - In the Razorpay Dashboard, click on your webhook to view the event delivery logs, request payload, response status (`200 OK`), and HMAC signature.

---

## 7. Google Gemini API Configuration

1. **Obtain API Key**:
   - Visit [Google AI Studio](https://aistudio.google.com).
   - Click **Get API Key** and create a project key.
2. **Configure in Render**:
   - Set `GEMINI_API_KEY` in Render environment variables.
   - Default model is `gemini-2.5-flash` for high-speed multi-turn tool calling.
3. **Safety & Fallback**:
   - If the Gemini API key is missing or quota is exhausted, PayPilot AI automatically falls back to its deterministic conversational resolution engine, ensuring uninterrupted demo and shopping cart operation.

---

## 8. Health Check & Deployment Verification

1. **Verify Backend Health**:
   ```bash
   curl -i https://<your-render-backend-domain>.onrender.com/api/health
   ```
   **Expected Response (`HTTP 200 OK`)**:
   ```json
   {
     "success": true,
     "data": {
       "status": "ok",
       "service": "paypilot-backend",
       "timestamp": "2026-09-05T...",
       "uptime": 45,
       "environment": "production",
       "database": "connected"
     }
   }
   ```
2. **Verify Frontend UI**:
   - Visit `https://<your-app>.vercel.app`.
   - Confirm the live backend status indicator pill in the header shows "Backend Connected".
   - Test AI search: *"Find earbuds under ₹2500"*.
   - Test cart: Add product to cart and adjust quantity.
   - Test checkout: Launch Razorpay Standard Checkout in Test Mode and simulate payment using Razorpay test credentials.
   - Confirm order receipt modal appears with status `PAID`.
   - Confirm Growth Dashboard updates revenue and order metrics.

---

## 9. Security Notes

- **CORS Protection**: The backend accepts requests only from configured `FRONTEND_URL` origins and rejects unauthorized cross-origin requests.
- **HMAC-SHA256 Verification**: Payments and webhooks are verified using cryptographic timing-safe buffer comparison (`crypto.timingSafeEqual`) to prevent timing attacks.
- **Server-Authoritative Pricing**: All item prices and totals are computed strictly from the PostgreSQL database, ignoring client-supplied monetary fields.
- **IDOR Protection**: Order history and receipts are strictly isolated by session identifier; unauthorized queries return HTTP 404 with zero data leakage.
- **Rate Limiting**: In-memory general rate limiting (200 requests / 15 minutes) and sensitive rate limiting (30 requests / minute for AI and checkout) operate continuously in production.

---

## 10. Troubleshooting

| Issue | Root Cause | Solution |
|---|---|---|
| CORS Error in browser console | `FRONTEND_URL` in Render doesn't match Vercel origin | Ensure `FRONTEND_URL` matches your Vercel URL exactly without trailing slash (e.g. `https://paypilot.vercel.app`). |
| `database: disconnected` on `/api/health` | Incorrect `DATABASE_URL` or network block | Verify Supabase connection string and ensure pooling mode (`?pgbouncer=true`) is active on port 6543. |
| Razorpay Checkout won't open | `VITE_RAZORPAY_KEY_ID` missing or invalid | Ensure key starts with `rzp_test_` and rebuild frontend on Vercel. |
| Webhook returns HTTP 400 | `RAZORPAY_WEBHOOK_SECRET` mismatch | Ensure webhook secret in Razorpay Dashboard exactly matches `RAZORPAY_WEBHOOK_SECRET` in Render. |
| 404 on page refresh in Vercel | Missing SPA fallback configuration | Verify `frontend/vercel.json` exists with rewrite rule to `/index.html`. |
