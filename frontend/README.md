# Savanna Crest Hotel System Frontend

The application shell, dashboard, financial reports, front desk, room rack, housekeeping, POS, cashiering, and property settings are React and TypeScript views. Apache ECharts powers the analytics visualizations. The existing JavaScript hotel store and shared modal workflows remain in place to preserve the operational rules and demo data while the UI migration proceeds.

## Analytics and reporting

- FastAPI, SQLAlchemy, and PostgreSQL remain the API and persistence layer.
- `GET /analytics/overview` returns occupancy and posted ledger activity for a requested period (up to 366 days).
- Sign in with an administrator or accountant account to access live analytics, account activity, trial balance, and CSV export.
- The ledger currently stores account codes without chart-of-accounts categories. The reporting UI shows real source balances and does not guess account types to fabricate a P&L or balance sheet.
- When the backend is unavailable, operational screens continue in local demo mode; the dashboard identifies demo metrics as such.

## Run for development

Install dependencies:

```powershell
cd frontend
npm install
```

Start the FastAPI backend from `backend/`, then run Vite:

```powershell
cd frontend
npm run dev
```

Open the URL reported by Vite (default `http://127.0.0.1:5173`). Vite proxies API requests to `http://localhost:8000`.

## Build and serve

Create production assets:

```powershell
cd frontend
npm run build
```

Vite writes the build to `frontend/dist`. FastAPI serves this directory at `/` when it exists. Start the API with:

```powershell
cd backend
uvicorn app.main:app --reload
```

## Deploy to Netlify

The repository root contains `netlify.toml`, which configures Netlify to build the `frontend/` project and publish `frontend/dist`. Netlify can serve the interface as a static site, but it does not host the FastAPI/PostgreSQL backend. Without a backend, the app opens in local demo mode.

To connect a separately deployed API, set the Netlify environment variable `VITE_API_URL` to the backend's public origin (for example, `https://api.example.com`, without a trailing slash), then trigger a new deploy. Configure the backend's `CORS_ORIGINS` to include the Netlify site origin. Changes to Vite environment variables take effect at build time.
