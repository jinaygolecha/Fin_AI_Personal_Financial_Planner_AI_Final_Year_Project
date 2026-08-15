from django.contrib.auth.models import AbstractUser
from django.db import models
from django.conf import settings
import uuid



class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    phone_no = models.CharField(max_length=15, blank=True, null=True)
    avatar = models.ImageField(upload_to='avatar/', blank=True, null=True)
    is_premium = models.BooleanField(default=False)
    
    country = models.CharField(max_length=50, default='India')
    timezone = models.CharField(max_length=50, default='Asia/Kolkata')
    currency = models.CharField(max_length=3, default='INR')
    
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    
    # Role-Based Fields
    ROLE_CHOICES = (
        ('admin', 'Admin'),
        ('family_admin', 'Family Admin'),
        ('premium_user', 'Premium User'),
        ('user', 'User'),
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES, default='user')
    

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    def __str__(self):
        return self.username






class FinancialData(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    monthly_income_salary = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    monthly_income_business = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    monthly_income_freelance = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    monthly_income_other = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    rent = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    bills = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    loans = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    subscriptions = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    savings_cash = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    savings_stocks = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    savings_crypto = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    savings_real_estate = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)
    
    total_debt = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    def __str__(self):
        return f"{self.user.username} - Financial Data"


class Profile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    avatar = models.ImageField(upload_to='avatar/', blank=True, null=True)
    preferred_currency = models.CharField(max_length=3, choices=[
        ('USD', 'USD'),
        ('INR', 'INR'),
        ('EUR', 'EUR')
    ], default='INR')
    date_of_birth = models.DateField(null=True, blank=True)
    occupation = models.CharField(max_length=20, choices=[
        ('Student', 'Student'),
        ('Employee', 'Employee'),
        ('Business', 'Business'),
        ('Retired', 'Retired')
    ])
    annual_income = models.CharField(max_length=20, choices=[
        ('<10K', '<$10K'),
        ('10K-50K', '$10K-$50K'),
        ('50K-100K', '$50K-$100K'),
        ('100K+', '$100K+')
    ])
    financial_goal = models.CharField(max_length=50, choices=[
        ('Savings', 'Savings'),
        ('Investment', 'Investment'),
        ('Budgeting', 'Budgeting'),
        ('Debt Management', 'Debt Management')
    ])
    investment_risk = models.CharField(max_length=10, choices=[
        ('Low', 'Low'),
        ('Medium', 'Medium'),
        ('High', 'High')
    ])
    subscription_plan = models.CharField(max_length=10, choices=[
        ('Free', 'Free'),
        ('Premium', 'Premium')
    ])

    def __str__(self):
        return f"{self.user.username} - {self.financial_goal}"


class FinancialProfile(models.Model):
    user = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='financial_profile')
    age = models.IntegerField(default=25)
    city = models.CharField(max_length=100, default='Mumbai')
    country = models.CharField(max_length=50, default='India')
    currency = models.CharField(max_length=3, default='INR')
    
    monthly_salary = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    other_monthly_income = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    
    estimated_monthly_expenses = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    current_savings = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    emergency_fund = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    total_debt = models.DecimalField(max_digits=15, decimal_places=2, default=0.00)
    
    risk_profile = models.CharField(max_length=20, default='Moderate') # Conservative, Moderate, Aggressive
    budget_method = models.CharField(max_length=20, default='50/30/20') # 50/30/20, Zero-Based, Custom
    financial_priorities = models.TextField(blank=True, default='Save more, Build emergency fund')
    
    is_onboarding_complete = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.user.username}'s Financial Profile"

    

