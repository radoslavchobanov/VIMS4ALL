from django.contrib import admin
from .models import Student


@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "spin",
        "first_name",
        "last_name",
        "date_of_birth",
        "institute",
        "created_at",
    )
    list_filter = ("institute",)
    search_fields = ("spin", "first_name", "last_name")
