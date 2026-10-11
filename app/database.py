import json
import os
import aiosqlite
from contextlib import asynccontextmanager
from typing import List, Dict, Optional, Any
from app.seed_data import PROPERTIES_DATA

DB_PATH = os.path.join(os.path.dirname(__file__), "..", "nestmatch.db")

@asynccontextmanager
async def get_db_connection():
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        yield db

async def init_db():
    async with get_db_connection() as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS properties (
                id TEXT PRIMARY KEY,
                title TEXT NOT NULL,
                tagline TEXT NOT NULL,
                price INTEGER NOT NULL,
                bedrooms INTEGER NOT NULL,
                bathrooms REAL NOT NULL,
                sqft INTEGER NOT NULL,
                address TEXT NOT NULL,
                neighborhood TEXT NOT NULL,
                city TEXT NOT NULL,
                state TEXT NOT NULL,
                zip_code TEXT NOT NULL,
                lat REAL NOT NULL,
                lng REAL NOT NULL,
                property_type TEXT NOT NULL,
                architectural_style TEXT NOT NULL,
                year_built INTEGER NOT NULL,
                hoa_fee INTEGER DEFAULT 0,
                property_tax_annual INTEGER DEFAULT 0,
                description TEXT NOT NULL,
                vibes TEXT NOT NULL,
                amenities TEXT NOT NULL,
                images TEXT NOT NULL,
                walk_score INTEGER NOT NULL,
                transit_score INTEGER NOT NULL,
                bike_score INTEGER NOT NULL,
                green_score INTEGER NOT NULL,
                sound_score INTEGER NOT NULL,
                commute_minutes TEXT NOT NULL
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS swipes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                property_id TEXT NOT NULL,
                action TEXT NOT NULL, -- 'like', 'superlike', 'pass'
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (property_id) REFERENCES properties(id)
            )
        """)

        await db.execute("""
            CREATE TABLE IF NOT EXISTS user_preferences (
                id INTEGER PRIMARY KEY CHECK (id = 1),
                min_price INTEGER,
                max_price INTEGER,
                bedrooms INTEGER,
                bathrooms REAL,
                selected_vibes TEXT,
                preferred_city TEXT,
                max_commute INTEGER,
                commute_dest TEXT DEFAULT 'Downtown Tech Core'
            )
        """)

        # Insert initial preferences if not present
        await db.execute("""
            INSERT OR IGNORE INTO user_preferences (id, min_price, max_price, bedrooms, selected_vibes, commute_dest)
            VALUES (1, 500000, 1500000, 2, '["Sun-Drenched", "Minimalist Luxury", "Outdoor Oasis"]', 'Downtown Tech Core')
        """)

        # Check if properties exist
        async with db.execute("SELECT COUNT(*) FROM properties") as cursor:
            count = (await cursor.fetchone())[0]

        if count == 0:
            for p in PROPERTIES_DATA:
                await db.execute("""
                    INSERT INTO properties (
                        id, title, tagline, price, bedrooms, bathrooms, sqft,
                        address, neighborhood, city, state, zip_code, lat, lng,
                        property_type, architectural_style, year_built, hoa_fee,
                        property_tax_annual, description, vibes, amenities, images,
                        walk_score, transit_score, bike_score, green_score, sound_score, commute_minutes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    p["id"], p["title"], p["tagline"], p["price"], p["bedrooms"], p["bathrooms"], p["sqft"],
                    p["address"], p["neighborhood"], p["city"], p["state"], p["zip_code"], p["lat"], p["lng"],
                    p["property_type"], p["architectural_style"], p["year_built"], p["hoa_fee"],
                    p["property_tax_annual"], p["description"], json.dumps(p["vibes"]),
                    json.dumps(p["amenities"]), json.dumps(p["images"]),
                    p["walk_score"], p["transit_score"], p["bike_score"], p["green_score"], p["sound_score"],
                    json.dumps(p["commute_minutes"])
                ))
        await db.commit()

def _row_to_dict(row: aiosqlite.Row) -> Dict[str, Any]:
    d = dict(row)
    if "vibes" in d and isinstance(d["vibes"], str):
        d["vibes"] = json.loads(d["vibes"])
    if "amenities" in d and isinstance(d["amenities"], str):
        d["amenities"] = json.loads(d["amenities"])
    if "images" in d and isinstance(d["images"], str):
        d["images"] = json.loads(d["images"])
    if "commute_minutes" in d and isinstance(d["commute_minutes"], str):
        d["commute_minutes"] = json.loads(d["commute_minutes"])
    return d

