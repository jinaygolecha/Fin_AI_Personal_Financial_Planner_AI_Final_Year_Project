from django.urls import path
from .views import loans_api_view, prepayment_simulate_api_view, subscriptions_api_view

urlpatterns = [
    path('', loans_api_view, name='loans_list_create'),
    path('prepayment-simulate/', prepayment_simulate_api_view, name='prepayment_simulate'),
    path('subscriptions/', subscriptions_api_view, name='subscriptions_list_create'),
]
