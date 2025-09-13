from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from .models import User


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    fieldsets = DjangoUserAdmin.fieldsets + (("Institute", {"fields": ("institute",)}),)
    list_display = ("username", "email", "is_staff", "is_superuser", "institute")
    list_filter = ("is_staff", "is_superuser", "is_active", "groups", "institute")
