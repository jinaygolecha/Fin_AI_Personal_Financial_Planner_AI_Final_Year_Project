from rest_framework import serializers
from .models import Transaction, Budget, BudgetHistory, Category

class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ['id', 'user', 'name']
        read_only_fields = ['user']

class BudgetSerializer(serializers.ModelSerializer):
    class Meta:
        model = Budget
        fields = ['id', 'user', 'category', 'monthly_limit', 'created_at']
        read_only_fields = ['user', 'created_at']

class TransactionSerializer(serializers.ModelSerializer):
    currency = serializers.CharField(default='INR')
    category_name = serializers.CharField(source="category.name", read_only=True)

    class Meta:
        model = Transaction
        fields = ['id', 'user', 'date', 'category', 'category_name', 'category_type', 'currency', 'amount', 'description', 'created_at', 'updated_at']
        read_only_fields = ['user', 'created_at', 'updated_at']

class BudgetHistorySerializer(serializers.ModelSerializer):
    class Meta:
        model = BudgetHistory
        fields = '__all__'
        read_only_fields = ['user']
