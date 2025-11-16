# Generated migration for TermTransition model

from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("terms", "0003_alter_academicterm_id_and_more"),
        ("institutes", "0001_initial"),
    ]

    operations = [
        migrations.CreateModel(
            name="TermTransition",
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
                    "transition_executed_at",
                    models.DateTimeField(
                        null=True,
                        blank=True,
                        help_text="When the 'move students' action was performed",
                    ),
                ),
                (
                    "executed_by",
                    models.CharField(
                        max_length=150,
                        null=True,
                        blank=True,
                        help_text="Username who executed the transition",
                    ),
                ),
                (
                    "reminder_sent_at",
                    models.DateTimeField(
                        null=True,
                        blank=True,
                        help_text="When reminder email was sent",
                    ),
                ),
                (
                    "welcome_sent_at",
                    models.DateTimeField(
                        null=True,
                        blank=True,
                        help_text="When welcome email for new term was sent",
                    ),
                ),
                (
                    "students_moved_count",
                    models.IntegerField(
                        default=0,
                        help_text="Number of students moved during transition",
                    ),
                ),
                (
                    "created_at",
                    models.DateTimeField(auto_now_add=True),
                ),
                (
                    "updated_at",
                    models.DateTimeField(auto_now=True),
                ),
                (
                    "term",
                    models.OneToOneField(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="terms.academicterm",
                        related_name="transition",
                        help_text="The term this transition belongs to",
                    ),
                ),
                (
                    "institute",
                    models.ForeignKey(
                        on_delete=django.db.models.deletion.CASCADE,
                        to="institutes.institute",
                        related_name="term_transitions",
                    ),
                ),
            ],
            options={
                "db_table": "terms_transition",
                "ordering": ["-created_at"],
                "indexes": [
                    models.Index(
                        fields=["institute", "transition_executed_at"],
                        name="term_trans_inst_exec_idx",
                    ),
                ],
            },
        ),
    ]
