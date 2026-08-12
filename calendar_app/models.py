from django.db import models
from django.conf import settings

class FinancialEvent(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='calendar_events')
    title = models.CharField(max_length=200)
    event_type = models.CharField(max_length=50, choices=[
        ('EMI', 'Loan EMI'),
        ('SIP', 'Investment SIP'),
        ('BILL', 'Utility Bill'),
        ('SUBSCRIPTION', 'Subscription Renewal'),
        ('OTHER', 'Other')
    ])
    amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    event_date = models.DateField()
    is_recurring = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.title} on {self.event_date} - {self.user.username}"
