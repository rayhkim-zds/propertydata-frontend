import os
import requests
from typing import Optional

BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8000/api/v1/property")
API_KEY = os.getenv("API_KEY", "opendata-guest-2026")

HEADERS = {"X-API-KEY": API_KEY}


def _get(endpoint: str, params: dict) -> Optional[dict]:
    try:
        r = requests.get(f"{BASE_URL}/{endpoint}", params=params, headers=HEADERS, timeout=15)
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


def development_applications(lat: float, lon: float, address: str, radius_m: int = 1000) -> Optional[dict]:
    return _get("da", {"lat": lat, "lon": lon, "address": address, "radius_m": radius_m})
