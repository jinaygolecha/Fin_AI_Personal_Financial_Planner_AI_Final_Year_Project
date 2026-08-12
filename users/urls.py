from django.urls import path
from rest_framework_simplejwt.views import TokenRefreshView
from .views import (
    SignupView, LoginView, LogoutView, GoogleLoginView, get_user_data, update_avatar,
    ProfileSetupView, FinancialInputView, FinancialDataView,
    user_profile, user_notifications
)

from .views_onboarding import onboarding_api_view

urlpatterns = [
    path('signup/', SignupView.as_view(), name='signup'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('google/', GoogleLoginView.as_view(), name='google_login'),
    path('onboarding/', onboarding_api_view, name='onboarding_api'),
    path('profile/', ProfileSetupView.as_view(), name='profile'),
    path('financial-input/', FinancialInputView.as_view(), name='financial_input'),
    path('user-data/', get_user_data, name='get_user_data'),
    path('update-avatar/', update_avatar, name='update_avatar'),
    path('token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('financial-data/<uuid:user_id>/', FinancialDataView.as_view(), name='financial-data'),
    path('user-profile/', user_profile, name='user-profile'),
    path('user-notifications/', user_notifications, name='user-notifications'),
]
