from django.db import models
from django.utils import timezone
from .managers import InstituteScopedManager, OptionallyScopedManager


class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        abstract = True


class InstituteScopedModel(models.Model):
    institute = models.ForeignKey(
        "institutes.Institute", on_delete=models.CASCADE, related_name="%(class)ss"
    )
    objects = InstituteScopedManager()  # scoped by middleware context
    all_objects = models.Manager()  # unscoped escape hatch

    class Meta:
        abstract = True


class OptionallyScopedModel(models.Model):
    institute = models.ForeignKey(
        "institutes.Institute",
        on_delete=models.CASCADE,
        related_name="%(class)ss",
        null=True,
        blank=True,
    )
    objects = OptionallyScopedManager()  # union of global + current institute
    all_objects = models.Manager()  # unscoped escape hatch

    class Meta:
        abstract = True


class PinKind(models.TextChoices):
    EMPLOYEE = "E", "Employee"
    STUDENT = "S", "Student"


class PinCounter(models.Model):
    """
    Keeps monotonic counters for PINs to avoid races.
    Unique key per institute + kind + year [ + term ].
    """

    institute = models.ForeignKey("institutes.Institute", on_delete=models.CASCADE)
    kind = models.CharField(max_length=1, choices=PinKind.choices)  # "E" or "S"
    year2 = models.PositiveSmallIntegerField()  # 0..99 (yy)
    term_no = models.PositiveSmallIntegerField(
        null=True, blank=True
    )  # only for students
    last_no = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["institute", "kind", "year2", "term_no"], name="uniq_pin_scope"
            )
        ]

    def __str__(self):
        return f"{self.institute_id}:{self.kind}:y{self.year2}:t{self.term_no or 0} -> {self.last_no}"
