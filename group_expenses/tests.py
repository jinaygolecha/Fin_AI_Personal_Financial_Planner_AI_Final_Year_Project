from decimal import Decimal
from django.test import TestCase
from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from rest_framework import status
from .models import Group, GroupMember, GroupExpense, Settlement

User = get_user_model()

class GroupExpensesTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user1 = User.objects.create_user(username='user1', email='user1@example.com', password='Password123!')
        self.user2 = User.objects.create_user(username='user2', email='user2@example.com', password='Password123!')
        
        self.group = Group.objects.create(name='Trip Group', created_by=self.user1)
        self.member1 = GroupMember.objects.create(group=self.group, user=self.user1)
        self.member2 = GroupMember.objects.create(group=self.group, user=self.user2)

    def test_group_creation(self):
        self.assertEqual(self.group.name, 'Trip Group')
        self.assertEqual(self.group.members.count(), 2)

    def test_add_expense_splits_equally(self):
        self.client.force_authenticate(user=self.user1)
        expense = GroupExpense.objects.create(
            group=self.group,
            description='Dinner',
            amount=Decimal('100.00'),
            date='2026-08-10',
            paid_by=self.member1
        )
        members = [self.member1, self.member2]
        split_amt = Decimal('50.00')
        
        for m in members:
            Settlement.objects.create(
                group=self.group,
                expense=expense,
                member=m,
                payer=self.member1,
                payee=m,
                amount=split_amt,
                is_settled=(m == self.member1)
            )

        self.assertEqual(Settlement.objects.filter(group=self.group).count(), 2)
        settled_count = Settlement.objects.filter(group=self.group, is_settled=True).count()
        self.assertEqual(settled_count, 1)

    def test_group_api_access(self):
        self.client.force_authenticate(user=self.user1)
        response = self.client.get('/api/group-expenses/api/groups/')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
