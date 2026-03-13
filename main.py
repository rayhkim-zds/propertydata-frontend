from fastapi import FastAPI, Request, Query
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from dotenv import load_dotenv
from api.client import (
    suggest_address, geocode, lookup_property,
    ai_lookup, nearest_transport, nearest_schools,
    development_applications, title_search, cadastre_lookup,
)

load_dotenv()

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
async def da_data(lat: float, lon: float, address: str, radius_m: int = 1000):
    return development_applications(lat, lon, address, radius_m)


@app.get("/api/title-search")
async def title_search_data(gnaf_id: str):
    return title_search(gnaf_id)


@app.get("/api/cadastre")
async def cadastre_data(lat: float, lon: float):
    return cadastre_lookup(lat, lon)
