# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

**Run development server:**
```bash
uvicorn main:app --reload
```

**Run on a specific port:**
```bash
uvicorn main:app --reload --port 8080
```

**Install dependencies:**
```bash
pip install -r requirements.txt
```

**Environment setup:**
Copy `.env.example` to `.env` and configure `BACKEND_URL` and `API_KEY`.

There are no tests and no lint commands configured.

## Architecture

This is a **FastAPI + Vanilla JavaScript** application — a thin proxy frontend over an Australian property data backend API.

### Stack
- **Backend:** FastAPI (Python) with Uvicorn, Jinja2 templates
- **Frontend:** Vanilla JS + HTML/CSS — no build tools, no npm, no framework
- **External backend:** Proxied via `api/client.py` to `BACKEND_URL` (env var)

### Request Flow

1. User types an address → debounced autocomplete via `/api/suggest`
2. User selects an address → `selectAddress(gnafId)` in `static/js/app.js`
3. `/api/property?gnaf_id=...` fetches geocode + property data in one call
4. Eight tab loaders fire in parallel: AI insights, sales data, transport, schools, development applications, title search, bushfire risk, pool/rent detect
5. Each tab hits its own `/api/*` endpoint, which calls `api/client.py` → external backend

### Key Files

- **`main.py`** — FastAPI routes; all `/api/*` endpoints are thin wrappers delegating to `api/client.py`
- **`api/client.py`** — All HTTP calls to the external backend; uses `X-API-KEY` header auth, 15s timeout
- **`static/js/app.js`** — All frontend logic (~800 lines): address search, tab switching, data rendering, markdown parser, Excel export
- **`static/js/mortgage.js`** — Mortgage calculator logic (standalone page)
- **`templates/`** — Jinja2 HTML templates for each page route

### Pages / Routes

| Route | Template | JS |
|---|---|---|
| `/` | `index.html` | `app.js` |
| `/mortgage-calculator` | `mortgage.html` | `mortgage.js` |
| `/developers` | `developers.html` | inline |

### State Management

Global `state` object in `app.js` holds `{ lat, lon, address, gnafId, postcode }` for the currently selected property. No external state library. Tab content is shown/hidden via CSS classes.

### Environment Variables

- `BACKEND_URL` — Base URL for the property data API (e.g. `https://api.propertydataservices.com.au/api/v1/property`)
- `API_KEY` — Passed as `X-API-KEY` header on all backend requests
