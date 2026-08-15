from django.urls import path
from .views import financial_plan_api_view, goals_api_view

urlpatterns = [
    path('financial-plan/', financial_plan_api_view, name='financial_plan_api'),
    path('goals/', goals_api_view, name='goals_api'),
]
