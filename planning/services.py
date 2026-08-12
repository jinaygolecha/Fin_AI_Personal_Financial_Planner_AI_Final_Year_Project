from decimal import Decimal
from users.utils import calculate_risk_profile, calculate_health_score, format_inr
from planning.models import FinancialPlan
from accounts.models import FinancialAccount
from transactions.models import Budget
from datetime import datetime

def generate_user_financial_plan(user, fin_profile):
    """
    Generate or update FinancialPlan, default FinancialAccount, and initial Budgets based on FinancialProfile.
    """
    total_income = Decimal(str(fin_profile.monthly_salary or 0)) + Decimal(str(fin_profile.other_monthly_income or 0))
    total_expenses = Decimal(str(fin_profile.estimated_monthly_expenses or 0))
    current_savings = Decimal(str(fin_profile.current_savings or 0))
    total_debt = Decimal(str(fin_profile.total_debt or 0))

    # Health score
    health_score = calculate_health_score(
        income=total_income,
        expenses=total_expenses,
        savings=current_savings,
        debt=total_debt
    )

    # 50/30/20 target breakdown
    if fin_profile.budget_method == '50/30/20':
        needs_target = total_income * Decimal('0.50')
        wants_target = total_income * Decimal('0.30')
        savings_target = total_income * Decimal('0.20')
    else:
        savings_target = max(Decimal(0), total_income - total_expenses)

    emergency_fund_target = total_expenses * Decimal(6) # 6 months buffer
    investment_target = savings_target * Decimal('0.60')
    debt_payment_target = min(total_debt, total_income * Decimal('0.15'))

    summary = (
        f"Based on monthly income of {format_inr(total_income)} and expenses of {format_inr(total_expenses)}, "
        f"your calculated Financial Health Score is {health_score}/100 with a {fin_profile.risk_profile} risk profile. "
        f"Recommended monthly savings target: {format_inr(savings_target)}."
    )

    plan, created = FinancialPlan.objects.get_or_create(
        user=user,
        defaults={
            'income': total_income,
            'expenses': total_expenses,
            'savings_target': savings_target,
            'emergency_fund_target': emergency_fund_target,
            'investment_target': investment_target,
            'debt_payment_target': debt_payment_target,
            'financial_health_score': health_score,
            'risk_profile': fin_profile.risk_profile,
            'budget_method': fin_profile.budget_method,
            'plan_summary': summary
        }
    )

    if not created:
        plan.income = total_income
        plan.expenses = total_expenses
        plan.savings_target = savings_target
        plan.emergency_fund_target = emergency_fund_target
        plan.investment_target = investment_target
        plan.debt_payment_target = debt_payment_target
        plan.financial_health_score = health_score
        plan.risk_profile = fin_profile.risk_profile
        plan.budget_method = fin_profile.budget_method
        plan.plan_summary = summary
        plan.save()

    # Ensure default Primary Bank Account exists
    if not FinancialAccount.objects.filter(user=user).exists():
        FinancialAccount.objects.create(
            user=user,
            name="Primary Savings Account",
            institution="HDFC Bank",
            account_type="SAVINGS",
            balance=current_savings,
            currency="INR"
        )
        if fin_profile.emergency_fund > 0:
            FinancialAccount.objects.create(
                user=user,
                name="Emergency Cash Fund",
                institution="Cash Wallet",
                account_type="CASH",
                balance=fin_profile.emergency_fund,
                currency="INR"
            )

    # Initial default budgets
    if not Budget.objects.filter(user=user).exists() and total_expenses > 0:
        Budget.objects.create(user=user, category="Food & Grocery", monthly_limit=total_expenses * Decimal('0.30'))
        Budget.objects.create(user=user, category="Rent & Housing", monthly_limit=total_expenses * Decimal('0.40'))
        Budget.objects.create(user=user, category="Entertainment", monthly_limit=total_expenses * Decimal('0.15'))
        Budget.objects.create(user=user, category="Utilities & Bills", monthly_limit=total_expenses * Decimal('0.15'))

    return plan
