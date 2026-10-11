from fastapi import APIRouter
from app.models import MortgageInput, MortgageBreakdown

router = APIRouter(prefix="/api/calculators", tags=["calculators"])

@router.post("/mortgage", response_model=MortgageBreakdown)
async def calculate_mortgage(data: MortgageInput):
    down_payment = (data.down_payment_percent / 100.0) * data.home_price
    loan_amount = data.home_price - down_payment
    
    monthly_interest_rate = (data.interest_rate_percent / 100.0) / 12.0
    number_of_payments = data.loan_term_years * 12
    
    if monthly_interest_rate > 0:
        monthly_pi = loan_amount * (
            monthly_interest_rate * ((1 + monthly_interest_rate) ** number_of_payments)
        ) / (((1 + monthly_interest_rate) ** number_of_payments) - 1)
    else:
        monthly_pi = loan_amount / number_of_payments if number_of_payments > 0 else 0
        
    monthly_tax = (data.home_price * (data.annual_property_tax_rate_percent / 100.0)) / 12.0
    monthly_insurance = data.annual_homeowners_insurance / 12.0
    monthly_hoa = data.monthly_hoa
    
    total_monthly = monthly_pi + monthly_tax + monthly_insurance + monthly_hoa
    total_interest = (monthly_pi * number_of_payments) - loan_amount
    
    return MortgageBreakdown(
        monthly_principal_and_interest=round(monthly_pi, 2),
        monthly_property_tax=round(monthly_tax, 2),
        monthly_homeowners_insurance=round(monthly_insurance, 2),
        monthly_hoa=round(monthly_hoa, 2),
        total_monthly_payment=round(total_monthly, 2),
        loan_amount=round(loan_amount, 2),
        down_payment_amount=round(down_payment, 2),
        total_interest_over_term=round(total_interest, 2)
    )
