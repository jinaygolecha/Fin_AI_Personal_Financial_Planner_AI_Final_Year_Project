from decimal import Decimal
from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponseRedirect
from django.urls import reverse
from django.utils import timezone
from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Group, GroupExpense, GroupMember, Settlement
from .serializers import GroupSerializer, GroupExpenseSerializer, GroupMemberSerializer, SettlementSerializer

# ==================== FRONTEND VIEWS ====================

def group_expenses_view(request):
    if not request.user.is_authenticated:
        return redirect('login')
    groups = Group.objects.filter(members__user=request.user).distinct()
    return render(request, 'frontend/group_expenses.html', {'groups': groups})

def group_dashboard(request, group_id):
    if not request.user.is_authenticated:
        return redirect('login')
    group = get_object_or_404(Group, id=group_id, members__user=request.user)
    group_members = GroupMember.objects.filter(group=group)
    expenses = GroupExpense.objects.filter(group=group).order_by('-date')[:10]
    settlements = Settlement.objects.filter(group=group)

    return render(request, 'group_expenses/group_dashboard.html', {
        'group': group,
        'group_members': group_members,
        'expenses': expenses,
        'balances': settlements
    })

def add_expense(request, group_id):
    if not request.user.is_authenticated:
        return redirect('login')
    group = get_object_or_404(Group, id=group_id, members__user=request.user)

    if request.method == 'POST':
        description = request.POST.get('description')
        amount_raw = request.POST.get('amount')
        category = request.POST.get('category', 'General')
        date_str = request.POST.get('date', timezone.now().strftime('%Y-%m-%d'))
        split_type = request.POST.get('splitType', 'equal')
        paid_by_id = request.POST.get('paid_by')

        if not description or not amount_raw or not paid_by_id:
            return render(request, 'frontend/group_expenses.html', {
                'error': 'Description, amount, and payer are required.',
                'groups': Group.objects.filter(members__user=request.user).distinct()
            })

        amount = Decimal(str(amount_raw))
        paid_by_member = get_object_or_404(GroupMember, id=paid_by_id, group=group)

        expense = GroupExpense.objects.create(
            group=group,
            description=description,
            amount=amount,
            category=category,
            date=date_str,
            paid_by=paid_by_member,
            split_type=split_type
        )

        members = GroupMember.objects.filter(group=group)
        if members.exists():
            split_amount = amount / Decimal(members.count())
            expense.split_amount = split_amount
            expense.split_members.set(members)
            expense.save()

            for member in members:
                Settlement.objects.create(
                    group=group,
                    expense=expense,
                    member=member,
                    payer=paid_by_member,
                    payee=member,
                    amount=split_amount,
                    is_settled=(member.id == paid_by_member.id)
                )

        return redirect('group_expenses:group_dashboard', group_id=group_id)

    return redirect('group_expenses:group_expenses')


# ==================== REST API VIEWSETS ====================

class GroupViewSet(viewsets.ModelViewSet):
    serializer_class = GroupSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Group.objects.filter(members__user=self.request.user).distinct()

    def perform_create(self, serializer):
        group = serializer.save(created_by=self.request.user)
        # Automatically add creator as a member of the group
        GroupMember.objects.get_or_create(group=group, user=self.request.user)

    @action(detail=True, methods=['post'])
    def add_member(self, request, pk=None):
        group = self.get_object()
        user_id = request.data.get('user_id')
        if not user_id:
            return Response({'error': 'user_id is required'}, status=status.HTTP_400_BAD_REQUEST)
        
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user_to_add = get_object_or_404(User, id=user_id)
        member, created = GroupMember.objects.get_or_create(group=group, user=user_to_add)
        return Response({'message': f'Member {user_to_add.username} added successfully', 'member_id': member.id}, status=status.HTTP_200_OK)


class GroupExpenseViewSet(viewsets.ModelViewSet):
    serializer_class = GroupExpenseSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GroupExpense.objects.filter(group__members__user=self.request.user).distinct()

    def perform_create(self, serializer):
        expense = serializer.save()
        # Auto-calculate equal settlements if group members exist
        members = expense.group.members.all()
        if members.exists():
            split_amt = expense.amount / Decimal(members.count())
            expense.split_amount = split_amt
            expense.split_members.set(members)
            expense.save()

            for member in members:
                Settlement.objects.create(
                    group=expense.group,
                    expense=expense,
                    member=member,
                    payer=expense.paid_by,
                    payee=member,
                    amount=split_amt,
                    is_settled=(member.id == expense.paid_by.id)
                )


class GroupMemberViewSet(viewsets.ModelViewSet):
    serializer_class = GroupMemberSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return GroupMember.objects.filter(group__members__user=self.request.user).distinct()


class SettlementViewSet(viewsets.ModelViewSet):
    serializer_class = SettlementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Settlement.objects.filter(group__members__user=self.request.user).distinct()
