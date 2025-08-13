from django.contrib import admin
from .models import Institute


@admin.register(Institute)
class InstituteAdmin(admin.ModelAdmin):
    list_display = (
        "id",
        "name",
        "business_year_start",
        "business_year_end",
        "created_at",
    )
    search_fields = ("name",)
