from django.contrib import admin
from .models import AcademicTerm


@admin.register(AcademicTerm)
class AcademicTermAdmin(admin.ModelAdmin):
    list_display = ("name", "start_date", "end_date", "institute")
    list_filter = ("institute",)
    search_fields = ("name",)
