from django.contrib import admin
from .models import Institute


@admin.register(Institute)
class InstituteAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "short_name",
        "district",
        "county",
        "phone",
        "email",
        "taxflag",
        "business_year_start",
        "business_year_end",
        "created_at",
    )
    search_fields = (
        "name",
        "short_name",
        "district",
        "county",
        "registration_no",
        "email",
    )
    list_filter = ("district", "county", "taxflag")
    readonly_fields = ("created_at", "updated_at")
    fieldsets = (
        ("Identity", {"fields": ("name", "short_name", "logo_key")}),
        ("Business Year", {"fields": ("business_year_start", "business_year_end")}),
        (
            "Contact & Registration",
            {
                "fields": (
                    "post_office_box",
                    "phone",
                    "email",
                    "registration_no",
                    "inst_nssf_no",
                    "inst_paye_no",
                )
            },
        ),
        (
            "Location",
            {"fields": ("district", "county", "sub_county", "parish", "cell_village")},
        ),
        ("Tax & Notes", {"fields": ("taxflag", "directions_and_comments")}),
        ("Timestamps", {"fields": ("created_at", "updated_at")}),
    )
