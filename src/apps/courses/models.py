from django.db import models
from django.utils import timezone
from apps.common.models import InstituteScopedModel
from apps.employees.models import Employee


class Course(InstituteScopedModel):
    class CertificateType(models.TextChoices):
        CERTIFICATE = "certificate", "Certificate"
        DIPLOMA = "diploma", "Diploma"
        OTHER = "other", "Other"

    # Main form fields
    name = models.CharField(max_length=200)
    abbr_name = models.CharField(max_length=60, unique=False)
    classes_total = models.PositiveSmallIntegerField(default=1)  # “of 3”
    course_fee = models.DecimalField(max_digits=12, decimal_places=2)  # “Course fee”
    certificate_type = models.CharField(
        max_length=20,
        choices=CertificateType.choices,
        default=CertificateType.CERTIFICATE,
    )
    credits = models.PositiveSmallIntegerField(
        null=True, blank=True
    )  # “Course credits”
    hours_per_term = models.PositiveSmallIntegerField(null=True, blank=True)

    valid_from = models.DateField(null=True, blank=True)
    valid_until = models.DateField(null=True, blank=True)

    # Big text areas on form
    outcomes_text = models.TextField(null=True, blank=True)  # “What you will know…”
    prior_knowledge_text = models.TextField(
        null=True, blank=True
    )  # “Required prior knowledge”
    required_skills_text = models.TextField(null=True, blank=True)  # “Required skills”

    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        unique_together = (("institute", "name"), ("institute", "abbr_name"))
        ordering = ["name"]

    def __str__(self):
        return self.name


class CourseClass(InstituteScopedModel):
    course = models.ForeignKey(Course, on_delete=models.CASCADE, related_name="classes")
    term = models.ForeignKey(
        "students.AcademicTerm", on_delete=models.PROTECT, related_name="classes"
    )
    name = models.CharField(max_length=100, null=True, blank=True)
    class_number = models.PositiveSmallIntegerField()

    class Meta:
        unique_together = (("institute", "course", "class_number", "term"),)
        ordering = ["course__name", "term__start_date", "class_number"]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.class_number < 1 or (
            self.course and self.class_number > self.course.classes_total
        ):
            raise ValidationError("class_number must be within 1..classes_total.")


class CourseInstructor(InstituteScopedModel):
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
        unique_together = ("institute", "course_class", "instructor")
        indexes = [models.Index(fields=["course_class"], name="ci_class_idx")]


class Enrollment(InstituteScopedModel):
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
