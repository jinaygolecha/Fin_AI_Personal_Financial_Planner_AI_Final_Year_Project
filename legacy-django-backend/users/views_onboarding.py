from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from users.models import FinancialProfile
from users.utils import calculate_risk_profile, format_inr
from planning.services import generate_user_financial_plan

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def onboarding_api_view(request):
    user = request.user
    profile, created = FinancialProfile.objects.get_or_create(user=user)

    if request.method == 'GET':
        return Response({
            "is_onboarding_complete": profile.is_onboarding_complete,
            "age": profile.age,
            "city": profile.city,
            "country": profile.country,
            "currency": profile.currency,
            "monthly_salary": float(profile.monthly_salary),
            "other_monthly_income": float(profile.other_monthly_income),
            "estimated_monthly_expenses": float(profile.estimated_monthly_expenses),
            "current_savings": float(profile.current_savings),
            "emergency_fund": float(profile.emergency_fund),
            "total_debt": float(profile.total_debt),
            "risk_profile": profile.risk_profile,
            "budget_method": profile.budget_method,
            "financial_priorities": profile.financial_priorities,
        }, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        data = request.data
        
        profile.age = int(data.get('age', 25))
        profile.city = str(data.get('city', 'Mumbai'))
        profile.country = str(data.get('country', 'India'))
        profile.currency = 'INR'
        
        profile.monthly_salary = Decimal(str(data.get('monthly_salary', 0)))
        profile.other_monthly_income = Decimal(str(data.get('other_monthly_income', 0)))
        profile.estimated_monthly_expenses = Decimal(str(data.get('estimated_monthly_expenses', 0)))
        profile.current_savings = Decimal(str(data.get('current_savings', 0)))
        profile.emergency_fund = Decimal(str(data.get('emergency_fund', 0)))
        profile.total_debt = Decimal(str(data.get('total_debt', 0)))
        
        risk = data.get('risk_profile')
        if not risk or risk not in ['Conservative', 'Moderate', 'Aggressive']:
            risk = calculate_risk_profile(
                age=profile.age,
                experience=data.get('investment_experience', 'Medium'),
                risk_tolerance=data.get('risk_tolerance', 'Medium'),
                horizon=data.get('investment_horizon', 'Long'),
                income_stability='High',
                debt_level='Low'
            )
        profile.risk_profile = risk
        profile.budget_method = str(data.get('budget_method', '50/30/20'))
        
        priorities = data.get('financial_priorities')
        if isinstance(priorities, list):
            priorities = ", ".join(priorities)
        profile.financial_priorities = str(priorities or 'Save more')
        
        profile.is_onboarding_complete = True
        profile.save()

        # Generate persistent Financial Plan & default FinancialAccounts
        plan = generate_user_financial_plan(user, profile)

        return Response({
            "message": "Onboarding completed successfully!",
            "is_onboarding_complete": True,
            "health_score": plan.financial_health_score,
            "plan_summary": plan.plan_summary
        }, status=status.HTTP_200_OK)
