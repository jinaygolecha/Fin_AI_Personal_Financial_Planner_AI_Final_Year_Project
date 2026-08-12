def calculate_emi(principal, annual_rate, tenure_months):
    """
    Calculates the EMI (Equated Monthly Installment).
    Formula: EMI = P * r * (1 + r)^n / ((1 + r)^n - 1)
    P = Principal
    r = Monthly interest rate (annual_rate / 12 / 100)
    n = Tenure in months
    """
    if annual_rate == 0:
        return principal / tenure_months
        
    r = (annual_rate / 12) / 100
    n = tenure_months
    emi = principal * r * ((1 + r)**n) / (((1 + r)**n) - 1)
    return emi

def calculate_prepayment_savings(principal, annual_rate, remaining_months, prepayment_amount):
    """
    Simulates savings on interest by making a lump-sum prepayment.
    """
    r = (annual_rate / 12) / 100
    emi = calculate_emi(principal, annual_rate, remaining_months)
    
    # Total interest without prepayment
    total_payment_original = emi * remaining_months
    total_interest_original = total_payment_original - principal
    
    # With prepayment
    new_principal = principal - prepayment_amount
    if new_principal <= 0:
        return total_interest_original # Saved all remaining interest
        
    new_emi = calculate_emi(new_principal, annual_rate, remaining_months)
    total_payment_new = new_emi * remaining_months
    total_interest_new = total_payment_new - new_principal
    
    return total_interest_original - total_interest_new
