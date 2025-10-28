# apps/courses/admin.py
from django.contrib import admin
from .models import Course, CourseClass, CourseInstructor


class CourseClassInline(admin.TabularInline):
    model = CourseClass
    extra = 0
    fields = (
        "index",
        "name",
        "fee_amount",
        "certificate_type",
        "credits",
        "hours_per_term",
        "start_date",
        "end_date",
    )
    readonly_fields = ("index", "name")
    can_delete = False


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    # Use model field names, not API aliases
    list_display = ("name", "abbreviation", "total_classes", "institute", "updated_at")
    list_filter = ("institute",)
    search_fields = ("name", "abbreviation")
    ordering = ("name",)
    inlines = [CourseClassInline]


@admin.register(CourseClass)
class CourseClassAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "course",
        "index",
        "fee_amount",
        "certificate_type",
        "credits",
        "hours_per_term",
        "start_date",
        "end_date",
    )
    # CourseClass has no direct 'institute' field; filter via the relation:
    list_filter = ("course__institute",)
    search_fields = ("name", "course__name")
    readonly_fields = ("index", "name", "course")
    ordering = ("course__name", "index")


@admin.register(CourseInstructor)
class CourseInstructorAdmin(admin.ModelAdmin):
    list_display = ("course_class", "instructor", "created_at")
    search_fields = (
        "course_class__name",
        "course_class__course__name",
        "instructor__first_name",
        "instructor__last_name",
    )
    list_filter = ("course_class__course__institute",)
    ordering = ("-created_at",)
