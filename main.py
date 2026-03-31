from dotenv import load_dotenv
load_dotenv()

import os
import secrets
from fastapi import FastAPI, Request, Query, Depends, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.security import HTTPBasic, HTTPBasicCredentials
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from api.client import (
    suggest_address, geocode, lookup_property,
    ai_lookup, nearest_transport, nearest_schools,
    development_applications, title_search, cadastre_lookup,
    rental_bond_summary, landsize_lookup, property_map_html,
    bushfire_risk, flood_risk, sales_data, pool_detect, rent_detect,
    mortgage_quote, zoning_lookup, strata_lookup, strata_simple_lookup,
)

# ── Rate limiting ─────────────────────────────────────────────────────────────
def _rate_key(request: Request) -> str:
    return request.client.host if request.client else "unknown"

limiter = Limiter(key_func=_rate_key, default_limits=["60/minute"])

app = FastAPI(title="PropertyData Frontend", docs_url=None, redoc_url=None, openapi_url=None)
app.state.limiter = limiter
app.add_middleware(SlowAPIMiddleware)

@app.exception_handler(RateLimitExceeded)
async def _rate_limit_handler(request: Request, exc: RateLimitExceeded):
    return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Please slow down."})

# ── CORS ──────────────────────────────────────────────────────────────────────
_raw_origins = os.getenv("ALLOWED_ORIGINS", "")
_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

# ── Static / templates ────────────────────────────────────────────────────────
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")

# ── Temp basic-auth gate ──────────────────────────────────────────────────────
security = HTTPBasic()
_TEMP_PASSWORD = os.getenv("TEMP_PASSWORD", "")
if not _TEMP_PASSWORD:
    raise RuntimeError("TEMP_PASSWORD environment variable is required but not set")

def verify_temp_password(credentials: HTTPBasicCredentials = Depends(security)):
    correct = secrets.compare_digest(credentials.password.encode(), _TEMP_PASSWORD.encode())
    if not correct:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect password",
            headers={"WWW-Authenticate": "Basic"},
        )


# ── Page routes ───────────────────────────────────────────────────────────────

@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse(request, "coming-soon.html")

@app.get("/coming-soon", response_class=HTMLResponse)
async def coming_soon(request: Request):
    return templates.TemplateResponse(request, "coming-soon.html")

@app.get("/temp", response_class=HTMLResponse)
async def temp(request: Request, _: None = Depends(verify_temp_password)):
    return templates.TemplateResponse(request, "index.html")

@app.get("/developers", response_class=HTMLResponse)
async def developers(request: Request):
    return templates.TemplateResponse(request, "developers.html")

@app.get("/mortgage-calculator", response_class=HTMLResponse)
async def mortgage_calculator(request: Request):
    return templates.TemplateResponse(request, "mortgage.html")


# ── API proxy routes ──────────────────────────────────────────────────────────

@app.get("/api/suggest")
@limiter.limit("30/minute")
async def suggest(request: Request, q: str = Query(..., min_length=3, max_length=200)):
    return await suggest_address(q)


@app.get("/api/property")
@limiter.limit("30/minute")
async def property_data(request: Request, gnaf_id: str = Query(..., min_length=1, max_length=50)):
    geo = await geocode(gnaf_id)
    if not geo or "error" in geo:
        return JSONResponse({"error": geo.get("error", "Geocode failed")}, status_code=400)

    lat, lon = geo["lat"], geo["lon"]
    address = geo["display_name"]
    suburb = geo["suburb"]
    postcode = geo["postcode"]
    state = geo["state"]

    prop = await lookup_property(lat, lon, address, suburb, postcode, state)

    return {
        "geo": geo,
        "property": prop,
    }


@app.get("/api/ai")
@limiter.limit("10/minute")
async def ai_data(request: Request, lat: float, lon: float, address: str = Query(..., max_length=300)):
    return await ai_lookup(lat, lon, address)


