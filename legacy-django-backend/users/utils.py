from decimal import Decimal
import locale

def format_inr(number):
    """
    Format a number or Decimal according to the Indian Numbering System.
    Example: 150000.5 -> ₹1,50,000.50
    """
    if number is None:
        return "₹0.00"
    
    try:
        val = Decimal(str(number))
    except Exception:
        return "₹0.00"
        
    is_negative = val < 0
    val = abs(val)
    
    s = f"{val:.2f}"
    parts = s.split('.')
    integer_part = parts[0]
    decimal_part = parts[1]

    if len(integer_part) <= 3:
        formatted_int = integer_part
    else:
        last3 = integer_part[-3:]
        remaining = integer_part[:-3]
        # Group remaining digits in 2s
        groups = []
        while len(remaining) > 2:
            groups.insert(0, remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            groups.insert(0, remaining)
        formatted_int = ",".join(groups) + "," + last3

    prefix = "-₹" if is_negative else "₹"
    return f"{prefix}{formatted_int}.{decimal_part}"

def calculate_risk_profile(age, experience, risk_tolerance, horizon, income_stability, debt_level):
    """
    Calculate risk score and return Conservative, Moderate, or Aggressive.
    """
    score = 0
    # Age factor
    try:
        age_num = int(age)
        if age_num < 30:
            score += 3
        elif age_num <= 50:
            score += 2
        else:
            score += 1
    except (ValueError, TypeError):
        score += 2

    # Tolerance
    if risk_tolerance in ['High', 'Aggressive']:
        score += 3
    elif risk_tolerance in ['Medium', 'Moderate']:
        score += 2
    else:
        score += 1

    # Horizon
    if horizon in ['Long', '10+ years']:
        score += 3
    elif horizon in ['Medium', '3-10 years']:
        score += 2
    else:
        score += 1

    if score >= 8:
        return "Aggressive"
    elif score >= 5:
        return "Moderate"
    else:
        return "Conservative"

def calculate_health_score(income, expenses, savings, debt, goals_count=1):
    """
    Returns a Financial Health Score from 0 to 100 based on standard benchmarks:
    - Savings Rate (Target 20%+ of Income): 30 pts
    - Expense Ratio (Expenses <= 50% of Income): 30 pts
    - Emergency Fund / Debt Ratio: 20 pts
    - Goal Planning: 20 pts
    """
    try:
        inc = Decimal(str(income or 0))
        exp = Decimal(str(expenses or 0))
        sav = Decimal(str(savings or 0))
        dbt = Decimal(str(debt or 0))
    except Exception:
        return 50

    if inc <= 0:
        return 40

    health = 0
    # 1. Savings Rate
    savings_rate = (inc - exp) / inc if inc > 0 else Decimal(0)
    if savings_rate >= Decimal('0.30'):
        health += 30
    elif savings_rate >= Decimal('0.20'):
        health += 25
    elif savings_rate >= Decimal('0.10'):
        health += 15
    elif savings_rate > 0:
        health += 10

    # 2. Expense Ratio
    expense_ratio = exp / inc
    if expense_ratio <= Decimal('0.50'):
        health += 30
    elif expense_ratio <= Decimal('0.70'):
        health += 20
    elif expense_ratio <= Decimal('0.90'):
        health += 10

    # 3. Debt to Income Ratio
    debt_ratio = dbt / (inc * Decimal(12)) if inc > 0 else Decimal(1)
    if debt_ratio <= Decimal('0.10'):
        health += 20
    elif debt_ratio <= Decimal('0.30'):
        health += 15
    elif debt_ratio <= Decimal('0.50'):
        health += 5

    # 4. Goals & Emergency Buffer
    if sav >= exp * Decimal(3):
        health += 20
    elif sav >= exp:
        health += 10
    else:
        health += 5

    return min(100, max(10, health))
