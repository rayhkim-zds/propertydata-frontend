import os
from typing import Optional

import httpx

BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8000/api/v1/property")
API_KEY = os.getenv("API_KEY", "")
if not API_KEY:
    raise RuntimeError("API_KEY environment variable is required but not set")

HEADERS = {"X-API-KEY": API_KEY}

_BACKEND_ROOT = BASE_URL.rsplit("/property", 1)[0]  # e.g. http://localhost:8000/api/v1
MORTGAGE_BASE = f"{_BACKEND_ROOT}/mortgage"


async def _get(endpoint: str, params: dict) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(f"{BASE_URL}/{endpoint}", params=params, headers=HEADERS)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        return {"error": f"HTTP {e.response.status_code}: {e.response.text}"}
    except Exception as e:
        return {"error": str(e)}


async def _post(url: str, payload: dict) -> Optional[dict]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.post(url, json=payload, headers=HEADERS)
        r.raise_for_status()
        return r.json()
    except httpx.HTTPStatusError as e:
        return {"error": f"HTTP {e.response.status_code}: {e.response.text}"}
    except Exception as e:
        return {"error": str(e)}


async def suggest_address(q: str) -> list[dict]:
    if len(q) < 3:
        return []
    result = await _get("address-suggest", {"q": q})
    if isinstance(result, list):
        return result
    return []


async def geocode(gnaf_id: str) -> Optional[dict]:
    return await _get("geocode", {"gnaf_id": gnaf_id})


async def lookup_property(lat: float, lon: float, address: str, suburb: str, postcode: str, state: str) -> Optional[dict]:
    return await _get("lookup", {
        "lat": lat, "lon": lon,
        "address": address, "suburb": suburb,
        "postcode": postcode, "state": state,
    })


async def ai_lookup(lat: float, lon: float, address: str) -> Optional[dict]:
    return await _get("ai-lookup", {"lat": lat, "lon": lon, "address": address})


async def nearest_transport(lat: float, lon: float, address: str, radius_m: int = 1000) -> Optional[dict]:
    return await _get("nearest-transport", {"lat": lat, "lon": lon, "address": address, "radius_m": radius_m})


async def nearest_schools(lat: float, lon: float, address: str, radius_m: int = 2000) -> Optional[dict]:
    return await _get("nearest-schools", {"lat": lat, "lon": lon, "address": address, "radius_m": radius_m})


async def development_applications(address: str, postcode: str) -> Optional[dict]:
    return await _get("da", {"address": address, "postcode": postcode})


async def title_search(gnaf_id: str) -> Optional[dict]:
    return await _get("title-search", {"gnaf_id": gnaf_id})


async def cadastre_lookup(lat: float, lon: float) -> Optional[dict]:
    return await _get("cadastre", {"lat": lat, "lon": lon})


async def landsize_lookup(lot: str, plan: str) -> Optional[dict]:
    return await _get("landsize", {"lot": lot, "plan": plan})


async def property_map_html(lot: str, plan: str) -> Optional[str]:
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(f"{BASE_URL}/property-map", params={"lot": lot, "plan": plan}, headers=HEADERS)
        r.raise_for_status()
        return r.text
    except Exception:
        return None


async def rental_bond_summary(postcode: str) -> Optional[dict]:
    return await _get("rental-bond-summary", {"postcode": postcode})


async def bushfire_risk(lat: float, lon: float) -> Optional[dict]:
    return await _get("bushfire-risk", {"lat": lat, "lon": lon})


async def flood_risk(lat: float, lon: float, address: str) -> Optional[dict]:
    return await _get("flood-risk", {"lat": lat, "lon": lon, "address": address})


async def zoning_lookup(lat: float, lon: float) -> Optional[dict]:
    return await _get("zoning", {"lat": lat, "lon": lon})


async def strata_lookup(lot: str, plan: str) -> Optional[dict]:
    return await _get("strata", {"lot": lot, "plan": plan})


async def strata_simple_lookup(lat: float, lon: float, address: str) -> Optional[dict]:
    return await _get("strata-simple", {"lat": lat, "lon": lon, "address": address})


async def pool_detect(lat: float, lon: float, address: str) -> Optional[dict]:
    return await _get("pool-detect", {"lat": lat, "lon": lon, "address": address})


async def rent_detect(lat: float, lon: float, address: str) -> Optional[dict]:
    return await _get("rent-detect", {"lat": lat, "lon": lon, "address": address})


async def sales_data(postcode: int, date_from: int, date_to: int) -> Optional[dict]:
    return await _get("sales-data", {"postcode": postcode, "date_from": date_from, "date_to": date_to})


async def mortgage_quote(payload: dict) -> Optional[dict]:
    return await _post(f"{MORTGAGE_BASE}/mortgage-quote", payload)
