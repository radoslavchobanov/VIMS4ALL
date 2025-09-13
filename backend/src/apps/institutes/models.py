from django.db import models
from apps.common.models import TimeStampedModel


class Institute(TimeStampedModel):
    name = models.CharField(max_length=255, unique=True)
    business_year_start = models.DateField(null=True, blank=True)
    business_year_end = models.DateField(null=True, blank=True)
    logo_key = models.CharField(max_length=512, null=True, blank=True)  # S3 key

    def __str__(self) -> str:
        return self.name
