import json
from datetime import datetime, timedelta
from decimal import Decimal

from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.utils.timezone import now
from django.db.models import Sum
from django.shortcuts import get_object_or_404

from rest_framework import generics, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import BudgetInsight, SavingsGoal
from .serializers import BudgetInsightSerializer
from .utils import get_spending_insights, predict_future_spending, suggest_savings, track_savings_progress
from transactions.models import Transaction, Budget, BudgetHistory
from notifications.models import Notification


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def dashboard_data(request):
    """API to get summary metrics for the dashboard."""
    user = request.user
    today = now().date()
    current_month = today.month
    current_year = today.year

    # Calculate Total Balance
    incomes = Transaction.objects.filter(user=user, category_type='income').aggregate(total=Sum('amount'))['total'] or Decimal('0')
    expenses = Transaction.objects.filter(user=user, category_type='expense').aggregate(total=Sum('amount'))['total'] or Decimal('0')
    total_balance = incomes - expenses

    # Monthly Metrics
    monthly_income = Transaction.objects.filter(
        user=user, category_type='income', date__month=current_month, date__year=current_year
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')
    
    monthly_expenses = Transaction.objects.filter(
        user=user, category_type='expense', date__month=current_month, date__year=current_year
    ).aggregate(total=Sum('amount'))['total'] or Decimal('0')

    # Savings Progress (Percentage of monthly income saved)
    savings_progress = 0
    if monthly_income > 0:
        saved = max(Decimal('0'), monthly_income - monthly_expenses)
        savings_progress = int((saved / monthly_income) * 100)

    data = {
        "total_balance": float(total_balance),
        "monthly_income": float(monthly_income),
        "monthly_expenses": float(monthly_expenses),
        "savings_progress": savings_progress,
    }
    return Response(data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def spending_insights_view(request):
    """API to get spending insights for current user."""
    insights = get_spending_insights(request.user)
    return Response({"spending_insights": insights}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def forecast_spending_view(request, category):
    """API to predict future spending for a given category."""
    forecast = predict_future_spending(request.user, category)
    return Response({"category": category, "forecasted_spending": forecast}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def savings_suggestions_view(request):
    """API to provide cost-saving recommendations."""
    suggestions = suggest_savings(request.user)
    return Response({"savings_recommendations": suggestions}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_savings_goal(request):
    """API to create a new savings goal."""
    goal_name = request.data.get("goal_name")
    target_amount = request.data.get("target_amount")
    deadline_str = request.data.get("deadline")

    if not goal_name or not target_amount or not deadline_str:
        return Response({"error": "Missing required goal parameters"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        deadline = datetime.strptime(deadline_str, "%Y-%m-%d").date()
    except ValueError:
        return Response({"error": "Invalid date format. Use YYYY-MM-DD"}, status=status.HTTP_400_BAD_REQUEST)

    goal = SavingsGoal.objects.create(
        user=request.user,
        goal_name=goal_name,
        target_amount=Decimal(str(target_amount)),
        deadline=deadline
    )
    return Response({"message": "Savings goal created successfully!", "goal_id": goal.id}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_savings_progress(request):
    """API to fetch user's savings goals and progress."""
    track_savings_progress(request.user)
    goals = SavingsGoal.objects.filter(user=request.user).values()
    return Response({"goals": list(goals)}, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def update_goal_savings(request):
    """API to manually update savings for a goal."""
    user = request.user
    goal_id = request.data.get("goal_id")
    saved_amount = request.data.get("saved_amount")

    if not goal_id or saved_amount is None:
        return Response({"error": "Missing goal_id or saved_amount"}, status=status.HTTP_400_BAD_REQUEST)

    try:
        goal = SavingsGoal.objects.get(id=goal_id, user=user)
        goal.saved_amount = Decimal(str(saved_amount))
        goal.update_progress()
        goal.save()

        if goal.status == "Completed":
            Notification.objects.create(
                recipients=str(user.id),
                title="Goal Achieved!",
                message=f"🎉 Congratulations! You have completed your savings goal: {goal.goal_name}",
                status="sent"
            )

        return Response({"message": "Goal updated successfully.", "status": goal.status}, status=status.HTTP_200_OK)
    except SavingsGoal.DoesNotExist:
        return Response({"error": "Goal not found."}, status=status.HTTP_404_NOT_FOUND)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ai_insights(request):
    """
    Generates AI insights based on budget history and spending patterns.
    """
    user = request.user
    budget_history = BudgetHistory.objects.filter(user=user).values(
        'category', 'previous_limit', 'actual_spent', 'suggested_limit'
    )

    insights = []
    for record in budget_history:
        category = record['category']
        prev_limit = record['previous_limit']
        spent = record['actual_spent']
        suggested = record['suggested_limit']

        if spent > prev_limit:
            insights.append({
                "title": f"Overspending in {category}",
                "message": f"You spent ₹{spent}, exceeding your ₹{prev_limit} budget.",
                "suggested_budget": float(suggested),
                "category": category,
            })
        else:
            insights.append({
                "title": f"Good Budget Control in {category}",
                "message": f"You stayed within your ₹{prev_limit} budget. Suggested new budget: ₹{suggested}",
                "suggested_budget": float(suggested),
                "category": category,
            })

    if not insights:
        insights.append({
            "title": "Welcome to AI Financial Insights",
            "message": "Add transactions and budgets to get personalized recommendations.",
            "suggested_budget": 0.0,
            "category": "General",
        })

    return Response(insights, status=status.HTTP_200_OK)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def accept_suggested_budget(request):
    """
    Updates the user's budget with the AI-suggested limit.
    """
    user = request.user
    category = request.data.get("category")
    new_limit = request.data.get("new_limit")

    if not category or not new_limit:
        return Response({"error": "Missing category or new limit"}, status=400)

    budget, created = Budget.objects.get_or_create(user=user, category=category, defaults={'monthly_limit': new_limit})
    if not created:
        budget.monthly_limit = Decimal(str(new_limit))
        budget.save()

    return Response({"message": f"Budget updated successfully for {category}!", "new_limit": new_limit}, status=200)


class BudgetInsightView(generics.ListAPIView):
    serializer_class = BudgetInsightSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return BudgetInsight.objects.filter(user=self.request.user)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_savings_insights(request):
    user = request.user
    insights = BudgetInsight.objects.filter(user=user).order_by('-created_at')

    insights_list = [
        {
            "category": insight.category,
            "average_spending": float(insight.average_spending),
            "forecasted_spending": float(insight.forecasted_spending),
            "savings_recommendation": insight.savings_recommendation
        }
        for insight in insights
    ]
    return Response(insights_list, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_savings_projections(request):
    user = request.user
    current_year = now().year
    current_month = now().month

    budget_history = (
        BudgetHistory.objects
        .filter(user=user, year=current_year)
        .values('month')
        .annotate(total_saved=Sum('suggested_limit'))
        .order_by('month')
    )

    future_budget = (
        Budget.objects
        .filter(user=user)
        .aggregate(total_budget=Sum('monthly_limit'))
    )['total_budget'] or 0

    months = []
    savings_data = []

    for entry in budget_history:
        month_name = datetime(current_year, entry['month'], 1).strftime('%b')
        months.append(month_name)
        savings_data.append(float(entry['total_saved']))

    if not months:
        months = [now().strftime('%b')]
        savings_data = [float(future_budget)]

    for i in range(1, 4):
        future_month = (current_month + i) % 12 or 12
        future_month_name = datetime(current_year, future_month, 1).strftime('%b')
        months.append(future_month_name)
        last_val = savings_data[-1] if savings_data else 0.0
        savings_data.append(last_val + float(future_budget))

    return Response({"months": months, "amounts": savings_data}, status=status.HTTP_200_OK)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_notifications(request):
    user = request.user
    notifications = Notification.objects.filter(
        recipients__in=["all", str(user.id)]
    ).order_by('-timestamp')

    notifications_list = [
        {"id": n.id, "title": n.title, "message": n.message, "timestamp": n.timestamp.strftime("%Y-%m-%d %H:%M:%S")}
        for n in notifications
    ]
    return Response(notifications_list, status=status.HTTP_200_OK)
