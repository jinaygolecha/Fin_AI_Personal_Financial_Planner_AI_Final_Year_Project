from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status

User = get_user_model()

class UserAuthenticationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user_data = {
            'username': 'jinay_test',
            'email': 'jinay@example.com',
            'password': 'Password123!',
            'phone_no': '9876543210'
        }
        self.user = User.objects.create_user(**self.user_data)

    def test_user_creation(self):
        self.assertEqual(self.user.username, 'jinay_test')
        self.assertEqual(self.user.email, 'jinay@example.com')
        self.assertTrue(self.user.check_password('Password123!'))

    def test_user_signup_api(self):
        new_user = {
            'username': 'new_user',
            'email': 'new@example.com',
            'password': 'Password123!',
            'phone_no': '9998887770'
        }
        response = self.client.post('/api/users/signup/', new_user, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertIn('access', response.data)

    def test_jwt_login_api(self):
        login_data = {
            'username': 'jinay@example.com',
            'password': 'Password123!'
        }
        response = self.client.post('/api/users/login/', login_data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('access', response.data)
        self.assertIn('refresh', response.data)

    def test_authenticated_profile_api(self):
        self.client.force_authenticate(user=self.user)
        response = self.client.get('/api/users/user-profile/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['username'], 'jinay_test')

    def test_onboarding_and_plan_generation(self):
        self.client.force_authenticate(user=self.user)
        onboarding_payload = {
            'age': 25,
            'city': 'Mumbai',
            'monthly_salary': 100000,
            'estimated_monthly_expenses': 40000,
            'current_savings': 150000,
            'total_debt': 0,
            'risk_profile': 'Moderate',
            'budget_method': '50/30/20'
        }
        res = self.client.post('/api/users/onboarding/', onboarding_payload, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertTrue(res.data['is_onboarding_complete'])

    def test_add_money_api(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/accounts/add-money/', {'amount': 50000, 'source': 'Salary'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('formatted_new_balance', res.data)

    def test_investments_portfolio_api(self):
        self.client.force_authenticate(user=self.user)
        self.client.post('/api/investments/buy/', {'symbol': 'RELIANCE', 'asset_type': 'STOCK', 'quantity': 10, 'buy_price': 2500}, format='json')
        res = self.client.get('/api/investments/portfolio/')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('formatted_total_invested', res.data)

    def test_prepayment_simulation_api(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/loans/prepayment-simulate/', {'prepayment_amount': 50000}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('formatted_interest_saved', res.data)

    def test_ai_chatbot_api(self):
        self.client.force_authenticate(user=self.user)
        res = self.client.post('/api/ai/chat/', {'message': 'What is my net worth?'}, format='json')
        self.assertEqual(res.status_code, status.HTTP_200_OK)
        self.assertIn('formatted_net_worth', res.data)

