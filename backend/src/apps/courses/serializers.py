from __future__ import annotations
from django.db import transaction
from rest_framework import serializers
from apps.employees.models import Employee
from apps.employees.selectors import q_active_instructors
from .models import CertificateType, Course, CourseClass, CourseInstructor
from . import services


# ---------- helper ----------
def mgr(model):
    return getattr(model, "all_objects", model.objects)


# ============================
# Course
# ============================


class CourseReadSerializer(serializers.ModelSerializer):
    # Legacy names (read)
    abbr_name = serializers.CharField(source="abbreviation")
    classes_total = serializers.IntegerField(source="total_classes")

    class Meta:
        model = Course
        fields = [
            "id",
            "name",
            "abbr_name",  # legacy alias
            "classes_total",  # legacy alias
            "valid_from",
            "valid_until",
            "created_at",
            "updated_at",
        ]
        read_only_fields = fields


class CourseWriteSerializer(serializers.ModelSerializer):
    # Accept BOTH new and legacy names (write)
    abbreviation = serializers.CharField(required=False, allow_blank=True)
    total_classes = serializers.IntegerField(required=False)
    abbr_name = serializers.CharField(
        source="abbreviation", required=False, allow_blank=True, write_only=True
    )
    classes_total = serializers.IntegerField(
        source="total_classes", required=False, write_only=True
    )
    valid_from = serializers.DateField(required=False, allow_null=True)
    valid_until = serializers.DateField(required=False, allow_null=True)

    class Meta:
        model = Course
        fields = [
            "id",
            "name",
            # new names
            "abbreviation",
            "total_classes",
            "valid_from",
            "valid_until",
            # legacy write aliases
            "abbr_name",
            "classes_total",
        ]
        read_only_fields = ["id"]

    @transaction.atomic
    def create(self, validated):
        req = self.context["request"]
        iid = getattr(req.user, "institute_id", None)
        if not iid:
            raise serializers.ValidationError("User has no institute assigned.")
        validated["institute_id"] = iid

        course = super().create(validated)
        services.ensure_course_classes(course)
        return course

    @transaction.atomic
    def update(self, instance, validated):
        before_name = instance.name
        before_total = instance.total_classes
        course = super().update(instance, validated)
        if course.name != before_name or course.total_classes != before_total:
            services.ensure_course_classes(course)
        return course


# ============================
# CourseClass
# ============================


class CourseClassReadSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source="course.name", read_only=True)

    class Meta:
        model = CourseClass
        fields = [
            "id",
            "course",
            "course_name",
            "index",
            "name",
            "fee_amount",
            "certificate_type",
            "credits",
            "hours_per_term",
            "start_date",
            "end_date",
            "weekly_lessons",
            "learning_outcomes",
            "required_knowledge",
            "required_skills",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "course",
            "course_name",
            "index",
            "name",
            "created_at",
            "updated_at",
        ]


class CourseClassWriteSerializer(serializers.ModelSerializer):
    """Update mutable attributes only; creation/destruction is managed by Course."""

    certificate_type = serializers.ChoiceField(
        choices=[c.value for c in CertificateType], required=False, allow_blank=True
    )

    class Meta:
        model = CourseClass
        fields = [
            "fee_amount",
            "certificate_type",
            "credits",
            "hours_per_term",
            "start_date",
            "end_date",
            "weekly_lessons",
            "learning_outcomes",
            "required_knowledge",
            "required_skills",
        ]

    def validate(self, attrs):
        inst = self.instance
        if inst and "start_date" in attrs and attrs["start_date"] != inst.start_date:
            raise serializers.ValidationError(
                {"start_date": "Start date is set on creation and cannot be changed."}
            )
        # keep your existing start/end validation
        return super().validate(attrs)


# ============================
# CourseInstructor
# ============================


class CourseInstructorReadSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(
        source="course_class.course.name", read_only=True
    )
    class_number = serializers.IntegerField(source="course_class.index", read_only=True)
    instructor_name = serializers.SerializerMethodField()

    class Meta:
        model = CourseInstructor
        fields = [
            "id",
            "course_class",
            "course_name",
            "class_number",
            "instructor",
            "instructor_name",
            "created_at",
        ]
        read_only_fields = fields

    def get_instructor_name(self, obj: CourseInstructor) -> str:
        inst = obj.instructor
        return (
            getattr(inst, "full_name", None)
            or f"{inst.first_name} {inst.last_name}".strip()
        )


class CourseInstructorWriteSerializer(serializers.ModelSerializer):
    course_class = serializers.PrimaryKeyRelatedField(queryset=mgr(CourseClass).none())
    instructor = serializers.PrimaryKeyRelatedField(queryset=mgr(Employee).none())

    class Meta:
        model = CourseInstructor
        fields = ["id", "course_class", "instructor"]
        read_only_fields = ["id"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        req = self.context["request"]
        iid = getattr(req.user, "institute_id", None)
        if iid:
            # CourseClass is tenant-scoped via Course
            self.fields["course_class"].queryset = mgr(CourseClass).filter(
                course__institute_id=iid
            )
            self.fields["instructor"].queryset = q_active_instructors(iid)

    def validate(self, attrs):
        iid = getattr(self.context["request"].user, "institute_id", None)
        cc: CourseClass = attrs["course_class"]
        emp: Employee = attrs["instructor"]

        # cross-tenant guard (CourseClass has no institute FK; use course__institute)
        if getattr(cc.course, "institute_id", None) != getattr(
            emp, "institute_id", None
        ):
            raise serializers.ValidationError(
                {"instructor": "Instructor belongs to a different institute."}
            )

        # role eligibility
        if not q_active_instructors(iid).filter(pk=emp.pk).exists():
            raise serializers.ValidationError(
                {"instructor": "Selected employee is not an active Instructor."}
            )
        return attrs

    def create(self, validated):
        iid = getattr(self.context["request"].user, "institute_id", None)
        if not iid:
            raise serializers.ValidationError("User has no institute assigned.")
        # Always set the tenant on create
        validated["institute_id"] = iid  # ok to pass *_id, avoids extra query
        return super().create(validated)
