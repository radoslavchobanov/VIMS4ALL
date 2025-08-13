from django.contrib import admin
from .models import Student, Term, StudentCustodian, StudentStatus


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


@admin.register(Term)
class TermAdmin(admin.ModelAdmin):
    list_display = ("name", "start_date", "end_date", "institute")


@admin.register(StudentCustodian)
class StudentCustodianAdmin(admin.ModelAdmin):
    list_display = ("full_name", "relation", "student", "institute")


@admin.register(StudentStatus)
class StudentStatusAdmin(admin.ModelAdmin):
    list_display = (
        "student",
        "status",
        "term",
        "is_active",
        "effective_at",
        "institute",
    )
    list_filter = ("status", "is_active")
