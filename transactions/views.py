import csv
import requests
from datetime import timedelta
from decimal import Decimal

from django.utils.timezone import now
from django.http import JsonResponse, HttpResponse
from django.db.models import Sum
from django.conf import settings
from django.shortcuts import get_object_or_404

from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework import generics, filters, status, serializers
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView

from .models import Transaction, Budget, BudgetHistory, Category
from .serializers import TransactionSerializer, CategorySerializer, BudgetSerializer, BudgetHistorySerializer
from .categorizer import categorize_transaction
from users.models import Profile
from payments.models import RecurringPayment


# ==================== VOICE & AI ENTRY ====================

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def process_voice_entry(request):
    """
    Processes voice input and returns structured transaction details for user confirmation.
    """
    voice_text = request.data.get("voice_text", "")
    if not voice_text:
        return Response({"error": "No voice input received"}, status=400)

    category = categorize_transaction(voice_text)
    # Simple extraction heuristic
    import re
    numbers = re.findall(r'\d+(?:\.\d+)?', voice_text)
    amount = float(numbers[0]) if numbers else 0.0

    category_type = "expense"
    if any(w in voice_text.lower() for w in ['salary', 'income', 'received', 'got', 'earned']):
        category_type = "income"

    transaction_data = {
        "voice_text": voice_text,
        "suggested_amount": amount,
        "suggested_category": category,
        "suggested_type": category_type
    }
    return Response(transaction_data, status=200)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def confirm_voice_transaction(request):
    """
    Saves user-confirmed voice transaction to the database.
    """
    user = request.user
    amount = request.data.get("amount")
    category_type = request.data.get("category_type", "expense")
    category_name = request.data.get("category", "General")
    description = request.data.get("description", "Voice Transaction")
    date_str = request.data.get("date", now().date().isoformat())

    if not amount:
        return Response({"error": "Amount is required"}, status=400)

    category_obj, _ = Category.objects.get_or_create(user=user, name=category_name)

    transaction = Transaction.objects.create(
        user=user,
        amount=Decimal(str(amount)),
        category=category_obj,
        category_type=category_type,
        description=description,
        date=date_str
    )

    return Response({
        "message": "Transaction saved successfully!",
        "transaction": TransactionSerializer(transaction).data
    }, status=201)


# ==================== TRANSACTIONS API ====================

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_transactions(request):
    """
    Fetch latest 10 transactions for the authenticated user.
    """
    transactions = Transaction.objects.filter(user=request.user).select_related('category').order_by('-date')[:10]

    data = [
        {
            "id": t.id,
            "category_name": t.category.name if t.category else "Uncategorized",
            "category_type": t.category_type,
            "description": t.description,
            "amount": float(t.amount),
            "date": t.date.isoformat(),
            "currency": t.currency,
        }
        for t in transactions
    ]
    return Response(data, status=200)


@api_view(['POST', 'GET'])
@permission_classes([IsAuthenticated])
def export_transactions_csv(request):
    """
    Export current user's transactions as a CSV file.
    """
    response = HttpResponse(content_type='text/csv')
    response['Content-Disposition'] = f'attachment; filename="{request.user.username}_transactions.csv"'

    writer = csv.writer(response)
    writer.writerow(['ID', 'Date', 'Category', 'Type', 'Amount', 'Currency', 'Description'])

    transactions = Transaction.objects.filter(user=request.user).values_list(
        'id', 'date', 'category__name', 'category_type', 'amount', 'currency', 'description'
    )
    for transaction in transactions:
        writer.writerow(transaction)

    return response


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def upcoming_bills(request):
    """
    Fetch upcoming active recurring payments for the user.
    """
    today = now().date()
    upcoming_payments = RecurringPayment.objects.filter(
        user=request.user,
        next_payment_date__gte=today,
        status="active"
    ).order_by('next_payment_date')

    bills_list = [
        {
            "id": payment.id,
            "name": payment.name,
            "amount": float(payment.amount),
            "category": payment.category,
            "frequency": payment.frequency,
            "days_remaining": (payment.next_payment_date - today).days,
            "next_payment_date": payment.next_payment_date.strftime("%Y-%m-%d")
        } for payment in upcoming_payments
    ]

    return Response(bills_list, status=200)


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10
    page_size_query_param = 'page_size'
    max_page_size = 100


class TransactionListCreateView(generics.ListCreateAPIView):
    serializer_class = TransactionSerializer
    pagination_class = StandardResultsSetPagination
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['description', 'category__name']
    ordering_fields = ['date', 'amount']
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        user = self.request.user
        queryset = Transaction.objects.filter(user=user).order_by('-date')
        category_id = self.request.query_params.get('category', None)
        min_amount = self.request.query_params.get('min_amount', None)
        date = self.request.query_params.get('date', None)

        if category_id:
            queryset = queryset.filter(category__id=category_id)
        if min_amount:
            queryset = queryset.filter(amount__gte=min_amount)
        if date:
            queryset = queryset.filter(date=date)

        return queryset

    def perform_create(self, serializer):
        # Auto-assign ML category if not provided
        description = serializer.validated_data.get('description', '')
        category = serializer.validated_data.get('category', None)
        if not category and description:
            cat_name = categorize_transaction(description)
            cat_obj, _ = Category.objects.get_or_create(user=self.request.user, name=cat_name)
            serializer.save(user=self.request.user, category=cat_obj)
        else:
            serializer.save(user=self.request.user)


class TransactionDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = TransactionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Transaction.objects.filter(user=self.request.user)


class CategoryListCreateView(generics.ListCreateAPIView):
    serializer_class = CategorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Category.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class CurrencyConverter(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        base_currency = request.query_params.get('base', 'USD')
        target_currency = request.query_params.get('target', 'INR')

        try:
            api_url = f"https://api.exchangerate-api.com/v4/latest/{base_currency}"
            response = requests.get(api_url, timeout=5)
            if response.status_code == 200:
                data = response.json()
                conversion_rate = data["rates"].get(target_currency, 1.0)
                return Response({"base": base_currency, "target": target_currency, "rate": conversion_rate}, status=200)
        except Exception:
            pass

        # Fallback fixed rates if API is unavailable
        fallback_rates = {'INR': 83.50, 'EUR': 0.92, 'USD': 1.00}
        rate = fallback_rates.get(target_currency, 1.0) / fallback_rates.get(base_currency, 1.0)
        return Response({"base": base_currency, "target": target_currency, "rate": round(rate, 4)}, status=200)


class BudgetView(generics.ListCreateAPIView):
    serializer_class = BudgetSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return Budget.objects.filter(user=self.request.user)

    def perform_create(self, serializer):
        serializer.save(user=self.request.user)


class BudgetHistoryView(generics.ListAPIView):
    serializer_class = BudgetHistorySerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = BudgetHistory.objects.filter(user=self.request.user)
        month = self.request.query_params.get('month')
        year = self.request.query_params.get('year')
        if month:
            queryset = queryset.filter(month=month)
        if year:
            queryset = queryset.filter(year=year)
        return queryset