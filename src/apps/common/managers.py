from django.db import models
from .middleware import get_current_institute


class InstituteScopedQuerySet(models.QuerySet):
    def for_current_institute(self):
        inst = get_current_institute()
        if inst is None:
            return self.none()
        return self.filter(institute=inst)


class InstituteScopedManager(models.Manager):
    def get_queryset(self):
        qs = super().get_queryset()
        inst = get_current_institute()
        if inst is None:
            return qs.none()
        return qs.filter(institute=inst)
