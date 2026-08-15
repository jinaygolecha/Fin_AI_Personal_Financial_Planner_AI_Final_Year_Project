from decimal import Decimal
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import FinancialPlan, Goal
from users.utils import format_inr

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def financial_plan_api_view(request):
    user = request.user
    plan = FinancialPlan.objects.filter(user=user).first()

    if not plan:
        return Response({"error": "No financial plan generated yet. Please complete onboarding."}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        "health_score": plan.financial_health_score,
        "income": float(plan.income),
        "formatted_income": format_inr(plan.income),
        "expenses": float(plan.expenses),
        "formatted_expenses": format_inr(plan.expenses),
        "savings_target": float(plan.savings_target),
        "formatted_savings_target": format_inr(plan.savings_target),
        "emergency_fund_target": float(plan.emergency_fund_target),
        "formatted_emergency_fund_target": format_inr(plan.emergency_fund_target),
        "investment_target": float(plan.investment_target),
        "formatted_investment_target": format_inr(plan.investment_target),
        "risk_profile": plan.risk_profile,
        "budget_method": plan.budget_method,
        "plan_summary": plan.plan_summary
    }, status=status.HTTP_200_OK)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def goals_api_view(request):
    user = request.user

    if request.method == 'GET':
        goals = Goal.objects.filter(user=user).order_by('-created_at')
        items = [
            {
                "id": g.id,
                "name": g.name,
                "goal_type": g.get_goal_type_display(),
                "target_amount": float(g.target_amount),
                "formatted_target_amount": format_inr(g.target_amount),
                "current_amount": float(g.current_amount),
                "formatted_current_amount": format_inr(g.current_amount),
                "target_date": str(g.target_date) if g.target_date else None,
                "progress_pct": int((g.current_amount / g.target_amount * 100)) if g.target_amount > 0 else 0
            }
            for g in goals
        ]
        return Response({"goals": items}, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        name = request.data.get("name")
        goal_type = request.data.get("goal_type", "OTHER")
        target_str = request.data.get("target_amount")
        current_str = request.data.get("current_amount", 0)
        target_date = request.data.get("target_date")

        if not name or not target_str:
            return Response({"error": "Name and target amount are required."}, status=status.HTTP_400_BAD_REQUEST)

        goal = Goal.objects.create(
            user=user,
            name=name,
            goal_type=goal_type,
            target_amount=Decimal(str(target_str)),
            current_amount=Decimal(str(current_str or 0)),
            target_date=target_date if target_date else None
        )

        return Response({
            "message": "Goal created successfully!",
            "id": goal.id
        }, status=status.HTTP_201_CREATED)
