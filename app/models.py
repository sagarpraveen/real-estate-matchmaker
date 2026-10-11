from typing import List, Optional, Dict
from pydantic import BaseModel, Field

class PropertyBase(BaseModel):
    id: str
    title: str
    tagline: str
    price: int
    bedrooms: int
    bathrooms: float
    sqft: int
    address: str
    neighborhood: str
    city: str
    state: str
    zip_code: str
    lat: float
    lng: float
    property_type: str
    architectural_style: str
    year_built: int
    hoa_fee: int = 0
    property_tax_annual: int = 0
    description: str
    vibes: List[str]
    amenities: List[str]
    images: List[str]
    walk_score: int
    transit_score: int
    bike_score: int
    green_score: int
    sound_score: int
    commute_minutes: Dict[str, int]
    match_score: Optional[int] = 95

class SwipeAction(BaseModel):
    property_id: str
    action: str  # 'like', 'superlike', 'pass'

class FilterPreferences(BaseModel):
    min_price: Optional[int] = None
    max_price: Optional[int] = None
    bedrooms: Optional[int] = None
    bathrooms: Optional[float] = None
    property_types: Optional[List[str]] = None
    selected_vibes: Optional[List[str]] = None
    city: Optional[str] = None
    max_commute_minutes: Optional[int] = None
    commute_destination: Optional[str] = "Downtown Core"

class MortgageInput(BaseModel):
    home_price: float
    down_payment_percent: float = 20.0
    interest_rate_percent: float = 6.5
    loan_term_years: int = 30
    annual_property_tax_rate_percent: float = 1.2
    annual_homeowners_insurance: float = 1400.0
    monthly_hoa: float = 0.0

class MortgageBreakdown(BaseModel):
    monthly_principal_and_interest: float
    monthly_property_tax: float
    monthly_homeowners_insurance: float
    monthly_hoa: float
    total_monthly_payment: float
    loan_amount: float
    down_payment_amount: float
    total_interest_over_term: float
