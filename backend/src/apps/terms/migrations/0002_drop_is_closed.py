# apps/terms/migrations/0002_drop_is_closed.py
from django.db import migrations


class Migration(migrations.Migration):
    dependencies = [("terms", "0001_initial")]

    operations = [
        migrations.RunSQL(
            sql="ALTER TABLE students_academicterm DROP COLUMN IF EXISTS is_closed;",
            reverse_sql="ALTER TABLE students_academicterm ADD COLUMN is_closed boolean DEFAULT false;",
        ),
    ]
