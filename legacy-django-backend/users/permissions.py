from rest_framework.permissions import BasePermission

class IsAdminUser(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role == 'admin')

class IsFamilyAdmin(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated and request.user.role in ['admin', 'family_admin'])

class IsPremiumUser(BasePermission):
    def has_permission(self, request, view):
        # Allow if role is premium, family_admin, or admin, OR if legacy is_premium is True
        return bool(request.user and request.user.is_authenticated and (request.user.role in ['admin', 'family_admin', 'premium_user'] or request.user.is_premium))

class IsStandardUser(BasePermission):
    def has_permission(self, request, view):
        return bool(request.user and request.user.is_authenticated)
