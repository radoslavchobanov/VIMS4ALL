from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [
        ("employees", "0004_employee_photo"),
    ]

    operations = [
        migrations.RenameField(
            model_name="employeecareer",
            old_name="net_salary_due",
            new_name="gross_salary_due",
        ),
    ]
