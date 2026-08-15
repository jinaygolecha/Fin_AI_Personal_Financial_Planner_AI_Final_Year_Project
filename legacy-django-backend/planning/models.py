from django.db import models
from django.conf import settings

class Goal(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='goals')
    name = models.CharField(max_length=100)
    goal_type = models.CharField(max_length=50, choices=[
        ('EMERGENCY', 'Emergency Fund'),
        ('RETIREMENT', 'Retirement'),
        ('HOME', 'Buy a Home'),
        ('CAR', 'Buy a Car'),
        ('VACATION', 'Vacation'),
        ('OTHER', 'Other')
    ])
    target_amount = models.DecimalField(max_digits=15, decimal_places=2)
    current_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    target_date = models.DateField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} - {self.user.username}"

class Budget(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='planning_budgets')
    category = models.CharField(max_length=100)
    monthly_limit = models.DecimalField(max_digits=10, decimal_places=2)
    month = models.IntegerField()
    year = models.IntegerField()
    spent = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    class Meta:
        unique_together = ('user', 'category', 'month', 'year')

    def __str__(self):
        return f"{self.category} ({self.month}/{self.year}) - {self.user.username}"


class FinancialPlan(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='financial_plan')
    income = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    expenses = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    
    savings_target = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    emergency_fund_target = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    investment_target = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    debt_payment_target = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    
    financial_health_score = models.IntegerField(default=50)
    risk_profile = models.CharField(max_length=20, default='Moderate')
    budget_method = models.CharField(max_length=20, default='50/30/20')
    
    plan_summary = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Financial Plan - {self.user.username} (Score: {self.financial_health_score})"

