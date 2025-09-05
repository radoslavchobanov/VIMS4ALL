from django.db import models
from apps.common.models import InstituteScopedModel
from django.utils import timezone
from django.db.models import Q
from rest_framework import serializers


class Student(InstituteScopedModel):
    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other / Unspecified"

    class MaritalStatus(models.TextChoices):
        SINGLE = "single", "Not married"
        MARRIED = "married", "Married"
        SEPARATED = "separated", "Separated"
        DIVORCED = "divorced", "Divorced"
        WIDOWED = "widowed", "Widowed"

    # Identity
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    date_of_birth = models.DateField()
    gender = models.CharField(max_length=12, choices=Gender.choices, blank=True)
    spin = models.CharField(max_length=32, unique=True)  # generated id
    photo = models.ImageField(upload_to="students/", blank=True, null=True)

    # Contact & civil
    marital_status = models.CharField(
        max_length=12, choices=MaritalStatus.choices, blank=True
    )
    phone_number = models.CharField(max_length=40, blank=True)
    email = models.EmailField(blank=True)

    # National info & IDs
    nationality = models.CharField(max_length=60, blank=True)  # e.g. "Uganda"
    national_id = models.CharField(max_length=64, blank=True)  # gov't ID

    # Education history
    previous_institute = models.CharField(max_length=160, blank=True)
    grade_acquired = models.CharField(max_length=60, blank=True)  # e.g. "Div 2"

    # Address / locality (kept flat for MVP)
    district = models.CharField(max_length=120, blank=True)
    county = models.CharField(max_length=120, blank=True)
    sub_county_division = models.CharField(max_length=120, blank=True)
    parish = models.CharField(max_length=120, blank=True)
    cell_village = models.CharField(max_length=120, blank=True)

    # Lifecycle
    entry_date = models.DateField(null=True, blank=True)
    exit_date = models.DateField(null=True, blank=True)

    # Notes
    comments = models.TextField(blank=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["institute", "first_name", "last_name", "date_of_birth"],
                name="uq_student_person_like",
            )
        ]
        indexes = [
            models.Index(fields=["institute", "last_name", "first_name"]),
            models.Index(fields=["spin"]),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.spin})"

    def clean(self):
        # Simple chronology guards
        if self.exit_date and self.entry_date and self.exit_date < self.entry_date:
            raise serializers.ValidationError("Exit date must be on/after entry date.")
        if (
            self.entry_date
            and self.date_of_birth
            and self.entry_date <= self.date_of_birth
        ):
            raise serializers.ValidationError("Entry date must be after date of birth.")


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


class Status(models.TextChoices):
    ENQUIRE = "enquire", "Enquire"
    ACCEPTED = "accepted", "Accepted"
    NO_SHOW = "no_show", "No show"
    ACTIVE = "active", "Active"
    RETAKE = "retake", "Retake"
    FAILED = "failed", "Failed"
    GRADUATE = "graduate", "Graduate"
    DROP_OUT = "drop_out", "Drop out"
    EXPELLED = "expelled", "Expelled"
    NOT_ACCEPTED = "not_accepted", "Not accepted"


class StudentStatus(InstituteScopedModel):

    # sets useful for rules
    TERMINAL = {
        Status.GRADUATE,
        Status.DROP_OUT,
        Status.EXPELLED,
        Status.NOT_ACCEPTED,
        Status.NO_SHOW,
    }
    TERM_REQUIRED = {Status.ACTIVE, Status.RETAKE}

    # Allowed transitions (prev -> {next, ...})
    ALLOWED = {
        None: {Status.ENQUIRE, Status.ACCEPTED, Status.NOT_ACCEPTED},  # first status
        Status.ENQUIRE: {Status.ACCEPTED, Status.NOT_ACCEPTED, Status.NO_SHOW},
        Status.ACCEPTED: {Status.ACTIVE, Status.NO_SHOW, Status.NOT_ACCEPTED},
        Status.ACTIVE: {
            Status.RETAKE,
            Status.FAILED,
            Status.GRADUATE,
            Status.DROP_OUT,
            Status.EXPELLED,
        },
        Status.RETAKE: {
            Status.ACTIVE,
            Status.FAILED,
            Status.GRADUATE,
            Status.DROP_OUT,
            Status.EXPELLED,
        },
        Status.FAILED: {Status.RETAKE, Status.DROP_OUT},  # fail → retake or leave
        # Terminal states have no outgoing transitions
        Status.GRADUATE: set(),
        Status.DROP_OUT: set(),
        Status.EXPELLED: set(),
        Status.NOT_ACCEPTED: set(),
        Status.NO_SHOW: set(),
    }

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
        # one *active* status row per student, per institute
        constraints = [
            models.UniqueConstraint(
                fields=["institute", "student"],
                condition=Q(is_active=True),
                name="uq_one_active_status_per_student",
            ),
            # Term must be present for ACTIVE/RETAKE; otherwise optional
            models.CheckConstraint(
                name="ck_term_required_for_active_or_retake",
                check=(
                    Q(status__in=[Status.ACTIVE, Status.RETAKE], term__isnull=False)
                    | ~Q(status__in=[Status.ACTIVE, Status.RETAKE])
                ),
            ),
        ]

    def __str__(self):
        return f"{self.student_id}:{self.status}"

    def clean(self):
        """
        Enforce allowed transitions and simple invariants.
        NOTE: This uses the most recent *other* status as 'prev'.
        """
        from django.core.exceptions import ValidationError

        # previous status (most recent before this one)
        prev = (
            StudentStatus.objects.filter(student=self.student)
            .exclude(pk=self.pk)
            .order_by("-effective_at", "-id")
            .first()
        )
        prev_code = prev.status if prev else None

        # Check transition is allowed
        allowed_next = self.ALLOWED.get(prev_code, set())
        if self.status not in allowed_next:
            raise ValidationError(
                f"Invalid transition {prev_code or '∅'} → {self.status}."
            )

        # Guard against leaving terminal states
        if prev and prev.status in self.TERMINAL and self.status != prev.status:
            # This is covered by ALLOWED above, but keep a clear error
            raise ValidationError("Cannot transition out of a terminal state.")

        # Term requirement is covered by the DB CheckConstraint; keep defensive validation:
        if self.status in self.TERM_REQUIRED and self.term_id is None:
            raise ValidationError("Term is required for ACTIVE/RETAKE statuses.")
