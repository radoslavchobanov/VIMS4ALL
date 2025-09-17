from django.db import migrations, models
import django.core.validators
from django.utils import timezone


class Migration(migrations.Migration):

    initial = True

    dependencies = []

    operations = [
        migrations.CreateModel(
            name="Institute",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(default=timezone.now, editable=False),
                ),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("name", models.CharField(max_length=255, unique=True)),
                ("short_name", models.CharField(blank=True, max_length=64, null=True)),
                ("business_year_start", models.DateField(blank=True, null=True)),
                ("business_year_end", models.DateField(blank=True, null=True)),
                (
                    "post_office_box",
                    models.CharField(blank=True, max_length=255, null=True),
                ),
                (
                    "phone",
                    models.CharField(
                        blank=True,
                        null=True,
                        max_length=255,
                        help_text="One or more phone numbers, comma-separated (e.g. 075...,039...).",
                        validators=[
                            django.core.validators.RegexValidator(
                                regex="^[0-9\\s+/\\-,]*$",
                                message="Phone may contain digits, spaces, +, /, -, and commas.",
                            )
                        ],
                    ),
                ),
                ("email", models.EmailField(blank=True, max_length=254, null=True)),
                ("district", models.CharField(blank=True, max_length=128, null=True)),
                ("county", models.CharField(blank=True, max_length=128, null=True)),
                ("sub_county", models.CharField(blank=True, max_length=128, null=True)),
                ("parish", models.CharField(blank=True, max_length=128, null=True)),
                (
                    "cell_village",
                    models.CharField(blank=True, max_length=128, null=True),
                ),
                (
                    "registration_no",
                    models.CharField(blank=True, max_length=128, null=True),
                ),
                (
                    "inst_nssf_no",
                    models.CharField(
                        blank=True,
                        max_length=128,
                        null=True,
                        verbose_name="Inst.NSSF Nr.",
                    ),
                ),
                (
                    "inst_paye_no",
                    models.CharField(
                        blank=True,
                        max_length=128,
                        null=True,
                        verbose_name="Inst.PAYE Nr.",
                    ),
                ),
                (
                    "taxflag",
                    models.PositiveSmallIntegerField(
                        default=0,
                        help_text="0 or 1 (kept as small int to mirror legacy).",
                        validators=[
                            django.core.validators.MinValueValidator(0),
                            django.core.validators.MaxValueValidator(1),
                        ],
                    ),
                ),
                ("directions_and_comments", models.TextField(blank=True, null=True)),
                ("logo_key", models.CharField(blank=True, max_length=512, null=True)),
            ],
            options={"indexes": []},
        ),
        migrations.AddIndex(
            model_name="institute",
            index=models.Index(fields=["name"], name="institutes_name_idx"),
        ),
        migrations.AddIndex(
            model_name="institute",
            index=models.Index(fields=["short_name"], name="institutes_short_name_idx"),
        ),
        migrations.AddIndex(
            model_name="institute",
            index=models.Index(
                fields=["district", "county"], name="institutes_district_county_idx"
            ),
        ),
    ]
