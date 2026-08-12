from django.db import models
from django.conf import settings

class Portfolio(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='portfolio')
    total_invested = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    current_value = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Portfolio"

class Investment(models.Model):
    ASSET_TYPES = [
        ('STOCK', 'Stock'),
        ('MUTUAL_FUND', 'Mutual Fund'),
        ('SIP', 'SIP'),
        ('GOLD', 'Gold'),
        ('CRYPTO', 'Cryptocurrency'),
        ('ETF', 'ETF'),
        ('OTHER', 'Other'),
    ]

    portfolio = models.ForeignKey(Portfolio, on_delete=models.CASCADE, related_name='investments')
    symbol = models.CharField(max_length=50) # e.g. RELIANCE, BTC
    asset_type = models.CharField(max_length=20, choices=ASSET_TYPES)
    quantity = models.DecimalField(max_digits=15, decimal_places=6)
    average_buy_price = models.DecimalField(max_digits=15, decimal_places=2)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.symbol} - {self.asset_type}"

class Watchlist(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='watchlist')
    symbol = models.CharField(max_length=50)
    asset_type = models.CharField(max_length=20, choices=Investment.ASSET_TYPES)
    alert_price_above = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    alert_price_below = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)

    class Meta:
        unique_together = ('user', 'symbol')

    def __str__(self):
        return f"{self.symbol} (Watchlist) - {self.user.username}"
