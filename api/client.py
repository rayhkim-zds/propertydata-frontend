import os
import requests
from typing import Optional

BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8000/api/v1/property")
API_KEY = os.getenv("API_KEY", "opendata-guest-2026")

HEADERS = {"X-API-KEY": API_KEY}

_BACKEND_ROOT = BASE_URL.rsplit("/property", 1)[0]  # e.g. http://localhost:8000/api/v1
MORTGAGE_BASE = f"{_BACKEND_ROOT}/mortgage"


def _get(endpoint: str, params: dict) -> Optional[dict]:
    try:
        r = requests.get(f"{BASE_URL}/{endpoint}", params=params, headers=HEADERS, timeout=15)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.HTTPError as e:
        return {"error": f"HTTP {e.response.status_code}: {e.response.text}"}
    except Exception as e:
        return {"error": str(e)}


def _post(url: str, payload: dict) -> Optional[dict]:
    try:
        r = requests.post(url, json=payload, headers=HEADERS, timeout=15)
        r.raise_for_status()
        return r.json()
    except requests.exceptions.HTTPError as e:
        return {"error": f"HTTP {e.response.status_code}: {e.response.text}"}
    except Exception as e:
        return {"error": str(e)}


def suggest_address(q: str) -> list[dict]:
    if len(q) < 3:
        return []
    result = _get("address-suggest", {"q": q})
    if isinstance(result, list):
        return result
    return []


def geocode(gnaf_id: str) -> Optional[dict]:
    return _get("geocode", {"gnaf_id": gnaf_id})


def lookup_property(lat: float, lon: float, address: str, suburb: str, postcode: str, state: str) -> Optional[dict]:
    return _get("lookup", {
        "lat": lat, "lon": lon,
        "address": address, "suburb": suburb,
        "postcode": postcode, "state": state,
    })


def ai_lookup(lat: float, lon: float, address: str) -> Optional[dict]:
    return _get("ai-lookup", {"lat": lat, "lon": lon, "address": address})


def nearest_transport(lat: float, lon: float, address: str, radius_m: int = 1000) -> Optional[dict]:
    return _get("nearest-transport", {"lat": lat, "lon": lon, "address": address, "radius_m": radius_m})


def nearest_schools(lat: float, lon: float, address: str, radius_m: int = 2000) -> Optional[dict]:
    return _get("nearest-schools", {"lat": lat, "lon": lon, "address": address, "radius_m": radius_m})


def development_applications(address: str, postcode: str) -> Optional[dict]:
    return _get("da", {"address": address, "postcode": postcode})


def title_search(gnaf_id: str) -> Optional[dict]:
    return _get("title-search", {"gnaf_id": gnaf_id})


def cadastre_lookup(lat: float, lon: float) -> Optional[dict]:
    return _get("cadastre", {"lat": lat, "lon": lon})


def landsize_lookup(lot: str, plan: str) -> Optional[dict]:
    return _get("landsize", {"lot": lot, "plan": plan})


def property_map_html(lot: str, plan: str) -> Optional[str]:
    """Fetch the property map HTML page from the backend."""
    try:
        r = requests.get(f"{BASE_URL}/property-map", params={"lot": lot, "plan": plan}, headers=HEADERS, timeout=15)
        r.raise_for_status()
        return r.text
    except Exception:
        return None


def rental_bond_summary(postcode: str) -> Optional[dict]:
    return _get("rental-bond-summary", {"postcode": postcode})


def bushfire_risk(lat: float, lon: float) -> Optional[dict]:
    return _get("bushfire-risk", {"lat": lat, "lon": lon})


def zoning_lookup(lat: float, lon: float) -> Optional[dict]:
    return _get("zoning", {"lat": lat, "lon": lon})


def pool_detect(lat: float, lon: float, address: str) -> Optional[dict]:
    return _get("pool-detect", {"lat": lat, "lon": lon, "address": address})


def rent_detect(lat: float, lon: float, address: str) -> Optional[dict]:
    return _get("rent-detect", {"lat": lat, "lon": lon, "address": address})


def sales_data(postcode: int, date_from: int, date_to: int) -> Optional[dict]:
    return _get("sales-data", {"postcode": postcode, "date_from": date_from, "date_to": date_to})


def mortgage_quote(payload: dict) -> Optional[dict]:
    return _post(f"{MORTGAGE_BASE}/mortgage-quote", payload)
