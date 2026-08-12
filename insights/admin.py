from django.contrib import admin
from .models import BudgetInsight, SavingsGoal

@admin.register(BudgetInsight)
class BudgetInsightAdmin(admin.ModelAdmin):
    list_display = ['user', 'category', 'average_spending', 'forecasted_spending', 'created_at']

@admin.register(SavingsGoal)
class SavingsGoalAdmin(admin.ModelAdmin):
    list_display = ['user', 'goal_name', 'target_amount', 'saved_amount', 'status', 'deadline']
    list_filter = ['status']
