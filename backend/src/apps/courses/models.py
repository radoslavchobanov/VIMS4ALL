from django.db import models
from django.utils import timezone
from django.core.validators import MinValueValidator
from apps.common.models import InstituteScopedModel, TimeStampedModel
from apps.employees.models import Employee


class CertificateType(models.TextChoices):
    CERTIFICATE = "certificate", "Certificate"
    DIPLOMA = "diploma", "Diploma"
    OTHER = "other", "Other"


class Course(models.Model):
    institute = models.ForeignKey(
        "institutes.Institute", on_delete=models.CASCADE, related_name="courses"
    )
    name = models.CharField(max_length=200)
    abbreviation = models.CharField(
        max_length=32, blank=True, default=""
    )  # ← add default
    total_classes = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1)], default=1
    )
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # class Meta:
    #     unique_together = (("institute", "name"),)
    #     indexes = [models.Index(fields=["institute", "name"])]

    def __str__(self):
        return f"{self.name} ({self.institute_id})"


class CourseClass(models.Model):
    """
    A timeless level inside a course (e.g. Sewing-1 / Sewing-2 / Sewing-3).
    Name is derived from parent Course.name and index; we persist it as denormalized for UX and fast lookups.
    """

    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="classes")
    index = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1)], default=1
    )  # 1..Course.total_classes
    name = models.CharField(
        max_length=255, default=""
    )  # "Sewing-1" (kept in sync by services)
    # Editable fields in “Course Classes” tab:
    fee_amount = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )  # currency via institute policy
    certificate_type = models.CharField(
        max_length=64, blank=True
    )  # or FK to LUT_CertificateType later
    credits = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    hours_per_term = models.PositiveIntegerField(null=True, blank=True)
    start_date = models.DateField(
        null=True, blank=True
    )  # optional; not “Term”-bound in this version
    end_date = models.DateField(null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # class Meta:
    #     unique_together = (("course", "index"),)
    #     indexes = [models.Index(fields=["course", "index"])]

    def __str__(self):
        return self.name


class CourseInstructor(InstituteScopedModel, TimeStampedModel):
    """
    Assign 1..N instructors to a CourseClass.
    Only active employees with function “Instructor” and exit_date is null should be linked (validated in serializer).
    """

    course_class = models.ForeignKey(
        CourseClass, on_delete=models.CASCADE, related_name="instructors"
    )
    instructor = models.ForeignKey(
        Employee, on_delete=models.PROTECT, related_name="teaches_classes"
    )

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["course_class", "instructor"],
                name="uq_course_class_instructor",
            ),
        ]
        indexes = [
            models.Index(fields=["institute", "course_class"]),
        ]


class Enrollment(InstituteScopedModel, TimeStampedModel):
    student = models.ForeignKey(
        "students.Student", on_delete=models.CASCADE, related_name="enrollments"
    )
    course_class = models.ForeignKey(
        CourseClass, on_delete=models.PROTECT, related_name="enrollments"
    )
    status = models.CharField(
        max_length=30, default="active"
    )  # active, planned, completed, withdrawn
    enrolled_on = models.DateField(default=timezone.now)

    class Meta:
        unique_together = (("institute", "student", "course_class"),)
        indexes = [
            models.Index(
                fields=["student", "course_class"], name="enr_student_class_idx"
            )
        ]
