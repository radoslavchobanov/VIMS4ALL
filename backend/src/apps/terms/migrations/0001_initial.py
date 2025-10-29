# apps/terms/migrations/0001_initial.py
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    initial = True

    dependencies = [
        ("institutes", "0001_initial"),  # adjust if needed
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[],  # <— DO NOT create/drop anything in DB
            state_operations=[
                migrations.CreateModel(
                    name="AcademicTerm",
                    fields=[
                        ("id", models.BigAutoField(primary_key=True, serialize=False)),
                        ("name", models.CharField(max_length=120)),
                        ("start_date", models.DateField()),
                        ("end_date", models.DateField()),
                        (
                            "institute",
                            models.ForeignKey(
                                on_delete=django.db.models.deletion.CASCADE,
                                related_name="terms",
                                to="institutes.institute",
                            ),
                        ),
                    ],
                    options={
                        "db_table": "students_academicterm",  # <— reuse the existing table
                        "ordering": ["-start_date"],
                        "unique_together": {("institute", "name")},
                    },
                ),
            ],
        ),
    ]
