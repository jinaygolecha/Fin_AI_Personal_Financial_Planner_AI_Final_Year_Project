from django.urls import path
from .views import (
    process_voice_entry, confirm_voice_transaction, get_transactions,
    upcoming_bills, export_transactions_csv, TransactionListCreateView,
    TransactionDetailView, CategoryListCreateView, CurrencyConverter,
    BudgetView, BudgetHistoryView
)

urlpatterns = [
    path('voice-entry/', process_voice_entry, name='process_voice_entry'),
    path('confirm-voice/', confirm_voice_transaction, name='confirm_voice_transaction'),
    path('list/', get_transactions, name='get_transactions'),
    path('upcoming-bills/', upcoming_bills, name='upcoming_bills'),
    path('export-csv/', export_transactions_csv, name='export_transactions_csv'),
    path('', TransactionListCreateView.as_view(), name='transaction_list_create'),
    path('<int:pk>/', TransactionDetailView.as_view(), name='transaction_detail'),
    path('categories/', CategoryListCreateView.as_view(), name='category_list'),
    path('currency-convert/', CurrencyConverter.as_view(), name='currency_converter'),
    path('budget/', BudgetView.as_view(), name='budget'),
    path('budget-history/', BudgetHistoryView.as_view(), name='budget_history'),
]
