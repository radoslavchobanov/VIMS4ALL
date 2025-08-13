from django.db import models
from apps.common.models import InstituteScopedModel


class Student(InstituteScopedModel):
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    date_of_birth = models.DateField()
    spin = models.CharField(max_length=32, unique=True)  # generated id
    photo = models.ImageField(upload_to="students/", blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["institute", "first_name", "last_name", "date_of_birth"],
                name="uq_student_person_like",
            )
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.spin})"
