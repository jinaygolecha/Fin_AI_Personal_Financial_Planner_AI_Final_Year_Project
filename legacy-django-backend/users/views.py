from rest_framework import generics, status
from rest_framework.response import Response
from django.contrib.auth import get_user_model, authenticate
from rest_framework.views import APIView
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.shortcuts import get_object_or_404
from django.http import JsonResponse
from django.contrib.auth import login as auth_login, logout as auth_logout

from .serializers import UserSerializer, SignupSerializer, ProfileSerializer, FinancialDataSerializer
from .models import Profile, FinancialData
from notifications.models import Notification
import requests
import uuid

User = get_user_model()

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_user_data(request):
    user = request.user
    serializer = UserSerializer(user)
    return Response(serializer.data)

@api_view(['PUT', 'POST'])
@permission_classes([IsAuthenticated])
def update_avatar(request):
    user = request.user
    if 'avatar' in request.FILES:
        user.avatar = request.FILES['avatar']
        user.save()
        avatar_url = user.avatar.url if user.avatar else ""
        return Response({"message": "Avatar updated successfully!", "avatar": avatar_url}, status=status.HTTP_200_OK)
    return Response({"error": "No file uploaded"}, status=status.HTTP_400_BAD_REQUEST)

class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = SignupSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            auth_login(request, user) # Establish Django Session
            refresh = RefreshToken.for_user(user)
            return Response({
                "message": "User created successfully",
                "user": UserSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email_or_username = request.data.get("username") or request.data.get("email")
        password = request.data.get("password")

        if not email_or_username or not password:
            return Response({"error": "Username/email and password are required."}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(username=email_or_username, password=password)
        if not user and "@" in email_or_username:
            try:
                user_obj = User.objects.get(email=email_or_username)
                user = authenticate(username=user_obj.username, password=password)
            except User.DoesNotExist:
                user = None

        if user:
            auth_login(request, user)  # Establish Django Session
            refresh = RefreshToken.for_user(user)
            return Response({
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "message": "Login successful",
                "user": UserSerializer(user).data
            }, status=status.HTTP_200_OK)

        return Response({"error": "Invalid Credentials"}, status=status.HTTP_401_UNAUTHORIZED)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                token = RefreshToken(refresh_token)
                token.blacklist()
        except Exception:
            pass # Ignore token blacklist errors during logout
            
        auth_logout(request) # Clear Django session
        return Response({"message": "Successfully logged out."}, status=status.HTTP_200_OK)

class GoogleLoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        token = request.data.get("token")
        if not token:
            return Response({"error": "Token is required."}, status=status.HTTP_400_BAD_REQUEST)

        # Verify Google token
        try:
            google_response = requests.get(f"https://oauth2.googleapis.com/tokeninfo?id_token={token}")
            if google_response.status_code != 200:
                return Response({"error": "Invalid Google token."}, status=status.HTTP_400_BAD_REQUEST)
                
            user_info = google_response.json()
            email = user_info.get("email")
            first_name = user_info.get("given_name", "")
            last_name = user_info.get("family_name", "")
            
            if not email:
                return Response({"error": "Google token does not contain email."}, status=status.HTTP_400_BAD_REQUEST)
                
            # Get or create user
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'username': email.split('@')[0] + "_" + str(uuid.uuid4())[:8],
                    'first_name': first_name,
                    'last_name': last_name
                }
            )
            
            if created:
                user.set_unusable_password()
                user.save()
                
            auth_login(request, user) # Establish Django Session
            
            # Generate JWT
            refresh = RefreshToken.for_user(user)
            return Response({
                "refresh": str(refresh),
                "access": str(refresh.access_token),
                "message": "Google Login successful",
                "user": UserSerializer(user).data
            }, status=status.HTTP_200_OK)
            
        except Exception as e:
            return Response({"error": f"Google authentication failed: {str(e)}"}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ProfileSetupView(generics.RetrieveUpdateAPIView):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        profile, created = Profile.objects.get_or_create(user=self.request.user)
        return profile

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)

class FinancialInputView(generics.RetrieveUpdateAPIView):
    queryset = FinancialData.objects.all()
    serializer_class = FinancialDataSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        financial_data, created = FinancialData.objects.get_or_create(user=self.request.user)
        return financial_data

    def perform_update(self, serializer):
        serializer.save(user=self.request.user)

class FinancialDataView(generics.RetrieveAPIView):
    serializer_class = FinancialDataSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        user_id = self.kwargs.get('user_id')
        if str(self.request.user.id) != str(user_id) and not self.request.user.is_staff:
            return get_object_or_404(FinancialData, user=self.request.user)
        return get_object_or_404(FinancialData, user_id=user_id)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_profile(request):
    user = request.user
    avatar_url = user.avatar.url if hasattr(user, 'avatar') and user.avatar else "https://via.placeholder.com/100"
    profile_data = {
        "id": str(user.id),
        "username": user.username,
        "email": user.email,
        "phone_no": user.phone_no,
        "is_premium": user.is_premium,
        "role": user.role,
        "avatar": avatar_url,
    }
    return Response(profile_data, status=status.HTTP_200_OK)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def user_notifications(request):
    user = request.user
    subscription_type = "premium" if user.is_premium else "free"

    notifications = Notification.objects.filter(
        recipients__in=["all", subscription_type, str(user.id)]
    ).order_by('-timestamp')

    notifications_list = [
        {
            "id": notification.id,
            "title": notification.title,
            "message": notification.message,
            "status": notification.status,
            "timestamp": notification.timestamp.strftime("%Y-%m-%d %H:%M:%S")
        } for notification in notifications
    ]

    return Response(notifications_list, status=status.HTTP_200_OK)
