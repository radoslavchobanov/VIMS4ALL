from django.db import models
from django.utils import timezone
from django.db.models import Q
from django.conf import settings
from apps.common.models import InstituteScopedModel, OptionallyScopedModel
from apps.employees.managers import EmployeeScopedManager


class Employee(InstituteScopedModel):

    objects = EmployeeScopedManager()
    all_objects = models.Manager()

    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other/Unspecified"

    class FamilyState(models.TextChoices):
        SINGLE = "single", "Not married"
        MARRIED = "married", "Married"
        SEPARATED = "separated", "Separated"
        DIVORCED = "divorced", "Divorced"
        WIDOWED = "widowed", "Widowed"

    # mandatory
    first_name = models.CharField(max_length=120)
    last_name = models.CharField(max_length=120)
    date_of_birth = models.DateField(null=True, blank=True)
    photo = models.ImageField(upload_to="students/", null=True, blank=True)

    gender = models.CharField(
        max_length=12, choices=Gender.choices, null=True, blank=True
    )
    family_state = models.CharField(
        max_length=12, choices=FamilyState.choices, null=True, blank=True
    )

    # Codes/IDs
    epin = models.CharField(max_length=32, unique=True)
    national_id = models.CharField(max_length=64, null=True, blank=True)
    nssf_id = models.CharField(max_length=64, null=True, blank=True)
    paye_id = models.CharField(max_length=64, null=True, blank=True)

    # Contact & address
    phone_number = models.CharField(max_length=40, null=True, blank=True)
    email = models.EmailField(null=True, blank=True)
    nationality = models.CharField(max_length=60, null=True, blank=True)
    district = models.CharField(max_length=120, null=True, blank=True)
    country = models.CharField(max_length=120, null=True, blank=True)
    sub_country = models.CharField(max_length=120, null=True, blank=True)
    parish = models.CharField(max_length=120, null=True, blank=True)
    cell_village = models.CharField(max_length=120, null=True, blank=True)

    previous_employer = models.CharField(max_length=160, null=True, blank=True)

    # Employment dates
    entry_date = models.DateField(null=True, blank=True)
    exit_date = models.DateField(null=True, blank=True)

    comments = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    system_user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="employee_profile",
    )

    bank_name = models.CharField(max_length=255, blank=True, null=True)
    bank_account_number = models.CharField(max_length=64, blank=True, null=True)

    @property
    def have_system_account(self) -> bool:
        return self.system_user_id is not None

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=["institute", "first_name", "last_name", "date_of_birth"],
                name="uq_employee_person_like",
            )
        ]
        indexes = [
            models.Index(
                fields=["institute", "last_name", "first_name"], name="emp_name_idx"
            ),
            models.Index(fields=["epin"], name="emp_epin_idx"),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.exit_date and self.entry_date and self.exit_date < self.entry_date:
            raise ValidationError("Exit date must be on/after entry date.")


class EmployeeFunction(OptionallyScopedModel):
    """
    Global when institute is NULL; institute-specific otherwise.
    """

    objects = models.Manager()
    all_objects = models.Manager()  # unscoped/raw access

    name = models.CharField(max_length=120)
    code = models.CharField(max_length=32, null=True, blank=True)

    class Meta:
        ordering = ["name"]
        constraints = [
            # Uniqueness among GLOBAL rows
            models.UniqueConstraint(
                fields=["name"],
                condition=Q(institute__isnull=True),
                name="uq_empfunc_global_name",
            ),
            # Uniqueness within an institute for non-NULL rows
            models.UniqueConstraint(
                fields=["institute", "name"],
                condition=Q(institute__isnull=False),
                name="uq_empfunc_per_institute_name",
            ),
        ]
        indexes = [
            models.Index(
                fields=["name"],
                name="empfunc_name_global_idx",
                condition=Q(institute__isnull=True),
            ),
            models.Index(
                fields=["institute", "name"],
                name="empfunc_inst_name_idx",
                condition=Q(institute__isnull=False),
            ),
        ]

    def __str__(self):
        return self.name


class EmployeeCareer(InstituteScopedModel):
    """
    Career history: when an employee serves a function, and gross salary (per the form).
    One open row (end_date IS NULL) per employee.
    """

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="career"
    )
    function = models.ForeignKey(
        EmployeeFunction, on_delete=models.PROTECT, related_name="assignments"
    )
    start_date = models.DateField(default=timezone.now)
    end_date = models.DateField(null=True, blank=True)

    # Using Decimal for currency-agnostic “Gross salary due” on the form
    gross_salary_due = models.DecimalField(
        max_digits=12, decimal_places=2, null=True, blank=True
    )
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ["-start_date", "-id"]
        constraints = [
            models.UniqueConstraint(
                fields=["institute", "employee"],
                condition=Q(end_date__isnull=True),
                name="uq_one_open_career_row_per_employee",
            )
        ]
        indexes = [
            models.Index(fields=["employee", "end_date"], name="emp_car_emp_end_idx"),
            models.Index(fields=["function", "end_date"], name="emp_car_fun_end_idx"),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.end_date and self.end_date < self.start_date:
            raise ValidationError("End date must be on/after start date.")


class EmployeeDependent(InstituteScopedModel):
    """Family/dependents (similar to StudentCustodian)."""

    class Gender(models.TextChoices):
        MALE = "male", "Male"
        FEMALE = "female", "Female"
        OTHER = "other", "Other/Unspecified"

    employee = models.ForeignKey(
        Employee, on_delete=models.CASCADE, related_name="dependents"
    )
    name = models.CharField(max_length=160)
    relation = models.CharField(max_length=60)  # free text per client form
    gender = models.CharField(
        max_length=12, choices=Gender.choices, null=True, blank=True
    )
    phone_number_1 = models.CharField(max_length=40, null=True, blank=True)
    phone_number_2 = models.CharField(max_length=40, null=True, blank=True)
    address = models.CharField(max_length=240, null=True, blank=True)
    comments = models.TextField(null=True, blank=True)

    class Meta:
        ordering = ["name", "id"]
        indexes = [models.Index(fields=["employee"], name="emp_dep_employee_idx")]

    def __str__(self):
        return f"{self.name} ({self.relation})"
