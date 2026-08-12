from rest_framework import serializers
from .models import Group, GroupExpense, GroupMember, Settlement
from users.serializers import UserSerializer

class GroupMemberSerializer(serializers.ModelSerializer):
    user_details = UserSerializer(source='user', read_only=True)

    class Meta:
        model = GroupMember
        fields = ['id', 'group', 'user', 'user_details', 'joined_at']
        read_only_fields = ['joined_at']

class GroupExpenseSerializer(serializers.ModelSerializer):
    paid_by_name = serializers.CharField(source='paid_by.user.username', read_only=True)

    class Meta:
        model = GroupExpense
        fields = [
            'id', 'group', 'description', 'amount', 'category', 'date',
            'paid_by', 'paid_by_name', 'split_type', 'split_members', 'split_amount', 'created_at'
        ]
        read_only_fields = ['created_at']

class SettlementSerializer(serializers.ModelSerializer):
    member_name = serializers.CharField(source='member.user.username', read_only=True)
    payer_name = serializers.CharField(source='payer.user.username', read_only=True)
    payee_name = serializers.CharField(source='payee.user.username', read_only=True)

    class Meta:
        model = Settlement
        fields = [
            'id', 'group', 'expense', 'member', 'member_name', 'payer', 'payer_name',
            'payee', 'payee_name', 'amount', 'razorpay_payment_id', 'is_settled', 'settled_at'
        ]

class GroupSerializer(serializers.ModelSerializer):
    members = GroupMemberSerializer(many=True, read_only=True)
    expenses = GroupExpenseSerializer(many=True, read_only=True)

    class Meta:
        model = Group
        fields = ['id', 'name', 'description', 'created_by', 'created_at', 'members', 'expenses']
        read_only_fields = ['created_at', 'created_by']
