from django.contrib.auth.models import AbstractUser
from django.db import models
from apps.institutes.models import Institute


class User(AbstractUser):
    institute = models.ForeignKey(
        Institute,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="users",
    )

    must_change_password = models.BooleanField(default=False)

    @property
    def is_institute_admin(self) -> bool:
        return self.groups.filter(name="institute_admin").exists()
