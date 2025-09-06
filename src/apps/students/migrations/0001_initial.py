# Generated for VIMS MVP – single initial migration
from django.db import migrations, models
import django.db.models.deletion
from django.utils import timezone
from django.db.models import Q


class Migration(migrations.Migration):

    initial = True

    # institutes is required for FK; auth is not strictly required here
    dependencies = [
        ("institutes", "0001_initial"),
    ]

    operations = [
        # --- Student ----------------------------------------------------------
        migrations.CreateModel(
            name="Student",
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
                # mandatory identity
                ("first_name", models.CharField(max_length=120)),
                ("last_name", models.CharField(max_length=120)),
                ("date_of_birth", models.DateField()),
                # identifiers/media
                ("spin", models.CharField(max_length=32, unique=True)),
                (
                    "photo",
                    models.ImageField(upload_to="students/", null=True, blank=True),
                ),
                # optional profile
                (
                    "gender",
                    models.CharField(
                        max_length=12,
                        choices=[
                            ("male", "Male"),
                            ("female", "Female"),
                            ("other", "Other / Unspecified"),
                        ],
                        null=True,
                        blank=True,
                    ),
                ),
                (
                    "marital_status",
                    models.CharField(
                        max_length=12,
                        choices=[
                            ("single", "Not married"),
                            ("married", "Married"),
                            ("separated", "Separated"),
                            ("divorced", "Divorced"),
                            ("widowed", "Widowed"),
                        ],
                        null=True,
                        blank=True,
                    ),
                ),
                (
                    "phone_number",
                    models.CharField(max_length=40, null=True, blank=True),
                ),
                ("email", models.EmailField(max_length=254, null=True, blank=True)),
                ("nationality", models.CharField(max_length=60, null=True, blank=True)),
                ("national_id", models.CharField(max_length=64, null=True, blank=True)),
                (
                    "previous_institute",
                    models.CharField(max_length=160, null=True, blank=True),
                ),
                (
                    "grade_acquired",
                    models.CharField(max_length=60, null=True, blank=True),
                ),
                ("district", models.CharField(max_length=120, null=True, blank=True)),
                ("county", models.CharField(max_length=120, null=True, blank=True)),
                (
                    "sub_county_division",
                    models.CharField(max_length=120, null=True, blank=True),
                ),
                ("parish", models.CharField(max_length=120, null=True, blank=True)),
                (
                    "cell_village",
                    models.CharField(max_length=120, null=True, blank=True),
                ),
                ("entry_date", models.DateField(null=True, blank=True)),
                ("exit_date", models.DateField(null=True, blank=True)),
                ("comments", models.TextField(null=True, blank=True)),
                ("created_at", models.DateTimeField(auto_now_add=True)),
                (
                    "institute",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="%(class)ss",
                        to="institutes.institute",
                    ),
                ),
            ],
            options={
                "indexes": [
                    models.Index(
                        fields=["institute", "last_name", "first_name"],
                        name="stu_inst_last_first_idx",
                    ),
                    models.Index(fields=["spin"], name="stu_spin_idx"),
                ],
                "constraints": [
                    models.UniqueConstraint(
                        fields=(
                            "institute",
                            "first_name",
                            "last_name",
                            "date_of_birth",
                        ),
                        name="uq_student_person_like",
                    )
                ],
            },
        ),
        # --- Term -------------------------------------------------------------
        migrations.CreateModel(
            name="Term",
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
                ("name", models.CharField(max_length=120)),
                ("start_date", models.DateField()),
                ("end_date", models.DateField()),
                (
                    "institute",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="%(class)ss",
                        to="institutes.institute",
                    ),
                ),
            ],
            options={
                "ordering": ["-start_date"],
                "unique_together": {("institute", "name")},
            },
        ),
        # --- StudentCustodian (new expanded schema) --------------------------
        migrations.CreateModel(
            name="StudentCustodian",
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
                ("first_name", models.CharField(max_length=80)),
                ("last_name", models.CharField(max_length=80)),
                (
                    "gender",
                    models.CharField(
                        max_length=12,
                        choices=[
                            ("male", "Male"),
                            ("female", "Female"),
                            ("other", "Other/Unspecified"),
                        ],
                        null=True,
                        blank=True,
                    ),
                ),
                (
                    "relation",
                    models.CharField(
                        max_length=20,
                        choices=[
                            ("parent", "Parent"),
                            ("guardian", "Guardian"),
                            ("sponsor", "Sponsor"),
                        ],
                    ),
                ),
                (
                    "phone_number_1",
                    models.CharField(max_length=40, null=True, blank=True),
                ),
                (
                    "phone_number_2",
                    models.CharField(max_length=40, null=True, blank=True),
                ),
                (
                    "place_of_work",
                    models.CharField(max_length=160, null=True, blank=True),
                ),
                ("nationality", models.CharField(max_length=60, null=True, blank=True)),
                ("country", models.CharField(max_length=120, null=True, blank=True)),
                (
                    "sub_country",
                    models.CharField(max_length=120, null=True, blank=True),
                ),
                ("parish", models.CharField(max_length=120, null=True, blank=True)),
                ("cell", models.CharField(max_length=120, null=True, blank=True)),
                ("comments", models.TextField(null=True, blank=True)),
                (
                    "institute",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="%(class)ss",
                        to="institutes.institute",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="custodians",
                        to="students.student",
                    ),
                ),
            ],
            options={
                "ordering": ["last_name", "first_name", "id"],
                "indexes": [
                    models.Index(
                        fields=["student", "relation"],
                        name="cust_student_relation_idx",
                    ),
                    models.Index(
                        fields=["last_name", "first_name"],
                        name="cust_last_first_idx",
                    ),
                ],
            },
        ),
        # --- StudentStatus ----------------------------------------------------
        migrations.CreateModel(
            name="StudentStatus",
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
                    "status",
                    models.CharField(
                        max_length=20,
                        choices=[
                            ("enquire", "Enquire"),
                            ("accepted", "Accepted"),
                            ("no_show", "No show"),
                            ("active", "Active"),
                            ("retake", "Retake"),
                            ("failed", "Failed"),
                            ("graduate", "Graduate"),
                            ("drop_out", "Drop out"),
                            ("expelled", "Expelled"),
                            ("not_accepted", "Not accepted"),
                        ],
                    ),
                ),
                ("is_active", models.BooleanField(default=True)),
                ("note", models.TextField(blank=True)),
                ("effective_at", models.DateTimeField(default=timezone.now)),
                (
                    "institute",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="%(class)ss",
                        to="institutes.institute",
                    ),
                ),
                (
                    "student",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        related_name="statuses",
                        to="students.student",
                    ),
                ),
                (
                    "term",
                    models.ForeignKey(
                        blank=True,
                        null=True,
                        on_delete=django.db.models.deletion.SET_NULL,
                        to="students.term",
                    ),
                ),
            ],
            options={
                "ordering": ["-effective_at", "-id"],
                "indexes": [
                    models.Index(
                        fields=["student", "-effective_at"],
                        name="status_student_eff_idx",
                    ),
                ],
                "constraints": [
                    # one active status per student
                    models.UniqueConstraint(
                        fields=("institute", "student"),
                        condition=Q(is_active=True),
                        name="uq_one_active_status_per_student",
                    ),
                    # term is required for ACTIVE / RETAKE
                    models.CheckConstraint(
                        name="ck_term_required_for_active_or_retake",
                        check=(
                            Q(status__in=["active", "retake"], term__isnull=False)
                            | ~Q(status__in=["active", "retake"])
                        ),
                    ),
                ],
            },
        ),
    ]
