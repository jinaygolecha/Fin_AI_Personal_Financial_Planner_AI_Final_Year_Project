import csv
from decimal import Decimal
from django.db import transaction as db_transaction
from django.http import HttpResponse
from django.utils.timezone import now
from rest_framework import status, generics
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from .models import FinancialAccount
from transactions.models import Transaction, Category
from users.utils import format_inr

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def accounts_api_view(request):
    user = request.user
    if request.method == 'GET':
        accounts = FinancialAccount.objects.filter(user=user, is_active=True).order_by('-created_at')
        data = [
            {
                "id": acc.id,
                "name": acc.name,
                "institution": acc.institution or "General",
                "account_type": acc.get_account_type_display(),
                "raw_account_type": acc.account_type,
                "balance": float(acc.balance),
                "formatted_balance": format_inr(acc.balance),
                "currency": acc.currency
            }
            for acc in accounts
        ]
        return Response(data, status=status.HTTP_200_OK)

    elif request.method == 'POST':
        name = request.data.get("name")
        account_type = request.data.get("account_type", "BANK")
        institution = request.data.get("institution", "")
        initial_balance = request.data.get("balance", 0)

        if not name:
            return Response({"error": "Account name is required."}, status=status.HTTP_400_BAD_REQUEST)

        account = FinancialAccount.objects.create(
            user=user,
            name=name,
            account_type=account_type,
            institution=institution,
            balance=Decimal(str(initial_balance or 0)),
            currency="INR"
        )

        return Response({
            "message": "Account created successfully!",
            "id": account.id,
            "name": account.name,
            "balance": float(account.balance),
            "formatted_balance": format_inr(account.balance)
        }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def add_money_api_view(request):
    """
    Atomically add money to a user account, create an income transaction record, and update balances.
    """
    user = request.user
    account_id = request.data.get("account_id")
    amount_str = request.data.get("amount")
    source = request.data.get("source", "Salary / Deposit")
    description = request.data.get("description", "Added funds")
    date_str = request.data.get("date", now().date().isoformat())

    if not amount_str:
        return Response({"error": "Amount is required."}, status=status.HTTP_400_BAD_REQUEST)

    try:
        amount = Decimal(str(amount_str))
        if amount <= 0:
            return Response({"error": "Amount must be greater than zero."}, status=status.HTTP_400_BAD_REQUEST)
    except Exception:
        return Response({"error": "Invalid numeric amount."}, status=status.HTTP_400_BAD_REQUEST)

    with db_transaction.atomic():
        if account_id:
            try:
                account = FinancialAccount.objects.select_for_update().get(id=account_id, user=user)
            except FinancialAccount.DoesNotExist:
                return Response({"error": "Selected account not found."}, status=status.HTTP_404_NOT_FOUND)
        else:
            account, _ = FinancialAccount.objects.select_for_update().get_or_create(
                user=user,
                name="Primary Account",
                defaults={"account_type": "BANK", "balance": Decimal(0), "currency": "INR"}
            )

        account.balance += amount
        account.save()

        category_obj, _ = Category.objects.get_or_create(user=user, name="Income")

        tx = Transaction.objects.create(
            user=user,
            account=account,
            amount=amount,
            category=category_obj,
            category_type="income",
            description=f"[{source}] {description}",
            date=date_str,
            currency="INR"
        )

    return Response({
        "message": f"Successfully added {format_inr(amount)} to {account.name}!",
        "new_balance": float(account.balance),
        "formatted_new_balance": format_inr(account.balance),
        "transaction_id": tx.id
    }, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def export_accounts_csv(request):
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{request.user.username}_accounts.csv"'

    writer = csv.writer(response)
    writer.writerow(['ID', 'Account Name', 'Type', 'Institution', 'Balance (INR)', 'Currency'])

    accounts = FinancialAccount.objects.filter(user=request.user)
    for acc in accounts:
        writer.writerow([acc.id, acc.name, acc.account_type, acc.institution, float(acc.balance), acc.currency])

    return response
