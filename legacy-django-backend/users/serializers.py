from rest_framework import serializers
from django.contrib.auth import get_user_model
from .models import Profile, FinancialData

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'phone_no', 'is_premium', 'role', 'avatar_url', 'date_joined']
        read_only_fields = ['id', 'date_joined']

    def get_avatar_url(self, obj):
        if hasattr(obj, 'avatar') and obj.avatar:
            return obj.avatar.url
        return None

from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError

class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    phone_no = serializers.CharField(required=False, allow_blank=True, allow_null=True)

    class Meta:
        model = User
        fields = ['username', 'email', 'password', 'phone_no']

    def validate_password(self, value):
        try:
            validate_password(value)
        except ValidationError as e:
            raise serializers.ValidationError(list(e.messages))
        return value

    def create(self, validated_data):
        user = User.objects.create_user(**validated_data)
        return user

class ProfileSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = '__all__'
        read_only_fields = ['user']

class FinancialDataSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinancialData
        fields = '__all__'
        read_only_fields = ['user']
