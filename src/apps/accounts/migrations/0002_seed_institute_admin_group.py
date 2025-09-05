# apps/accounts/migrations/0002_seed_institute_admin_group.py
from django.db import migrations


def seed_group(apps, schema_editor):
    Group = apps.get_model("auth", "Group")
    Group.objects.get_or_create(name="institute_admin")


class Migration(migrations.Migration):
    dependencies = [("accounts", "0001_initial"), ("auth", "__first__")]
    operations = [
        migrations.RunPython(seed_group, reverse_code=migrations.RunPython.noop)
    ]
