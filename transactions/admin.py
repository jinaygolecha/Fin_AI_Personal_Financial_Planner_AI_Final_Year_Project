from django.contrib import admin
from .models import Transaction, Category, Budget, Alert, BudgetHistory

@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ('user', 'amount', 'category', 'category_type', 'date')
    search_fields = ('user__username', 'description')
    list_filter = ('category_type', 'date')

@admin.register(Category)
class CategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'user')
    search_fields = ('name', 'user__username')

@admin.register(Budget)
class BudgetAdmin(admin.ModelAdmin):
    list_display = ('user', 'category', 'monthly_limit', 'created_at')
    search_fields = ('user__username', 'category')

@admin.register(Alert)
class AlertAdmin(admin.ModelAdmin):
    list_display = ('user', 'message', 'is_read', 'created_at')
    list_filter = ('is_read',)

@admin.register(BudgetHistory)
class BudgetHistoryAdmin(admin.ModelAdmin):
    list_display = ('user', 'category', 'month', 'year', 'previous_limit', 'actual_spent')
