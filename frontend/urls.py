from django.urls import path
from .views import (
    homepage_view, login_view, signup_view, dashboard_view, onboarding_page_view,
    transaction_page_view, budget_page_view, investments_page_view, loans_page_view, calendar_page_view, ai_advisor_page_view, goals_page_view,
    recurring_page_view, dashboard_stats, financial_summary, spending_analysis
)

app_name = 'frontend'

urlpatterns = [
    path('', homepage_view, name='home'),
    path('login/', login_view, name='login'),
    path('signup/', signup_view, name='signup'),
    path('onboarding/', onboarding_page_view, name='onboarding'),
    path('dashboard/', dashboard_view, name='dashboard'),
    path('transactions/', transaction_page_view, name='transactions'),
    path('budget/', budget_page_view, name='budget'),
    path('investments/', investments_page_view, name='investments'),
    path('loans/', loans_page_view, name='loans'),
    path('calendar/', calendar_page_view, name='calendar'),
    path('ai-advisor/', ai_advisor_page_view, name='ai_advisor'),
    path('goals/', goals_page_view, name='goals'),
    path('recurring/', recurring_page_view, name='recurring'),
    path('dashboard-stats/', dashboard_stats, name='dashboard_stats'),
    path('financial-summary/', financial_summary, name='financial_summary'),
    path('spending-analysis/', spending_analysis, name='spending_analysis'),
]
