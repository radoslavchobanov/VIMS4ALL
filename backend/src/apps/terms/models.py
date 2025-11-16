from django.db import models
from django.core.exceptions import ValidationError


class AcademicTerm(models.Model):
    """
    Note: We keep db_table to the old table name to avoid data migration.
    """

    objects = models.Manager()
    all_objects = models.Manager()

    institute = models.ForeignKey(
        "institutes.Institute", on_delete=models.CASCADE, related_name="terms"
    )
    name = models.CharField(max_length=120)  # auto-generated, immutable
    start_date = models.DateField()
    end_date = models.DateField()

    class Meta:
        db_table = "students_academicterm"  # reuse existing table
        unique_together = ("institute", "name")
        ordering = ["-start_date"]
        indexes = [
            models.Index(
                fields=["institute", "start_date", "end_date"],
                name="term_inst_dates_idx",
            ),
        ]

    def clean(self):
        if self.end_date < self.start_date:
            raise ValidationError("end_date must be on/after start_date.")

        # Prevent overlapping terms for same institute (recommended invariant)
        qs = (
            AcademicTerm.objects.filter(institute=self.institute)
            .exclude(pk=self.pk)
            .filter(start_date__lte=self.end_date, end_date__gte=self.start_date)
        )
        if qs.exists():
            raise ValidationError("Term dates overlap with an existing term.")


class TermTransition(models.Model):
    """
    Tracks the transition state for each academic term.
    Ensures "move students" action happens only once per term.
    Tracks email notification delivery.
    """

    institute = models.ForeignKey(
        "institutes.Institute",
        on_delete=models.CASCADE,
        related_name="term_transitions",
    )

    term = models.OneToOneField(
        AcademicTerm,
        on_delete=models.CASCADE,
        related_name="transition",
        help_text="The term this transition belongs to",
    )

    transition_executed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When the 'move students' action was performed",
    )

    executed_by = models.CharField(
        max_length=150,
        null=True,
        blank=True,
        help_text="Username who executed the transition",
    )

    reminder_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When reminder email was sent",
    )

    welcome_sent_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When welcome email for new term was sent",
    )

    students_moved_count = models.IntegerField(
        default=0,
        help_text="Number of students moved during transition",
    )

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "terms_transition"
        ordering = ["-created_at"]
        indexes = [
            models.Index(
                fields=["institute", "transition_executed_at"],
                name="term_trans_inst_exec_idx",
            ),
        ]

    def __str__(self):
        status = "Executed" if self.transition_executed_at else "Pending"
        return f"{self.term.name} - {status}"

    def can_execute_transition(self):
        """Check if transition can be executed (within 1 week after term end, not yet executed)"""
        from django.utils import timezone
        from datetime import timedelta

        if self.transition_executed_at:
            return False

        today = timezone.now().date()
        one_week_after_end = self.term.end_date + timedelta(days=7)

        return self.term.end_date <= today <= one_week_after_end
