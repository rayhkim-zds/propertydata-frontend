# propertydata-frontend

Thin proxy frontend for the Australian property data backend. Built with FastAPI + Vanilla JavaScript — no build tools, no npm, no framework.

## Running locally

```bash
uvicorn main:app --reload
```

Or on a specific port:

```bash
uvicorn main:app --reload --port 8080
```

## Installing dependencies

```bash
pip install -r requirements.txt
```

## Environment variables (.env)

Copy `.env.example` to `.env`.

| Variable          | Description                                                                   |
|-------------------|-------------------------------------------------------------------------------|
| `BACKEND_URL`     | Base URL for the property data API (e.g. `https://api.example.com/api/v1/property`) |
| `API_KEY`         | API key passed as `X-API-KEY` on all backend requests                         |
| `TEMP_PASSWORD`   | HTTP Basic Auth password for the `/temp` preview route (required)             |
| `ALLOWED_ORIGINS` | Comma-separated CORS allowed origins (optional)                               |

## Project structure

```
main.py           # FastAPI app — page routes + API proxy endpoints
api/
  client.py       # All HTTP calls to the backend (httpx, 15s timeout, X-API-KEY auth)
templates/
  coming-soon.html  # Public landing page (served at /)
  index.html        # Main property search UI (served at /temp, Basic Auth protected)
  developers.html   # Developer/API docs page
  mortgage.html     # Mortgage calculator page
  partials/         # Shared template fragments
static/
  js/
    app.js          # All property search frontend logic (~800 lines)
    mortgage.js     # Mortgage calculator logic
  css/              # Stylesheets
  images/           # Static images
```

## Pages

| Route                | Auth          | Description                        |
|----------------------|---------------|------------------------------------|
| `/`                  | Public        | Coming soon landing page           |
| `/temp`              | HTTP Basic    | Full property search UI (preview)  |
| `/developers`        | Public        | Developer docs / API reference     |
| `/mortgage-calculator` | Public      | Mortgage repayment calculator      |

## Architecture

The app is a proxy layer — it exposes `/api/*` endpoints that delegate to the external backend via `api/client.py`. No business logic lives here.

**Request flow for property search:**

1. User types an address → debounced autocomplete via `/api/suggest`
2. User selects an address → `selectAddress(gnafId)` fires in `app.js`
3. `/api/property?gnaf_id=...` fetches geocode + basic property data
4. Eight tab loaders fire in parallel: AI insights, sales data, transport, schools, development applications, title search, bushfire risk, pool/rent detect

Each tab hits its own `/api/*` endpoint → `api/client.py` → external backend.

## API proxy routes

All routes proxy to the backend. Rate-limited at 60 requests/minute per IP (30/min for suggest).

| Route                   | Proxies to backend                |
|-------------------------|-----------------------------------|
| `/api/suggest`          | `/address-suggest`                |
| `/api/property`         | `/geocode` + `/lookup`            |
| `/api/ai`               | `/ai-lookup`                      |
| `/api/transport`        | `/nearest-transport`              |
| `/api/schools`          | `/nearest-schools`                |
| `/api/da`               | `/da`                             |
| `/api/title-search`     | `/title-search`                   |
| `/api/cadastre`         | `/cadastre`                       |
| `/api/landsize`         | `/landsize`                       |
| `/api/property-map`     | `/property-map`                   |
| `/api/rental-bond-summary` | `/rental-bond-summary`         |
| `/api/bushfire-risk`    | `/bushfire-risk`                  |
| `/api/flood-risk`       | `/flood-risk`                     |
| `/api/zoning`           | `/zoning`                         |
| `/api/strata`           | `/strata`                         |
| `/api/strata-simple`    | `/strata-simple`                  |
| `/api/sales-data`       | `/sales-data`                     |
| `/api/pool-detect`      | `/pool-detect`                    |
| `/api/rent-detect`      | `/rent-detect`                    |
| `/api/mortgage-quote`   | `/api/v1/mortgage/mortgage-quote` |
