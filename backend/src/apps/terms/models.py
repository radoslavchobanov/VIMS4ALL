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
