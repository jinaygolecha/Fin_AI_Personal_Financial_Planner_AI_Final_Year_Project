from django.contrib import admin
from .models import Payment, Subscription, RecurringPayment

@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ['payment_id', 'user', 'amount', 'status', 'created_at']
    list_filter = ['status']

@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    list_display = ['subscription_id', 'user', 'plan', 'status', 'start_date']
    list_filter = ['status', 'plan']

@admin.register(RecurringPayment)
class RecurringPaymentAdmin(admin.ModelAdmin):
    list_display = ['name', 'user', 'amount', 'frequency', 'next_payment_date', 'status']
    list_filter = ['status', 'frequency', 'category']
