from django.urls import path
from .views import portfolio_api_view, stock_quote_api_view, buy_investment_api_view

urlpatterns = [
    path('portfolio/', portfolio_api_view, name='portfolio'),
    path('quote/', stock_quote_api_view, name='stock_quote'),
    path('buy/', buy_investment_api_view, name='buy_investment'),
]
