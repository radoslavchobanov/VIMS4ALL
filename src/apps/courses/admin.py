from django.contrib import admin
from .models import Course, CourseClass, CourseInstructor


@admin.register(Course)
class CourseAdmin(admin.ModelAdmin):
    list_display = (
        "name",
        "abbr_name",
        "classes_total",
        "course_fee",
        "certificate_type",
        "institute",
    )
    search_fields = ("name", "abbr_name")
    list_filter = ("certificate_type", "institute")


@admin.register(CourseClass)
class CourseClassAdmin(admin.ModelAdmin):
    list_display = ("course", "class_number", "institute")
    list_filter = ("course", "institute")


@admin.register(CourseInstructor)
class CourseInstructorAdmin(admin.ModelAdmin):
    list_display = ("course_class", "instructor", "institute")
    list_filter = ("course_class__course",)
    search_fields = (
        "instructor__first_name",
        "instructor__last_name",
        "course_class__course__name",
    )
