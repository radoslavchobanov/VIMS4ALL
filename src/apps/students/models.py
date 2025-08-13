from django.db import models
from apps.common.models import InstituteScopedModel
from django.utils import timezone


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


class Term(InstituteScopedModel):
    name = models.CharField(max_length=120)
    start_date = models.DateField()
    end_date = models.DateField()

    class Meta:
        unique_together = ("institute", "name")
        ordering = ["-start_date"]

    def __str__(self):
        return f"{self.name}"


class StudentCustodian(InstituteScopedModel):
    student = models.ForeignKey(
        "students.Student", on_delete=models.CASCADE, related_name="custodians"
    )
    full_name = models.CharField(max_length=160)
    relation = models.CharField(max_length=60)  # e.g. Mother, Father, Guardian
    phone = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)

    class Meta:
        indexes = [models.Index(fields=["student", "relation"])]

    def __str__(self):
        return f"{self.full_name} ({self.relation})"


class StudentStatus(InstituteScopedModel):
    class Status(models.TextChoices):
        CANDIDATE = "candidate", "Candidate"
        ENROLLED = "enrolled", "Enrolled"
        SUSPENDED = "suspended", "Suspended"
        GRADUATED = "graduated", "Graduated"
        DROPPED = "dropped", "Dropped"

    student = models.ForeignKey(
        "students.Student", on_delete=models.CASCADE, related_name="statuses"
    )
    status = models.CharField(max_length=20, choices=Status.choices)
    term = models.ForeignKey(
        "students.Term", null=True, blank=True, on_delete=models.SET_NULL
    )
    is_active = models.BooleanField(default=True)
    note = models.TextField(blank=True)
    effective_at = models.DateTimeField(default=timezone.now)

    class Meta:
        indexes = [models.Index(fields=["student", "-effective_at"])]
        ordering = ["-effective_at", "-id"]

    def __str__(self):
        return f"{self.student_id}:{self.status}"

    def clean(self):
        # simple transition gate (example rules)
        if self.pk is None:
            return
        prev = (
            StudentStatus.objects.filter(student=self.student)
            .order_by("-effective_at", "-id")
            .exclude(pk=self.pk)
            .first()
        )
        if not prev:
            return
        invalid = {
            self.Status.DROPPED: {self.Status.ENROLLED, self.Status.SUSPENDED},
            self.Status.GRADUATED: {self.Status.ENROLLED, self.Status.SUSPENDED},
        }
        if (
            prev.status in {self.Status.DROPPED, self.Status.GRADUATED}
            and self.status in invalid
        ):
            from django.core.exceptions import ValidationError

            raise ValidationError("Cannot move from a terminal state to active states.")
