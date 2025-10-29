# apps/students/migrations/0003_move_term_fk_and_state_delete.py
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("students", "0002_alter_academicterm_unique_together_and_more"),
        ("terms", "0001_initial"),
    ]

    operations = [
        # Keep the actual FK aligned to the same physical table (db_table unchanged).
        migrations.AlterField(
            model_name="studentstatus",
            name="term",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                to="terms.academicterm",
            ),
        ),
        # Remove the model from 'students' APP STATE ONLY; do NOT drop the table.
        migrations.SeparateDatabaseAndState(
            database_operations=[],
            state_operations=[
                migrations.DeleteModel(name="AcademicTerm"),
            ],
        ),
    ]
