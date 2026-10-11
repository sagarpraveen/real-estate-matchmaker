from fastapi import APIRouter, Query
from typing import List, Optional
from app.database import get_deck, get_all_vibes, get_property_by_id

router = APIRouter(prefix="/api/properties", tags=["properties"])

@router.get("/deck")
async def fetch_deck(
    min_price: Optional[int] = Query(None),
    max_price: Optional[int] = Query(None),
    vibes: Optional[str] = Query(None),
    commute_dest: Optional[str] = Query("Downtown Tech Core")
):
    selected_vibes = vibes.split(",") if vibes else []
    prefs = {
        "min_price": min_price,
        "max_price": max_price,
        "selected_vibes": selected_vibes,
        "commute_destination": commute_dest
    }
    deck = await get_deck(prefs)
    return {"properties": deck, "count": len(deck)}

@router.get("/vibes")
async def fetch_vibes():
    vibes = await get_all_vibes()
    return {"vibes": vibes}

@router.get("/{property_id}")
async def fetch_property(property_id: str):
    prop = await get_property_by_id(property_id)
    if not prop:
        return {"error": "Property not found"}, 404
    return prop
