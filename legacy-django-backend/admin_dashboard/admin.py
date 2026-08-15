from django.contrib import admin
from .models import AdminSettings

@admin.register(AdminSettings)
class AdminSettingsAdmin(admin.ModelAdmin):
    list_display = ['site_name', 'admin_name', 'admin_email', 'updated_at']
