from django.contrib import admin
from .models import Employee, EmployeeFunction, EmployeeCareer, EmployeeDependent


@admin.register(Employee)
class EmployeeAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "epin",
        "first_name",
        "last_name",
        "institute",
        "entry_date",
        "exit_date",
        "created_at",
    )
    search_fields = ("epin", "first_name", "last_name", "national_id")
    list_filter = ("institute",)


@admin.register(EmployeeFunction)
class EmployeeFunctionAdmin(admin.ModelAdmin):
    list_display = ("id", "name", "institute")
    search_fields = ("name",)
    list_filter = ("institute",)


@admin.register(EmployeeCareer)
class EmployeeCareerAdmin(admin.ModelAdmin):
    list_display = (
        "employee",
        "function",
        "start_date",
        "end_date",
        "net_salary_due",
        "institute",
    )
    list_filter = ("function",)


@admin.register(EmployeeDependent)
class EmployeeDependentAdmin(admin.ModelAdmin):
    list_display = ("employee", "name", "relation", "phone_number_1")
    search_fields = ("name", "employee__first_name", "employee__last_name")
