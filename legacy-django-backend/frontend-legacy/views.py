import json
from datetime import datetime, timedelta
from decimal import Decimal

from django.shortcuts import render, redirect
from django.http import JsonResponse
from django.contrib.auth.decorators import login_required
from django.db.models import Sum, Count, Avg
from django.contrib.auth import get_user_model
from django.conf import settings

from transactions.models import Transaction, Category, Budget
from group_expenses.models import Group, GroupExpense, Settlement
from insights.models import BudgetInsight, SavingsGoal
from payments.models import RecurringPayment

User = get_user_model()

# ==================== PAGE RENDERING VIEWS ====================

def homepage_view(request):
    """Root landing page showing project features and summary."""
    context = {
        'project_title': 'AI Personal Finance Tracker',
        'developer_name': 'Jinay Golecha',
        'is_authenticated': request.user.is_authenticated,
        'google_client_id': getattr(settings, 'GOOGLE_CLIENT_ID', '')
    }
    return render(request, 'frontend/homepage.html', context)

def login_view(request):
    if request.user.is_authenticated:
        return redirect('frontend:dashboard')
    
    google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
    return render(request, 'frontend/login.html', {'google_client_id': google_client_id})

def signup_view(request):
    if request.user.is_authenticated:
        return redirect('frontend:dashboard')
        
    google_client_id = getattr(settings, 'GOOGLE_CLIENT_ID', '')
    return render(request, 'frontend/signup.html', {'google_client_id': google_client_id})

@login_required
def onboarding_page_view(request):
    return render(request, 'frontend/onboarding.html')

