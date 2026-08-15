from decimal import Decimal
import math
from django.utils.timezone import now
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import Loan, InsurancePolicy, Subscription
from users.utils import format_inr

def calculate_emi(principal, annual_rate, tenure_months):
    """
    Standard EMI calculation formula: P * r * (1+r)^n / ((1+r)^n - 1)
    """
    if annual_rate == 0 or tenure_months == 0:
        return principal / tenure_months if tenure_months > 0 else principal

    r = (annual_rate / 100) / 12 # Monthly rate
    n = tenure_months
    emi = principal * Decimal(str(r * math.pow(1 + r, n) / (math.pow(1 + r, n) - 1)))
    return emi

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def loans_api_view(request):
    user = request.user

    if request.method == 'GET':
        loans = Loan.objects.filter(user=user).order_by('-created_at')
        total_outstanding = sum(l.outstanding_balance for l in loans) if loans else Decimal(0)
        total_emi = sum(l.emi_amount for l in loans if l.emi_amount) if loans else Decimal(0)

        items = [
            {
                "id": l.id,
                "loan_type": l.get_loan_type_display(),
                "principal_amount": float(l.principal_amount),
                "formatted_principal": format_inr(l.principal_amount),
                "interest_rate": float(l.interest_rate),
                "tenure_months": l.tenure_months,
                "start_date": str(l.start_date),
                "emi_amount": float(l.emi_amount or 0),
                "formatted_emi": format_inr(l.emi_amount or 0),
                "outstanding_balance": float(l.outstanding_balance),
                "formatted_outstanding": format_inr(l.outstanding_balance)
            }
            for l in loans
        ]

        return Response({
            "total_outstanding": float(total_outstanding),
            "formatted_total_outstanding": format_inr(total_outstanding),
            "total_monthly_emi": float(total_emi),
            "formatted_total_monthly_emi": format_inr(total_emi),
            "loans": items
        }, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        loan_type = request.data.get("loan_type", "HOME")
        principal_str = request.data.get("principal_amount")
        interest_rate_str = request.data.get("interest_rate")
        tenure_str = request.data.get("tenure_months")
        start_date_str = request.data.get("start_date", now().date().isoformat())

        if not principal_str or not interest_rate_str or not tenure_str:
            return Response({"error": "Principal, interest rate, and tenure are required."}, status=status.HTTP_400_BAD_REQUEST)

        try:
            principal = Decimal(str(principal_str))
            rate = Decimal(str(interest_rate_str))
            tenure = int(tenure_str)
        except Exception:
            return Response({"error": "Invalid numeric values."}, status=status.HTTP_400_BAD_REQUEST)

        emi = calculate_emi(principal, float(rate), tenure)

        loan = Loan.objects.create(
            user=user,
            loan_type=loan_type,
            principal_amount=principal,
            interest_rate=rate,
            tenure_months=tenure,
            start_date=start_date_str,
            emi_amount=emi,
            outstanding_balance=principal
        )

        return Response({
            "message": "Loan added successfully!",
            "loan_id": loan.id,
            "calculated_emi": float(emi),
            "formatted_emi": format_inr(emi)
        }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def prepayment_simulate_api_view(request):
    user = request.user
    loan_id = request.data.get("loan_id")
    prepayment_str = request.data.get("prepayment_amount")

    if not prepayment_str:
        return Response({"error": "Prepayment amount is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        prepayment = Decimal(str(prepayment_str))
        if prepayment <= 0:
            return Response({"error": "Prepayment must be > 0."}, status=status.HTTP_400_BAD_REQUEST)
    except Exception:
        return Response({"error": "Invalid numerical prepayment."}, status=status.HTTP_400_BAD_REQUEST)

    if loan_id:
        try:
            loan = Loan.objects.get(id=loan_id, user=user)
            principal = loan.outstanding_balance
            rate = float(loan.interest_rate)
            tenure = loan.tenure_months
            emi = float(loan.emi_amount or calculate_emi(principal, rate, tenure))
        except Loan.DoesNotExist:
            return Response({"error": "Loan not found."}, status=status.HTTP_404_NOT_FOUND)
    else:
        principal = Decimal('1000000') # 10 Lakh default simulation
        rate = 8.5
        tenure = 120
        emi = float(calculate_emi(principal, rate, tenure))

    if prepayment >= principal:
        months_saved = tenure
        interest_saved = principal * Decimal(str(rate / 100)) * Decimal(str(tenure / 12))
    else:
        new_principal = principal - prepayment
        r = (rate / 100) / 12
        # Calculate new tenure: n = -log(1 - r*P/EMI) / log(1+r)
        try:
            val = 1 - (r * float(new_principal) / emi)
            if val > 0:
                new_n = math.ceil(-math.log(val) / math.log(1 + r))
            else:
                new_n = 1
            months_saved = max(0, tenure - new_n)
            interest_saved = Decimal(str(months_saved * emi))
        except Exception:
            months_saved = 12
            interest_saved = prepayment * Decimal('0.30')

    return Response({
        "original_principal": float(principal),
        "formatted_original_principal": format_inr(principal),
        "prepayment_amount": float(prepayment),
        "formatted_prepayment": format_inr(prepayment),
        "months_saved": months_saved,
        "interest_saved": float(interest_saved),
        "formatted_interest_saved": format_inr(interest_saved),
        "summary": f"By prepaying {format_inr(prepayment)}, you save approx {format_inr(interest_saved)} in interest and reduce loan tenure by {months_saved} months!"
    }, status=status.HTTP_200_OK)

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def subscriptions_api_view(request):
    user = request.user
    if request.method == 'GET':
        subs = Subscription.objects.filter(user=user, is_active=True)
        total_monthly = sum(s.cost if s.billing_cycle == 'MONTHLY' else s.cost / 12 for s in subs) if subs else Decimal(0)
        items = [
            {
                "id": s.id,
                "service_name": s.service_name,
                "cost": float(s.cost),
                "formatted_cost": format_inr(s.cost),
                "billing_cycle": s.get_billing_cycle_display(),
                "next_billing_date": str(s.next_billing_date)
            }
            for s in subs
        ]
        return Response({
            "total_monthly_cost": float(total_monthly),
            "formatted_total_monthly_cost": format_inr(total_monthly),
            "subscriptions": items
        }, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        service_name = request.data.get("service_name")
        cost_str = request.data.get("cost")
        billing_cycle = request.data.get("billing_cycle", "MONTHLY")
        next_billing_date = request.data.get("next_billing_date", now().date().isoformat())

        if not service_name or not cost_str:
            return Response({"error": "Service name and cost are required."}, status=status.HTTP_400_BAD_REQUEST)

        sub = Subscription.objects.create(
            user=user,
            service_name=service_name,
            cost=Decimal(str(cost_str)),
            billing_cycle=billing_cycle,
            next_billing_date=next_billing_date
        )

        return Response({
            "message": "Subscription added successfully!",
            "id": sub.id
        }, status=status.HTTP_201_CREATED)
