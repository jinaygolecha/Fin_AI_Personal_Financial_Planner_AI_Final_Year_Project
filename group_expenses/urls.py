from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views

app_name = 'group_expenses'

router = DefaultRouter()
router.register(r'groups', views.GroupViewSet, basename='group')
router.register(r'expenses', views.GroupExpenseViewSet, basename='groupexpense')
router.register(r'members', views.GroupMemberViewSet, basename='groupmember')
router.register(r'settlements', views.SettlementViewSet, basename='settlement')

urlpatterns = [
    path('api/', include(router.urls)),
    path('group-expenses/', views.group_expenses_view, name='group_expenses'),
    path('dashboard/<int:group_id>/', views.group_dashboard, name='group_dashboard'),
    path('add-expense/<int:group_id>/', views.add_expense, name='add_expense'),
]