@login_required
def dashboard_view(request):
    user = request.user
    
    # Redirect to onboarding if profile is incomplete
    if hasattr(user, 'financial_profile') and not user.financial_profile.is_onboarding_complete:
        return redirect('frontend:onboarding')
        
    today = datetime.today()
    current_month = today.month

    total_income = Transaction.objects.filter(
        user=user, category_type='income', date__month=current_month
    ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')

    total_expense = Transaction.objects.filter(
        user=user, category_type='expense', date__month=current_month
    ).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')

    total_balance = total_income - total_expense

    recent_transactions = Transaction.objects.filter(user=user).select_related('category').order_by('-date')[:5]
    goals = SavingsGoal.objects.filter(user=user)[:3]
    user_groups = Group.objects.filter(members__user=user)[:3]

    context = {
        'project_owner': 'Jinay Golecha',
        'total_balance': total_balance,
        'monthly_income': total_income,
        'monthly_expenses': total_expense,
        'recent_transactions': recent_transactions,
        'goals': goals,
        'user_groups': user_groups,
    }
    return render(request, 'frontend/dashboard.html', context)

@login_required
def transaction_page_view(request):
    transactions = Transaction.objects.filter(user=request.user).select_related('category').order_by('-date')
    categories = Category.objects.filter(user=request.user)
    return render(request, 'frontend/transaction.html', {'transactions': transactions, 'categories': categories})

@login_required
def budget_page_view(request):
    budgets = Budget.objects.filter(user=request.user)
    return render(request, 'frontend/budget.html', {'budgets': budgets})

@login_required
def investments_page_view(request):
    return render(request, 'frontend/investments.html')

@login_required
def loans_page_view(request):
    return render(request, 'frontend/loans.html')

@login_required
def calendar_page_view(request):
    return render(request, 'frontend/calendar.html')

@login_required
def ai_advisor_page_view(request):
    return render(request, 'frontend/ai_advisor.html')

@login_required
def goals_page_view(request):
    goals = SavingsGoal.objects.filter(user=request.user)
    return render(request, 'frontend/goals.html', {'goals': goals})

@login_required
def recurring_page_view(request):
    recurring_payments = RecurringPayment.objects.filter(user=request.user)
    return render(request, 'frontend/recurring.html', {'recurring_payments': recurring_payments})


# ==================== STATS & API HELPER VIEWS ====================

@login_required
def dashboard_stats(request):
    active_users = User.objects.filter(last_login__gte=datetime.now() - timedelta(days=30)).count() or 1
    total_spending = BudgetInsight.objects.aggregate(Sum('average_spending'))['average_spending__sum'] or Decimal('1.00')
    forecasted_spending = BudgetInsight.objects.aggregate(Sum('forecasted_spending'))['forecasted_spending__sum'] or Decimal('1.00')
    accuracy_rate = round(float(forecasted_spending / total_spending) * 100, 2) if total_spending else 92.5

    total_settlements = Settlement.objects.filter(is_settled=True).count()
    total_transactions = Settlement.objects.count() or 1
    support_availability = round((total_settlements / total_transactions) * 100, 2)

    current_month = datetime.now().month
    monthly_savings = SavingsGoal.objects.filter(created_at__month=current_month).aggregate(Sum('saved_amount'))['saved_amount__sum'] or Decimal('0.00')

    context = {
        'project_owner': 'Jinay Golecha',
        'active_users': active_users,
        'accuracy_rate': accuracy_rate,
        'support_availability': support_availability,
        'monthly_savings': float(monthly_savings),
        'savings_growth': 12.5,
        'investment_users': 5,
        'average_roi': 8.4,
    }
    return render(request, 'frontend/homepage.html', context)

@login_required
def financial_summary(request):
    user = request.user
    today = datetime.today()
    current_month = today.month

    total_income = Transaction.objects.filter(user=user, category_type='income').aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
    total_expense = Transaction.objects.filter(user=user, category_type='expense').aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
    total_balance = total_income - total_expense

    monthly_income = Transaction.objects.filter(user=user, category_type='income', date__month=current_month).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')
    monthly_expenses = Transaction.objects.filter(user=user, category_type='expense', date__month=current_month).aggregate(Sum('amount'))['amount__sum'] or Decimal('0.00')

    total_goal = SavingsGoal.objects.filter(user=user).aggregate(Sum('target_amount'))['target_amount__sum'] or Decimal('1.00')
    total_savings = SavingsGoal.objects.filter(user=user).aggregate(Sum('saved_amount'))['saved_amount__sum'] or Decimal('0.00')
    savings_progress = round(float(total_savings / total_goal) * 100, 2) if total_goal else 0.0

    context = {
        'project_owner': 'Jinay Golecha',
        'total_balance': float(total_balance),
        'balance_change': 5.2,
        'monthly_income': float(monthly_income),
        'income_change': 3.1,
        'monthly_expenses': float(monthly_expenses),
        'expense_change': -2.4,
        'savings_progress': savings_progress,
    }
    return render(request, 'frontend/dashboard.html', context)

@login_required
def spending_analysis(request):
    user = request.user
    period = request.GET.get('period', 'month')

    today = datetime.today().date()
    if period == 'week':
        start_date = today - timedelta(days=today.weekday())
    elif period == 'year':
        start_date = today.replace(month=1, day=1)
    else:
        start_date = today.replace(day=1)

    transactions = Transaction.objects.filter(user=user, date__gte=start_date)
    datewise_income = transactions.filter(category_type="income").values('date').annotate(total=Sum('amount'))
    datewise_expense = transactions.filter(category_type="expense").values('date').annotate(total=Sum('amount'))

    dates = [entry['date'].strftime('%Y-%m-%d') for entry in datewise_income]
    income = [float(entry['total']) for entry in datewise_income]
    expenses = [float(entry['total']) for entry in datewise_expense]

    expense_categories = transactions.filter(category_type="expense").values('category__name').annotate(total=Sum('amount'))
    category_data = [
        {"category": entry["category__name"] or "General", "amount": float(entry["total"])}
        for entry in expense_categories
    ]

    context_data = {
        "dates": dates,
        "income": income,
        "expenses": expenses,
        "expense_categories": category_data,
    }

    return render(request, 'frontend/dashboard.html', {"chart_context": json.dumps(context_data)})
