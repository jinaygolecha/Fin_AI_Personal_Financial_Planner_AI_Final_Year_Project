from decimal import Decimal
from django.utils.timezone import now
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import FinancialEvent
from loans.models import Loan, Subscription, InsurancePolicy
from insights.models import SavingsGoal
from users.utils import format_inr

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def calendar_events_api_view(request):
    user = request.user

    if request.method == 'GET':
        events = []

        # 1. Custom Financial Events
        custom_events = FinancialEvent.objects.filter(user=user)
        for ce in custom_events:
            events.append({
                "id": f"ce_{ce.id}",
                "title": ce.title,
                "event_type": ce.get_event_type_display(),
                "raw_type": ce.event_type,
                "amount": float(ce.amount or 0),
                "formatted_amount": format_inr(ce.amount or 0),
                "date": str(ce.event_date),
                "source": "Custom Event"
            })

        # 2. Loan EMIs
        loans = Loan.objects.filter(user=user)
        for l in loans:
            events.append({
                "id": f"loan_{l.id}",
                "title": f"EMI: {l.get_loan_type_display()}",
                "event_type": "Loan EMI",
                "raw_type": "EMI",
                "amount": float(l.emi_amount or 0),
                "formatted_amount": format_inr(l.emi_amount or 0),
                "date": str(l.start_date),
                "source": "Loans"
            })

        # 3. Subscriptions
        subs = Subscription.objects.filter(user=user, is_active=True)
        for s in subs:
            events.append({
                "id": f"sub_{s.id}",
                "title": f"Subscription: {s.service_name}",
                "event_type": "Subscription Renewal",
                "raw_type": "SUBSCRIPTION",
                "amount": float(s.cost),
                "formatted_amount": format_inr(s.cost),
                "date": str(s.next_billing_date),
                "source": "Subscriptions"
            })

        # 4. Insurance Due Dates
        policies = InsurancePolicy.objects.filter(user=user)
        for p in policies:
            events.append({
                "id": f"ins_{p.id}",
                "title": f"Insurance Premium: {p.get_policy_type_display()}",
                "event_type": "Insurance Premium",
                "raw_type": "OTHER",
                "amount": float(p.premium_amount),
                "formatted_amount": format_inr(p.premium_amount),
                "date": str(p.next_due_date),
                "source": "Insurance"
            })

        # 5. Goal Deadlines
        goals = SavingsGoal.objects.filter(user=user, status="In Progress")
        for g in goals:
            events.append({
                "id": f"goal_{g.id}",
                "title": f"Goal Deadline: {g.goal_name}",
                "event_type": "Goal Target",
                "raw_type": "OTHER",
                "amount": float(g.target_amount),
                "formatted_amount": format_inr(g.target_amount),
                "date": str(g.deadline),
                "source": "Savings Goals"
            })

        # Sort by date
        events.sort(key=lambda x: x['date'])

        return Response({"events": events}, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        title = request.data.get("title")
        event_type = request.data.get("event_type", "OTHER")
        amount_str = request.data.get("amount", 0)
        event_date = request.data.get("event_date", now().date().isoformat())

        if not title:
            return Response({"error": "Event title is required."}, status=status.HTTP_400_BAD_REQUEST)

        event = FinancialEvent.objects.create(
            user=user,
            title=title,
            event_type=event_type,
            amount=Decimal(str(amount_str or 0)),
            event_date=event_date
        )

        return Response({
            "message": "Calendar event added successfully!",
            "id": event.id
        }, status=status.HTTP_201_CREATED)
