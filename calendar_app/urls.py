from django.urls import path
from .views import calendar_events_api_view

urlpatterns = [
    path('events/', calendar_events_api_view, name='calendar_events'),
]
