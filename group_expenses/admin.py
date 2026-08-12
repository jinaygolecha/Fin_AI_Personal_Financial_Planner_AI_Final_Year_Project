from django.contrib import admin
from .models import Group, GroupMember, GroupExpense, Settlement

@admin.register(Group)
class GroupAdmin(admin.ModelAdmin):
    list_display = ['name', 'created_by', 'created_at']
    search_fields = ['name']

@admin.register(GroupMember)
class GroupMemberAdmin(admin.ModelAdmin):
    list_display = ['group', 'user', 'joined_at']

@admin.register(GroupExpense)
class GroupExpenseAdmin(admin.ModelAdmin):
    list_display = ['description', 'group', 'amount', 'paid_by', 'date']
    list_filter = ['category', 'split_type']

@admin.register(Settlement)
class SettlementAdmin(admin.ModelAdmin):
    list_display = ['group', 'member', 'amount', 'is_settled']
    list_filter = ['is_settled']
