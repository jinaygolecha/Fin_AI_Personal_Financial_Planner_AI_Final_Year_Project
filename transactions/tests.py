from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import Transaction, Category, Budget
from .categorizer import categorize_transaction

User = get_user_model()

class TransactionsTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(username='testuser', email='test@example.com', password='Password123!')
        self.category = Category.objects.create(user=self.user, name='Food')

    def test_create_transaction(self):
        t = Transaction.objects.create(
            user=self.user,
            amount=Decimal('250.00'),
            category=self.category,
            category_type='expense',
            description='Swiggy Order',
            date='2026-08-10'
        )
        self.assertEqual(t.amount, Decimal('250.00'))
        self.assertEqual(t.user.username, 'testuser')

    def test_ml_categorizer_fallback(self):
        cat = categorize_transaction('Zomato dinner with friends')
        self.assertEqual(cat, 'Food')

    def test_transaction_api(self):
        self.client.force_authenticate(user=self.user)
        payload = {
            'amount': '150.00',
            'category_type': 'expense',
            'description': 'Coffee at Starbucks',
            'date': '2026-08-10',
            'currency': 'INR'
        }
        response = self.client.post('/api/transactions/', payload, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Transaction.objects.filter(user=self.user).count(), 1)
