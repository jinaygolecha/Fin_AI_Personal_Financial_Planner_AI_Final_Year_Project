from django.db import models
from django.conf import settings
from django.utils import timezone

class Group(models.Model):
    name = models.CharField(max_length=255)
    description = models.TextField(blank=True, null=True)
    created_by = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='created_groups', null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return self.name

class GroupMember(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name='members')
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='group_memberships')
    joined_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = ('group', 'user')

    def __str__(self):
        return f"{self.user.username} in {self.group.name}"

class GroupExpense(models.Model):
    SPLIT_CHOICES = (
        ('equal', 'Equal'),
        ('unequal', 'Unequal'),
    )

    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="expenses", null=True, blank=True)
    description = models.CharField(max_length=255)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    category = models.CharField(max_length=50, default='General')
    date = models.DateField(default=timezone.now)
    paid_by = models.ForeignKey(GroupMember, on_delete=models.CASCADE, related_name="expenses_paid")
    split_type = models.CharField(max_length=20, choices=SPLIT_CHOICES, default='equal')
    split_members = models.ManyToManyField(GroupMember, related_name="expenses_split", blank=True)
    split_amount = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    created_at = models.DateTimeField(default=timezone.now)

    def __str__(self):
        return f"{self.description} ({self.amount})"

class Settlement(models.Model):
    group = models.ForeignKey(Group, on_delete=models.CASCADE, related_name="settlements", null=True, blank=True)
    expense = models.ForeignKey(GroupExpense, on_delete=models.CASCADE, related_name="settlements", null=True, blank=True)
    member = models.ForeignKey(GroupMember, on_delete=models.CASCADE, related_name="settlements_member")
    payer = models.ForeignKey(GroupMember, on_delete=models.CASCADE, related_name="settlements_as_payer", null=True, blank=True)
    payee = models.ForeignKey(GroupMember, on_delete=models.CASCADE, related_name="settlements_as_payee", null=True, blank=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    razorpay_payment_id = models.CharField(max_length=255, blank=True, null=True)
    is_settled = models.BooleanField(default=False)
    settled_at = models.DateTimeField(null=True, blank=True)

    def __str__(self):
        username = self.member.user.username if self.member and self.member.user else "Member"
        return f"{username} - ₹{self.amount} ({'Settled' if self.is_settled else 'Pending'})"
