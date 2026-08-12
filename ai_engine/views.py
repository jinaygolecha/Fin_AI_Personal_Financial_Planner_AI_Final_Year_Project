from decimal import Decimal
from django.db.models import Sum
from django.utils.timezone import now
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from transactions.models import Transaction, Budget
from accounts.models import FinancialAccount
from investments.models import Portfolio
from loans.models import Loan
from insights.models import SavingsGoal
from planning.models import FinancialPlan
from users.utils import format_inr, calculate_health_score

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ai_chat_api_view(request):
    user = request.user
    message = request.data.get("message", "").lower().strip()

    if not message:
        return Response({"error": "Message is required."}, status=status.HTTP_400_BAD_REQUEST)

    # 1. Fetch user's actual DB financial data
    today = now().date()
    current_month = today.month
    current_year = today.year

    income = Transaction.objects.filter(
        user=user, category_type='income', date__month=current_month, date__year=current_year
    ).aggregate(total=Sum('amount'))['total'] or Decimal(0)

    expenses = Transaction.objects.filter(
        user=user, category_type='expense', date__month=current_month, date__year=current_year
    ).aggregate(total=Sum('amount'))['total'] or Decimal(0)

    accounts = FinancialAccount.objects.filter(user=user)
    total_balance = sum(a.balance for a in accounts) if accounts else Decimal(0)

    portfolio = Portfolio.objects.filter(user=user).first()
    invested_val = portfolio.current_value if portfolio else Decimal(0)

    loans = Loan.objects.filter(user=user)
    total_debt = sum(l.outstanding_balance for l in loans) if loans else Decimal(0)

    net_worth = (total_balance + invested_val) - total_debt
    health_score = calculate_health_score(income, expenses, total_balance, total_debt)

    # 2. Intent matching & Context-aware responses
    reply = ""

    if any(k in message for k in ['spent', 'expenses', 'expense', 'outflow']):
        reply = f"This month ({today.strftime('%B %Y')}), your total expenses are {format_inr(expenses)}. "
        if expenses > income and income > 0:
            reply += "⚠️ Caution: Your monthly expenses currently exceed your recorded monthly income."
        else:
            reply += "Good job maintaining budget discipline!"

    elif any(k in message for k in ['income', 'earned', 'salary', 'saved', 'savings']):
        saved = max(Decimal(0), income - expenses)
        savings_rate = (saved / income * 100) if income > 0 else 0
        reply = f"Your recorded income for this month is {format_inr(income)}. Estimated monthly savings: {format_inr(saved)} ({savings_rate:.1f}% savings rate)."

    elif any(k in message for k in ['net worth', 'total wealth', 'balance', 'assets']):
        reply = f"Your Net Worth is {format_inr(net_worth)}. (Total Liquid Balance: {format_inr(total_balance)}, Investments: {format_inr(invested_val)}, Outstanding Debt: {format_inr(total_debt)})."

    elif any(k in message for k in ['invest', 'stock', 'portfolio', 'crypto', 'gold']):
        reply = f"Your total investment portfolio value is {format_inr(invested_val)}. We recommend allocating 20% of monthly income to SIPs and index funds."

    elif any(k in message for k in ['emi', 'loan', 'debt', 'liabilities']):
        if loans:
            next_loan = loans.first()
            reply = f"You have {loans.count()} active loan(s) with total outstanding debt of {format_inr(total_debt)}. Next EMI commitment is approx {format_inr(next_loan.emi_amount or 0)}."
        else:
            reply = "You currently have 0 recorded active loans. Excellent debt control!"

    elif any(k in message for k in ['health score', 'score', 'rating']):
        reply = f"Your Financial Health Score is {health_score}/100 based on your savings rate, expense ratio, and debt coverage. Ratings above 70 indicate strong financial resilience."

    else:
        reply = (
            f"Hello {user.first_name or user.username}! I am your Jinay Finance AI Assistant. "
            f"Based on your live profile, your Net Worth is {format_inr(net_worth)} and monthly expenses are {format_inr(expenses)}. "
            "How can I assist you with your budget, investments, or loans today?"
        )

    return Response({
        "reply": reply,
        "health_score": health_score,
        "net_worth": float(net_worth),
        "formatted_net_worth": format_inr(net_worth),
        "monthly_expenses": float(expenses),
        "formatted_monthly_expenses": format_inr(expenses)
    }, status=status.HTTP_200_OK)
