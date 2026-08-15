from rest_framework import serializers
from .models import Payment, Subscription, RecurringPayment

class PaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ['user', 'created_at']

class SubscriptionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Subscription
        fields = '__all__'
        read_only_fields = ['user', 'created_at']

class RecurringPaymentSerializer(serializers.ModelSerializer):
    class Meta:
        model = RecurringPayment
        fields = '__all__'
        read_only_fields = ['user', 'created_at', 'updated_at']
