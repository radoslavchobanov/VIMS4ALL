# employees/migrations/0007_effective_dated_career.py
from django.db import migrations, models


def copy_gross(apps, schema_editor):
    Career = apps.get_model("employees", "EmployeeCareer")
    for row in Career.objects.all().only("id", "gross_salary_due"):
        if row.gross_salary_due is not None:
            Career.objects.filter(pk=row.pk).update(gross_salary=row.gross_salary_due)


class Migration(migrations.Migration):
    dependencies = [
        (
            "employees",
            "0006_employee_bank_account_number_employee_bank_name",
        ),  # keep your actual dependency
    ]
    operations = [
        # 1) New salary fields
        migrations.AddField(
            model_name="employeecareer",
            name="total_salary",
            field=models.DecimalField(
                max_digits=12, decimal_places=2, null=True, blank=True
            ),
        ),
        migrations.AddField(
            model_name="employeecareer",
            name="gross_salary",
            field=models.DecimalField(
                max_digits=12, decimal_places=2, null=True, blank=True
            ),
        ),
        migrations.AddField(
            model_name="employeecareer",
            name="take_home_salary",
            field=models.DecimalField(
                max_digits=12, decimal_places=2, null=True, blank=True
            ),
        ),
        migrations.AddField(
            model_name="employeecareer",
            name="paye",
            field=models.DecimalField(
                max_digits=12, decimal_places=2, null=True, blank=True
            ),
        ),
        migrations.AddField(
            model_name="employeecareer",
            name="employee_nssf",
            field=models.DecimalField(
                max_digits=12, decimal_places=2, null=True, blank=True
            ),
        ),
        migrations.AddField(
            model_name="employeecareer",
            name="institute_nssf",
            field=models.DecimalField(
                max_digits=12, decimal_places=2, null=True, blank=True
            ),
        ),
        # 2) Backfill
        migrations.RunPython(copy_gross, migrations.RunPython.noop),
        # 3) DROP the old constraint (references end_date) — MUST happen before removing the field
        migrations.RemoveConstraint(
            model_name="employeecareer",
            name="uq_one_open_career_row_per_employee",
        ),
        # 4) DROP indexes that reference end_date — also before removing the field
        migrations.RemoveIndex(
            model_name="employeecareer",
            name="emp_car_emp_end_idx",
        ),
        migrations.RemoveIndex(
            model_name="employeecareer",
            name="emp_car_fun_end_idx",
        ),
        # 5) Now it is safe to remove the field
        migrations.RemoveField(
            model_name="employeecareer",
            name="end_date",
        ),
        # 6) (Optional) remove legacy gross field if you’re done with it
        # migrations.RemoveField(model_name="employeecareer", name="gross_salary_due"),
        # 7) NEW unique constraint (no end_date)
        migrations.AddConstraint(
            model_name="employeecareer",
            constraint=models.UniqueConstraint(
                fields=["institute", "employee", "start_date"],
                name="uq_emp_career_unique_start_per_employee",
            ),
        ),
        # 8) NEW indexes
        migrations.AddIndex(
            model_name="employeecareer",
            index=models.Index(
                fields=["employee", "start_date"], name="emp_car_emp_start_idx"
            ),
        ),
        migrations.AddIndex(
            model_name="employeecareer",
            index=models.Index(
                fields=["function", "start_date"], name="emp_car_fun_start_idx"
            ),
        ),
    ]
