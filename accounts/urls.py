from django.urls import path
from .views import accounts_api_view, add_money_api_view, export_accounts_csv

urlpatterns = [
    path('', accounts_api_view, name='accounts_list_create'),
    path('add-money/', add_money_api_view, name='add_money'),
    path('export-csv/', export_accounts_csv, name='export_accounts_csv'),
]
