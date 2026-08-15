from django.db import models
from django.conf import settings

class Loan(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='loans')
    loan_type = models.CharField(max_length=50, choices=[
        ('HOME', 'Home Loan'),
        ('PERSONAL', 'Personal Loan'),
        ('AUTO', 'Auto Loan'),
        ('EDUCATION', 'Education Loan'),
        ('OTHER', 'Other')
    ])
    principal_amount = models.DecimalField(max_digits=15, decimal_places=2)
    interest_rate = models.DecimalField(max_digits=5, decimal_places=2) # Annual %
    tenure_months = models.IntegerField()
    start_date = models.DateField()
    emi_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    outstanding_balance = models.DecimalField(max_digits=15, decimal_places=2)
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.loan_type} - {self.user.username}"

class InsurancePolicy(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='insurance_policies')
    provider = models.CharField(max_length=100)
    policy_type = models.CharField(max_length=50, choices=[
        ('LIFE', 'Life Insurance'),
        ('HEALTH', 'Health Insurance'),
        ('VEHICLE', 'Vehicle Insurance'),
        ('HOME', 'Home Insurance'),
        ('OTHER', 'Other')
    ])
    coverage_amount = models.DecimalField(max_digits=15, decimal_places=2)
    premium_amount = models.DecimalField(max_digits=15, decimal_places=2)
    premium_frequency = models.CharField(max_length=20, choices=[
        ('MONTHLY', 'Monthly'),
        ('QUARTERLY', 'Quarterly'),
        ('YEARLY', 'Yearly')
    ])
    next_due_date = models.DateField()

    def __str__(self):
        return f"{self.policy_type} ({self.provider}) - {self.user.username}"

class Subscription(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='loan_subscriptions')
    service_name = models.CharField(max_length=100)
    cost = models.DecimalField(max_digits=10, decimal_places=2)
    billing_cycle = models.CharField(max_length=20, choices=[
        ('MONTHLY', 'Monthly'),
        ('YEARLY', 'Yearly')
    ])
    next_billing_date = models.DateField()
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return f"{self.service_name} - {self.user.username}"
