from django.contrib import admin
from .models import AcademicTerm, LowTermCountAlert


@admin.register(AcademicTerm)
class AcademicTermAdmin(admin.ModelAdmin):
    list_display = ("name", "start_date", "end_date", "institute")
    list_filter = ("institute",)
    search_fields = ("name",)


@admin.register(LowTermCountAlert)
class LowTermCountAlertAdmin(admin.ModelAdmin):
    list_display = ("institute", "last_alert_sent_at", "future_terms_count_at_last_alert")
    list_filter = ("institute",)
    readonly_fields = ("created_at", "updated_at")
