from django.db import models
from apps.common.models import InstituteScopedModel
from django.utils import timezone
from django.db.models import Q


class Student(InstituteScopedModel):
    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"

    class MaritalStatus(models.TextChoices):
        SINGLE = "single", "Not married"
        MARRIED = "married", "Married"
        SEPARATED = "separated", "Separated"
        DIVORCED = "divorced", "Divorced"
        WIDOWED = "widowed", "Widowed"

    # mandatory
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    date_of_birth = models.DateField()

    # identifiers/media
    spin = models.CharField(max_length=32)
    photo = models.ImageField(upload_to="students/", null=True, blank=True)

    # OPTIONAL fields -> null/blank allowed
    gender = models.CharField(
        max_length=12, choices=Gender.choices, null=True, blank=True
    )
    marital_status = models.CharField(
        max_length=12, choices=MaritalStatus.choices, null=True, blank=True
    )
    phone_number = models.CharField(max_length=40, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)

    nationality = models.CharField(max_length=60, null=True, blank=True)
    national_id = models.CharField(max_length=64, null=True, blank=True)

    previous_institute = models.CharField(max_length=160, null=True, blank=True)
    grade_acquired = models.CharField(max_length=60, null=True, blank=True)

    district = models.CharField(max_length=120, null=True, blank=True)
    county = models.CharField(max_length=120, null=True, blank=True)
    sub_county_division = models.CharField(max_length=120, null=True, blank=True)
    parish = models.CharField(max_length=120, null=True, blank=True)
    cell_village = models.CharField(max_length=120, null=True, blank=True)

    entry_date = models.DateField(null=True, blank=True)
    exit_date = models.DateField(null=True, blank=True)

    comments = models.TextField(null=True, blank=True)

    bank_name = models.CharField(max_length=255, blank=True, null=True)
    bank_account_number = models.CharField(max_length=64, blank=True, null=True)

    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["institute", "first_name", "last_name", "date_of_birth"],
                name="uq_student_person_like",
            ),
            # NEW: SPIN must be unique within an institute (not globally)
            models.UniqueConstraint(
                fields=["institute", "spin"],
                name="uq_student_spin_per_institute",
            ),
        ]
        indexes = [
            models.Index(
                fields=["institute", "last_name", "first_name"],
                name="stu_inst_last_first_idx",
            ),
            models.Index(fields=["spin"], name="stu_spin_idx"),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.exit_date and self.entry_date and self.exit_date < self.entry_date:
            raise ValidationError("Exit date must be on/after entry date.")
        if (
            self.entry_date
            and self.date_of_birth
            and self.entry_date <= self.date_of_birth
        ):
            raise ValidationError("Entry date must be after date of birth.")


class StudentCustodian(InstituteScopedModel):
    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"

    class Relationship(models.TextChoices):
        PARENT = "parent", "Parent"
        GUARDIAN = "guardian", "Guardian"
        SPONSOR = "sponsor", "Sponsor"

    student = models.ForeignKey(
        "students.Student", on_delete=models.CASCADE, related_name="custodians"
    )

    first_name = models.CharField(max_length=80)
    last_name = models.CharField(max_length=80)
    gender = models.CharField(
        max_length=12, choices=Gender.choices, null=True, blank=True
    )

    relation = models.CharField(max_length=20, choices=Relationship.choices)

    phone_number_1 = models.CharField(max_length=40, null=True, blank=True)
    phone_number_2 = models.CharField(max_length=40, null=True, blank=True)
    place_of_work = models.CharField(max_length=160, null=True, blank=True)

    nationality = models.CharField(max_length=60, null=True, blank=True)
    country = models.CharField(max_length=120, null=True, blank=True)
    sub_country = models.CharField(max_length=120, null=True, blank=True)

    parish = models.CharField(max_length=120, null=True, blank=True)
    cell = models.CharField(max_length=120, null=True, blank=True)

    comments = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ["last_name", "first_name", "id"]
        indexes = [
            models.Index(
                fields=["student", "relation"],
                name="cust_student_relation_idx",
            ),
            models.Index(
                fields=["last_name", "first_name"],
                name="cust_last_first_idx",
            ),
        ]

    def __str__(self):
        return f"{self.first_name} {self.last_name} ({self.get_relation_display()})"


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


PROGRESSION_VALUES = [
    Status.ACTIVE,
    Status.RETAKE,
    Status.FAILED,
    Status.GRADUATE,
    Status.DROP_OUT,
    Status.EXPELLED,
]


class StudentStatus(InstituteScopedModel):
    # Keep small, explicit rule-sets
    TERMINAL = {
        Status.GRADUATE,
        Status.DROP_OUT,
        Status.EXPELLED,
        Status.NOT_ACCEPTED,
        Status.NO_SHOW,
    }

    ALLOWED = {
        None: {Status.ACTIVE},  # from nothing → ACTIVE (for a given course_class)
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
        Status.FAILED: {Status.RETAKE, Status.DROP_OUT},
        # Terminal have no outgoing transitions
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

    course_class = models.ForeignKey(
        "courses.CourseClass",
        null=False,
        blank=False,
        default=None,
        on_delete=models.PROTECT,
    )

    is_active = models.BooleanField(default=True)
    note = models.TextField(blank=True)
    effective_at = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ["-effective_at", "-id"]
        indexes = [
            models.Index(
                fields=["student", "course_class", "-effective_at"],
                name="status_student_class_eff_idx",
            ),
            models.Index(fields=["course_class"], name="status_class_idx"),
        ]
        constraints = [
            models.UniqueConstraint(
                fields=["institute", "student", "course_class"],
                condition=Q(is_active=True),
                name="uq_one_active_status_per_student_per_class",
            ),
            models.CheckConstraint(
                name="ck_class_required_for_progress",
                check=Q(course_class__isnull=False),
            ),
            models.CheckConstraint(
                name="ck_status_is_progression",
                check=Q(status__in=[s.value for s in PROGRESSION_VALUES]),
            ),
        ]

    def __str__(self):
        return f"{self.student_id}:{self.course_class_id}:{self.status}"

    def clean(self):
        """Validate transition and invariants (single source of truth)."""
        from django.core.exceptions import ValidationError

        # previous row in THIS course_class
        prev = (
            StudentStatus.objects.filter(
                student=self.student, course_class=self.course_class
            )
            .exclude(pk=self.pk)
            .order_by("-is_active", "-effective_at", "-id")
            .first()
        )
        prev_code = prev.status if prev else None

        allowed_next = self.ALLOWED.get(prev_code, set())
        if self.status not in allowed_next:
            raise ValidationError(
                f"Invalid transition {prev_code or '∅'} → {self.status} for this class."
            )

        if prev and prev.status in self.TERMINAL and self.status != prev.status:
            raise ValidationError("Cannot transition out of a terminal state.")