async def get_all_vibes() -> List[str]:
    async with get_db_connection() as db:
        async with db.execute("SELECT vibes FROM properties") as cursor:
            rows = await cursor.fetchall()
            vibes_set = set()
            for r in rows:
                v_list = json.loads(r[0])
                vibes_set.update(v_list)
            return sorted(list(vibes_set))

async def get_deck(preferences: Optional[Dict] = None) -> List[Dict[str, Any]]:
    async with get_db_connection() as db:
        # Get already swiped property IDs
        async with db.execute("SELECT DISTINCT property_id FROM swipes") as cursor:
            swiped_ids = [row[0] for row in await cursor.fetchall()]

        # Query all properties
        async with db.execute("SELECT * FROM properties") as cursor:
            rows = await cursor.fetchall()

        properties = [_row_to_dict(r) for r in rows]

        # Calculate a dynamic lifestyle match score for each property
        preferred_vibes = set(preferences.get("selected_vibes", []) if preferences else [])
        max_price = preferences.get("max_price") if preferences else None
        min_price = preferences.get("min_price") if preferences else None
        target_commute = preferences.get("commute_destination", "Downtown Tech Core") if preferences else "Downtown Tech Core"

        results = []
        for prop in properties:
            # Match score starts at base 75
            score = 75

            # Vibe overlap boost (+7 per matching vibe)
            prop_vibes = set(prop.get("vibes", []))
            overlap = len(prop_vibes.intersection(preferred_vibes))
            score += min(overlap * 8, 20)

            # Walk & Transit bonus
            if prop.get("walk_score", 0) >= 90:
                score += 3
            if prop.get("green_score", 0) >= 90:
                score += 2

            # Commute penalty/bonus
            commute = prop.get("commute_minutes", {}).get(target_commute, 20)
            if commute <= 15:
                score += 4
            elif commute >= 30:
                score -= 5

            # Budget fitness
            if max_price and prop["price"] > max_price:
                score -= 12
            if min_price and prop["price"] < min_price:
                score -= 5

            prop["match_score"] = max(55, min(99, score))
            prop["is_swiped"] = prop["id"] in swiped_ids
            results.append(prop)

        # Separate unswiped from swiped
        unswiped = [p for p in results if not p["is_swiped"]]
        # Sort unswiped by match_score descending
        unswiped.sort(key=lambda x: x["match_score"], reverse=True)
        return unswiped

async def record_swipe(property_id: str, action: str):
    async with get_db_connection() as db:
        # Delete existing swipe for this property if any
        await db.execute("DELETE FROM swipes WHERE property_id = ?", (property_id,))
        await db.execute("INSERT INTO swipes (property_id, action) VALUES (?, ?)", (property_id, action))
        await db.commit()

async def undo_last_swipe() -> Optional[Dict[str, Any]]:
    async with get_db_connection() as db:
        async with db.execute("SELECT id, property_id, action FROM swipes ORDER BY id DESC LIMIT 1") as cursor:
            row = await cursor.fetchone()
            if not row:
                return None
            swipe_id, prop_id, action = row[0], row[1], row[2]

        await db.execute("DELETE FROM swipes WHERE id = ?", (swipe_id,))
        await db.commit()

        # Fetch the property
        async with db.execute("SELECT * FROM properties WHERE id = ?", (prop_id,)) as cursor:
            p_row = await cursor.fetchone()
            if p_row:
                return _row_to_dict(p_row)
    return None

async def reset_swipes():
    async with get_db_connection() as db:
        await db.execute("DELETE FROM swipes")
        await db.commit()

async def get_matches(actions: Optional[List[str]] = None) -> List[Dict[str, Any]]:
    if actions is None:
        actions = ["like", "superlike"]
    placeholders = ",".join(["?"] * len(actions))
    async with get_db_connection() as db:
        query = f"""
            SELECT p.*, s.action as swipe_action, s.timestamp as swiped_at
            FROM properties p
            JOIN swipes s ON p.id = s.property_id
            WHERE s.action IN ({placeholders})
            ORDER BY s.id DESC
        """
        async with db.execute(query, actions) as cursor:
            rows = await cursor.fetchall()
            return [_row_to_dict(r) for r in rows]

async def get_property_by_id(property_id: str) -> Optional[Dict[str, Any]]:
    async with get_db_connection() as db:
        async with db.execute("SELECT * FROM properties WHERE id = ?", (property_id,)) as cursor:
            row = await cursor.fetchone()
            if row:
                return _row_to_dict(row)
    return None
