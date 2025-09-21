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
