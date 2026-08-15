from django.urls import path
from .views import (
    add_savings_goal, get_savings_progress, update_goal_savings,
    ai_insights, accept_suggested_budget, BudgetInsightView,
    get_savings_insights, get_savings_projections, get_notifications,
    spending_insights_view, forecast_spending_view, savings_suggestions_view,
    dashboard_data
)

urlpatterns = [
    path('dashboard/', dashboard_data, name='dashboard_data'),
    path("add-goal/", add_savings_goal, name="add_savings_goal"),
    path("goal-progress/", get_savings_progress, name="get_savings_progress"),
    path('ai-insights/', ai_insights, name='ai_insights'),
    path('accept-suggested-budget/', accept_suggested_budget, name='accept_suggested_budget'),
    path('budget-insights/', BudgetInsightView.as_view(), name='budget_insights'),
    path('savings-insights/', get_savings_insights, name='savings_insights'),
    path('savings-projections/', get_savings_projections, name='savings_projections'),
    path('update-goal-savings/', update_goal_savings, name='update_goal_savings'),
    path('notifications/', get_notifications, name='get_notifications'),
    path('spending-insights/', spending_insights_view, name='spending_insights'),
    path('forecast/<str:category>/', forecast_spending_view, name='forecast_spending'),
    path('suggestions/', savings_suggestions_view, name='savings_suggestions'),
]
