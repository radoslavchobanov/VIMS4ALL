from django.core.validators import RegexValidator, MinValueValidator, MaxValueValidator
from django.db import models
from apps.common.models import TimeStampedModel

PHONE_CHARS_VALIDATOR = RegexValidator(
    regex=r"^[0-9\s+/\-,]*$",
    message="Phone may contain digits, spaces, +, /, -, and commas.",
)


class Institute(TimeStampedModel):
    # Core
    name = models.CharField(max_length=255, unique=True)
    short_name = models.CharField(max_length=64, blank=True, null=True)
    business_year_start = models.DateField(null=True, blank=True)
    business_year_end = models.DateField(null=True, blank=True)

    # Contact & Registration
    post_office_box = models.CharField(max_length=255, blank=True, null=True)
    phone = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="One or more phone numbers, comma-separated (e.g. 075...,039...).",
        validators=[PHONE_CHARS_VALIDATOR],
    )
    email = models.EmailField(blank=True, null=True)

    # Geo / locality
    district = models.CharField(max_length=128, blank=True, null=True)
    county = models.CharField(max_length=128, blank=True, null=True)
    sub_county = models.CharField(max_length=128, blank=True, null=True)
    parish = models.CharField(max_length=128, blank=True, null=True)
    cell_village = models.CharField(max_length=128, blank=True, null=True)

    # Government numbers
    registration_no = models.CharField(max_length=128, blank=True, null=True)
    inst_nssf_no = models.CharField(
        "Inst.NSSF Nr.", max_length=128, blank=True, null=True
    )
    inst_paye_no = models.CharField(
        "Inst.PAYE Nr.", max_length=128, blank=True, null=True
    )

    # Tax
    taxflag = models.PositiveSmallIntegerField(
        default=0,
        validators=[MinValueValidator(0), MaxValueValidator(1)],
        help_text="0 or 1 (kept as small int to mirror legacy).",
    )

    # Free text
    directions_and_comments = models.TextField(blank=True, null=True)

    # Logo
    logo_key = models.CharField(max_length=512, null=True, blank=True)  # storage key

    # validators
    _phone_chars = RegexValidator(
        regex=r"^[0-9\s+/\-,]*$",
        message="Phone may contain digits, spaces, +, /, -, and commas.",
    )

    def clean(self):
        if self.phone:
            self._phone_chars(self.phone)
        if self.business_year_start and self.business_year_end:
            if self.business_year_end < self.business_year_start:
                from django.core.exceptions import ValidationError

                raise ValidationError(
                    {"business_year_end": "Must be on/after business_year_start."}
                )

    def __str__(self) -> str:
        return self.name

    class Meta:
        indexes = [
            models.Index(fields=["name"], name="institutes_name_idx"),
            models.Index(fields=["short_name"], name="institutes_short_name_idx"),
            models.Index(
                fields=["district", "county"], name="institutes_district_county_idx"
            ),
        ]
