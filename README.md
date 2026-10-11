# 🏡 NestMatch — Real Estate Lifestyle Matchmaker

> **Swipe Your Dream Lifestyle.** A "Property Tinder" and lifestyle discovery web application matching design aesthetics, neighborhood vibe, commute tolerance, and budget.

---

## ✨ Features

- **🔥 Physics-Based Swipe Deck**: Smooth touch, mouse drag, and keyboard gestures (`← Pass`, `→ Like`, `↑ Superlike`, `Z Undo`, `Space Specs`) with real-time rotation, dynamic "LIKE" / "PASS" / "SUPERLIKE" stamps, and photo carousel.
- **✨ Lifestyle Vibe Matching Algorithm**: Dynamic compatibility scoring based on architectural style, aesthetic vibes (*Sun-Drenched*, *Minimalist Luxury*, *Mid-Century Vibe*, *Industrial Chic*, *Tropical Boho*), and walk/transit/green scores.
- **🗺️ Interactive Map Radar**: Leaflet dark-mode map plotting properties with price badges, popups, and sidebar synchronization.
- **⚖️ Side-by-Side Comparison Matrix**: Select 2 to 4 shortlisted homes to inspect price per sq ft, commute tolerances, monthly estimates, and amenity matrices.
- **🧮 Interactive Mortgage Lab**: Real-time sliders for purchase price, down payment %, interest rate %, loan term, and property tax rate with visual progress breakdown (P&I, Taxes, Insurance, HOA).
- **💾 Local SQLite Persistence**: Async database tracking swipes, shortlisted matches, and custom user lifestyle preferences.

---

## 🚀 Quickstart

Run with **`uv`** (no Node/npm required):

```bash
# 1. Install dependencies (managed via uv)
uv sync

# 2. Start the development server
uv run main.py
```

Then open your browser at **[http://127.0.0.1:8000](http://127.0.0.1:8000)**.

---

## 📁 Project Structure

```
real-estate-matchmaker/
├── app/
│   ├── main.py              # FastAPI app instance & lifespan handlers
│   ├── database.py          # Asynchronous SQLite storage & scoring engine
│   ├── models.py            # Pydantic schemas
│   ├── seed_data.py         # Curated architectural properties & lifestyle metrics
│   ├── routers/
│   │   ├── properties.py    # Properties deck & vibes endpoints
│   │   ├── matches.py       # Swiping, undo, reset, and comparison endpoints
│   │   └── calculators.py   # Mortgage amortization & cash flow calculation
│   ├── static/
│   │   ├── css/style.css    # Modern glassmorphism & cyber-luxe theme
│   │   └── js/
│   │       ├── app.js       # App orchestrator & state manager
│   │       ├── swipe.js     # Physics drag & swipe gesture controller
│   │       └── map.js       # Leaflet map radar controller
│   └── templates/
│       └── index.html       # Single-page application shell
├── main.py                  # Entrypoint runner
├── pyproject.toml           # uv project configuration
└── README.md
```
