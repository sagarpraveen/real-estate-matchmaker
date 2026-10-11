from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.models import SwipeAction
from app.database import record_swipe, undo_last_swipe, reset_swipes, get_matches, get_property_by_id

router = APIRouter(prefix="/api/matches", tags=["matches"])

@router.post("/swipe")
async def handle_swipe(payload: SwipeAction):
    if payload.action not in ["like", "superlike", "pass"]:
        raise HTTPException(status_code=400, detail="Action must be 'like', 'superlike', or 'pass'")
    
    await record_swipe(payload.property_id, payload.action)
    prop = await get_property_by_id(payload.property_id)
    return {
        "status": "success",
        "action": payload.action,
        "property": prop
    }

@router.post("/undo")
async def handle_undo():
    restored_property = await undo_last_swipe()
    if not restored_property:
        return {"status": "empty", "message": "No swipes to undo"}
    return {
        "status": "success",
        "restored_property": restored_property
    }

@router.post("/reset")
async def handle_reset():
    await reset_swipes()
    return {"status": "success", "message": "All swipes have been reset"}

@router.get("/")
async def list_matches(filter_type: Optional[str] = None):
    # filter_type can be 'all', 'likes', 'superlikes'
    if filter_type == "superlikes":
        actions = ["superlike"]
    elif filter_type == "likes":
        actions = ["like"]
    else:
        actions = ["like", "superlike"]
    
    matches = await get_matches(actions)
    return {
        "matches": matches,
        "total": len(matches)
    }

@router.get("/compare")
async def compare_matches(ids: str):
    # ids is comma-separated list of property ids
    id_list = [i.strip() for i in ids.split(",") if i.strip()]
    if not id_list:
        raise HTTPException(status_code=400, detail="Provide at least one property ID to compare")
    
    properties = []
    for pid in id_list[:4]:  # limit to 4 for comparison matrix
        p = await get_property_by_id(pid)
        if p:
            properties.append(p)
            
    return {"comparison": properties}
