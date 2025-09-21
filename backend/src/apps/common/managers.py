from django.db import models
from .middleware import get_current_institute_id


class InstituteScopedQuerySet(models.QuerySet):
    def for_current_institute(self):
        iid = get_current_institute_id()
        return self.filter(institute_id=iid) if iid is not None else self.none()


class InstituteScopedManager(models.Manager):
    def get_queryset(self):
        qs = super().get_queryset()
        iid = get_current_institute_id()
        return qs.filter(institute_id=iid) if iid is not None else qs.none()

    # convenience for admin/shell
    def all_institutes(self):
        return super().get_queryset()


class OptionallyScopedQuerySet(models.QuerySet):
    def for_current_institute_or_global(self):
        iid = get_current_institute_id()
        if iid is None:
            # No institute in context -> only global is safe
            return self.filter(institute__isnull=True)
        return self.filter(
            models.Q(institute_id=iid) | models.Q(institute__isnull=True)
        )


class OptionallyScopedManager(models.Manager):
    def get_queryset(self):
        qs = super().get_queryset()
        iid = get_current_institute_id()
        if iid is None:
            return qs.filter(institute__isnull=True)
        return qs.filter(models.Q(institute_id=iid) | models.Q(institute__isnull=True))

    # convenience for admin/shell (bypasses scoping)
    def all_institutes(self):
        return super().get_queryset()
