from django.contrib import admin
from .models import Student, AcademicTerm, StudentCustodian, StudentStatus


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


@admin.register(AcademicTerm)
class AcademicTermAdmin(admin.ModelAdmin):
    list_display = ("name", "start_date", "end_date", "institute")


@admin.register(StudentCustodian)
class StudentCustodianAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "student",
        "last_name",
        "first_name",
        "relation",
        "phone_number_1",
    )
    list_filter = ("relation", "gender")
    search_fields = (
        "first_name",
        "last_name",
        "student__first_name",
        "student__last_name",
    )


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
