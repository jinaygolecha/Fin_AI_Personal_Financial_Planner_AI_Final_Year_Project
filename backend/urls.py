"""
URL configuration for backend project.
Managed & Configured for Jinay Golecha (jinay_golecha)
"""
from django.contrib import admin
from django.urls import path, include
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.conf import settings
from django.conf.urls.static import static

from frontend.views import homepage_view

urlpatterns = [
    # Root & Frontend Routes
    path('', include('frontend.urls')),

    # Django Admin Panel
    path('admin/', admin.site.urls),

    # JWT Authentication Routes
    path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),

    # REST APIs for Applications
    path('api/users/', include('users.urls')),
    path('api/accounts/', include('accounts.urls')),
    path('api/group-expenses/', include('group_expenses.urls')),
    path('api/transactions/', include('transactions.urls')),
    path('api/payments/', include('payments.urls')),
    path('api/insights/', include('insights.urls')),
    path('api/investments/', include('investments.urls')),
    path('api/loans/', include('loans.urls')),
    path('api/calendar/', include('calendar_app.urls')),
    path('api/ai/', include('ai_engine.urls')),
    path('api/planning/', include('planning.urls')),

    # Admin Management Dashboard
    path('admin-dashboard/', include('admin_dashboard.urls')),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)
