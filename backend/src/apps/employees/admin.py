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
    list_display = ("id", "name", "scope")
    search_fields = ("name",)
    list_filter = ("institute",)

    def get_queryset(self, request):
        # Admin should see everything
        return EmployeeFunction.all_objects.all()

    def scope(self, obj):
        return (
            "GLOBAL" if obj.institute_id is None else f"Institute #{obj.institute_id}"
        )


@admin.register(EmployeeCareer)
class EmployeeCareerAdmin(admin.ModelAdmin):
    list_display = (
        "employee",
        "function",
        "start_date",
        "total_salary",
        "gross_salary",
        "take_home_salary",
        "paye",
        "employee_nssf",
        "institute_nssf",
    )
    list_filter = ("function", "start_date")


@admin.register(EmployeeDependent)
class EmployeeDependentAdmin(admin.ModelAdmin):
    list_display = ("employee", "name", "relation", "phone_number_1")
    search_fields = ("name", "employee__first_name", "employee__last_name")
