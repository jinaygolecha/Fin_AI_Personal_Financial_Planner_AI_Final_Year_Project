from django.db import models
from django.conf import settings
from django.utils import timezone

class FinancialAccount(models.Model):
    ACCOUNT_TYPES = (
        ('BANK', 'Bank Account'),
        ('CASH', 'Cash'),
        ('WALLET', 'Digital Wallet'),
        ('CREDIT_CARD', 'Credit Card'),
        ('SAVINGS', 'Savings Account'),
        ('CURRENT', 'Current Account'),
        ('OTHER', 'Other'),
    )

    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='accounts')
    name = models.CharField(max_length=100)
    institution = models.CharField(max_length=100, blank=True, null=True)
    account_type = models.CharField(max_length=20, choices=ACCOUNT_TYPES, default='BANK')
    account_number_masked = models.CharField(max_length=20, blank=True, null=True)
    balance = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    currency = models.CharField(max_length=3, default='INR')
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.name} ({self.account_type}) - {self.user.username}"