@app.get("/api/transport")
@limiter.limit("20/minute")
async def transport_data(request: Request, lat: float, lon: float, address: str = Query(..., max_length=300), radius_m: int = Query(default=1000, ge=100, le=5000)):
    return await nearest_transport(lat, lon, address, radius_m)


@app.get("/api/schools")
@limiter.limit("20/minute")
async def schools_data(request: Request, lat: float, lon: float, address: str = Query(..., max_length=300), radius_m: int = Query(default=2000, ge=100, le=10000)):
    return await nearest_schools(lat, lon, address, radius_m)


@app.get("/api/da")
@limiter.limit("20/minute")
async def da_data(request: Request, address: str = Query(..., max_length=300), postcode: str = Query(..., min_length=4, max_length=4)):
    return await development_applications(address, postcode)


@app.get("/api/title-search")
@limiter.limit("20/minute")
async def title_search_data(request: Request, gnaf_id: str = Query(..., min_length=1, max_length=50)):
    return await title_search(gnaf_id)


@app.get("/api/cadastre")
@limiter.limit("20/minute")
async def cadastre_data(request: Request, lat: float, lon: float):
    return await cadastre_lookup(lat, lon)


@app.get("/api/landsize")
@limiter.limit("20/minute")
async def landsize_data(request: Request, lot: str = Query(..., max_length=20), plan: str = Query(..., max_length=20)):
    return await landsize_lookup(lot, plan)


@app.get("/api/property-map", response_class=HTMLResponse)
@limiter.limit("20/minute")
async def property_map(request: Request, lot: str = Query(..., max_length=20), plan: str = Query(..., max_length=20)):
    html = await property_map_html(lot, plan)
    if not html:
        return HTMLResponse("<p>Map unavailable. Check backend connection.</p>", status_code=502)
    return HTMLResponse(html)


@app.get("/api/rental-bond-summary")
@limiter.limit("20/minute")
async def rental_bond_data(request: Request, postcode: str = Query(..., min_length=4, max_length=4)):
    return await rental_bond_summary(postcode)


@app.get("/api/bushfire-risk")
@limiter.limit("20/minute")
async def bushfire_risk_data(request: Request, lat: float, lon: float):
    return await bushfire_risk(lat, lon)


@app.get("/api/flood-risk")
@limiter.limit("20/minute")
async def flood_risk_data(request: Request, lat: float, lon: float, address: str = Query(..., max_length=300)):
    return await flood_risk(lat, lon, address)


@app.get("/api/zoning")
@limiter.limit("20/minute")
async def zoning_data(request: Request, lat: float, lon: float):
    return await zoning_lookup(lat, lon)


@app.get("/api/strata")
@limiter.limit("20/minute")
async def strata_data(request: Request, lot: str = Query(..., max_length=20), plan: str = Query(..., max_length=20)):
    return await strata_lookup(lot, plan)


@app.get("/api/strata-simple")
@limiter.limit("20/minute")
async def strata_simple_data(request: Request, lat: float, lon: float, address: str = Query(..., max_length=300)):
    return await strata_simple_lookup(lat, lon, address)


@app.get("/api/sales-data")
@limiter.limit("20/minute")
async def sales_data_route(request: Request, postcode: int, date_from: int, date_to: int):
    return await sales_data(postcode, date_from, date_to)


@app.get("/api/pool-detect")
@limiter.limit("20/minute")
async def pool_detect_data(request: Request, lat: float, lon: float, address: str = Query(..., max_length=300)):
    return await pool_detect(lat, lon, address)


@app.get("/api/rent-detect")
@limiter.limit("20/minute")
async def rent_detect_data(request: Request, lat: float, lon: float, address: str = Query(..., max_length=300)):
    return await rent_detect(lat, lon, address)


@app.post("/api/mortgage-quote")
@limiter.limit("20/minute")
async def mortgage_quote_route(request: Request):
    payload = await request.json()
    return await mortgage_quote(payload)
