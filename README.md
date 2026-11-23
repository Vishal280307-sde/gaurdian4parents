# Guardian for Parents 🛡️

A modern family digital-safety, financial fraud detection, and scam prevention platform built with **React 19**, **Vite 8**, **Tailwind CSS**, and **Express.js** backed by **Node.js (`node:sqlite`)** and optional Google Gemini AI.

---

## ⚡ Quick Demo Credentials

When `ENABLE_DEMO_ACCOUNTS=true` (or in development mode), the database automatically seeds demo accounts for instant testing:

| Role | Username | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Parent** | `ramesh_parent` | `GuardianPreview!2026` | Monitored parent dashboard, UPI checks, alerts |
| **Guardian** | `ananya_guardian` | `GuardianPreview!2026` | Family guardian console, transaction approvals |

You can also click **"Open Parent Workspace"** or **"Open Guardian Console"** on the sign-in screen for instant access, or switch to **"Create Account"** to register a new account.

---

## 🚀 How to Deploy

### Option 1: Render (Recommended - Free Web Service)
Render hosts both the Vite frontend and Express API backend as a single service with persistent SQLite support.

1. Fork or push this repository to your GitHub account.
2. Sign in to [Render.com](https://render.com/).
3. Click **New +** > **Blueprint**.
4. Connect this repository — Render will automatically detect `render.yaml`.
5. Click **Apply**.
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Environment:** Node `>= 22.5.0`
6. Once deployed, open your Render URL (e.g. `https://guardian-for-parents.onrender.com`). Both frontend and `/api` routes work with zero configuration!

---

### Option 2: Vercel (Frontend + Serverless API)
Vercel hosts the Vite frontend as static files and runs `api/index.ts` as serverless functions.

1. Sign in to [Vercel](https://vercel.com/) and click **Add New...** > **Project**.
2. Import this repository.
3. Framework Preset will detect **Vite**.
4. In Environment Variables, add:
   - `ENABLE_DEMO_ACCOUNTS`: `true`
   - `GEMINI_API_KEY`: *(optional, your Gemini API key)*
5. Click **Deploy**. Vercel will use `vercel.json` and deploy both the UI and the API.

---

### Option 3: Separate Deployments (e.g. Frontend on Vercel, Backend on Render)
If your frontend and backend run on different domains:
1. Deploy the backend on Render/Railway.
2. Deploy the frontend on Vercel/Netlify.
3. In your frontend environment variables (or `.env`), set:
   ```env
   VITE_API_BASE_URL="https://your-backend-url.onrender.com"
   ```
4. In your backend environment variables, set:
   ```env
   CORS_ORIGINS="https://your-frontend-url.vercel.app"
   ```

---

### Option 4: Docker & Docker Compose
To run in any container runtime (Railway, Fly.io, AWS, DigitalOcean, local):

```bash
# Using Docker Compose
docker compose up -d

# Or using plain Docker
docker build -t guardian-for-parents .
docker run -p 3000:3000 -e ENABLE_DEMO_ACCOUNTS=true guardian-for-parents
```
Visit `http://localhost:3000`.

---

## 💻 Local Development

### Prerequisites
- **Node.js `>= 22.5.0`** (uses built-in `node:sqlite`)

### Setup
```bash
# 1. Clone repository
git clone https://github.com/Vishal280307-sde/gaurdian4parents.git
cd gaurdian4parents

# 2. Copy environment variables
cp .env.example .env

# 3. Install dependencies
npm install

# 4. Start development server (serves frontend & backend on port 3000)
npm run dev
```

Open `http://localhost:3000` in your browser.

---

## 🔧 Fixes Applied for Login 404 & Deployment Issues

1. **API Base URL Support (`src/lib/api.ts`)**: Prepend `VITE_API_BASE_URL` to relative `/api` paths, ensuring API requests reach the backend even when frontend and backend are hosted on different origins.
2. **Vite Development Proxy (`vite.config.ts`)**: Added `/api` and `/health` proxies to `vite.config.ts` so running `vite` or `vite preview` standalone does not return 404 for API calls.
3. **Express 4 SPA Fallback Route (`server.ts`)**: Replaced broken `app.get("/{*path}", ...)` with Express 4 compatible `app.get("*", ...)` so client-side routing and page refreshes work properly.
4. **Production Start Script (`package.json`)**: Configured `"start": "tsx server.ts"` and added server bundling so Node platforms like Render execute the server without TypeScript errors.
5. **Auto-seeding of Demo Accounts (`server/security.ts`)**: Enabled `seedInitialDemoUsersIfEmpty()` to create `ramesh_parent` and `ananya_guardian` accounts so users can log in immediately upon deployment.
6. **Serverless Database Path (`server/db.ts`)**: Made database path resolution fallback to `/tmp/guardian.db` on serverless platforms (e.g. Vercel) where `./data` is read-only.
7. **Deployment Configs**: Added root `render.yaml`, `vercel.json`, `api/index.ts`, `Dockerfile`, and `docker-compose.yml`.
