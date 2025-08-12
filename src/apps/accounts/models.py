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

    class Meta:
        verbose_name = "User"
        verbose_name_plural = "Users"
