from dotenv import load_dotenv
load_dotenv()

from fastapi import FastAPI, Request, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from api.client import (
    suggest_address, geocode, lookup_property,
    ai_lookup, nearest_transport, nearest_schools,
    development_applications, title_search, cadastre_lookup,
    rental_bond_summary, landsize_lookup, property_map_html,
    bushfire_risk,
)

app = FastAPI(title="PropertyData Frontend")
app.mount("/static", StaticFiles(directory="static"), name="static")
templates = Jinja2Templates(directory="templates")


@app.get("/", response_class=HTMLResponse)
async def index(request: Request):
    return templates.TemplateResponse("index.html", {"request": request})


@app.get("/developers", response_class=HTMLResponse)
async def developers(request: Request):
    return templates.TemplateResponse("developers.html", {"request": request})


@app.get("/api/suggest")
async def suggest(q: str = Query(..., min_length=3)):
    return suggest_address(q)


@app.get("/api/property")
async def property_data(gnaf_id: str):
    geo = geocode(gnaf_id)
    if not geo or "error" in geo:
        return JSONResponse({"error": geo.get("error", "Geocode failed")}, status_code=400)

    lat, lon = geo["lat"], geo["lon"]
    address = geo["display_name"]
    suburb = geo["suburb"]
    postcode = geo["postcode"]
    state = geo["state"]

    prop = lookup_property(lat, lon, address, suburb, postcode, state)

    return {
        "geo": geo,
        "property": prop,
    }


@app.get("/api/ai")
async def ai_data(lat: float, lon: float, address: str):
    return ai_lookup(lat, lon, address)


@app.get("/api/transport")
async def transport_data(lat: float, lon: float, address: str, radius_m: int = 1000):
    return nearest_transport(lat, lon, address, radius_m)


@app.get("/api/schools")
async def schools_data(lat: float, lon: float, address: str, radius_m: int = 2000):
    return nearest_schools(lat, lon, address, radius_m)


@app.get("/api/da")
async def da_data(postcode: str, status: str = None, days: int = None, limit: int = 100):
    return development_applications(postcode, status=status, days=days, limit=limit)


@app.get("/api/title-search")
async def title_search_data(gnaf_id: str):
    return title_search(gnaf_id)


@app.get("/api/cadastre")
async def cadastre_data(lat: float, lon: float):
    return cadastre_lookup(lat, lon)


@app.get("/api/landsize")
async def landsize_data(lot: str, plan: str):
    return landsize_lookup(lot, plan)


@app.get("/api/property-map", response_class=HTMLResponse)
async def property_map(lot: str, plan: str):
    html = property_map_html(lot, plan)
    if not html:
        return HTMLResponse("<p>Map unavailable. Check backend connection.</p>", status_code=502)
    return HTMLResponse(html)


@app.get("/api/rental-bond-summary")
async def rental_bond_data(postcode: str):
    return rental_bond_summary(postcode)


@app.get("/api/bushfire-risk")
async def bushfire_risk_data(lat: float, lon: float):
    return bushfire_risk(lat, lon)
