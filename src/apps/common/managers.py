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
