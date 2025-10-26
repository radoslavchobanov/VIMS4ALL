from rest_framework import serializers
from apps.employees.models import Employee
from apps.employees.selectors import q_active_instructors
from .models import Course, CourseClass, CourseInstructor
from django.apps import apps as django_apps

AcademicTerm = django_apps.get_model("students", "AcademicTerm")


# ---- Course ----
class CourseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Course
        fields = [
            "id",
            "name",
            "abbr_name",
            "classes_total",
            "course_fee",
            "certificate_type",
            "credits",
            "hours_per_term",
            "valid_from",
            "valid_until",
            "outcomes_text",
            "prior_knowledge_text",
            "required_skills_text",
            "weekly_lessons_text",
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def create(self, validated):
        validated["institute_id"] = self.context["request"].user.institute_id
        return super().create(validated)


# =========================================================
# CourseClass
# =========================================================


# READ serializer (for list/retrieve)
class CourseClassReadSerializer(serializers.ModelSerializer):
    # denormalized convenience fields
    course_name = serializers.CharField(source="course.name", read_only=True)
    term_name = serializers.CharField(source="term.name", read_only=True)
    term_start_date = serializers.DateField(source="term.start_date", read_only=True)

    class Meta:
        model = CourseClass
        fields = [
            "id",
            "course",
            "course_name",
            "term",
            "term_name",
            "term_start_date",
            "name",
            "class_number",
            "created_at",
            "updated_at",
        ]
        read_only_fields = [
            "id",
            "created_at",
            "updated_at",
            "course_name",
            "term_name",
            "term_start_date",
        ]


# WRITE serializer (for create/update/patch)
class CourseClassWriteSerializer(serializers.ModelSerializer):
    course = serializers.PrimaryKeyRelatedField(queryset=Course.all_objects.none())
    term = serializers.PrimaryKeyRelatedField(queryset=AcademicTerm.all_objects.none())

    class Meta:
        model = CourseClass
        fields = ["course", "term", "name", "class_number"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        iid = getattr(self.context["request"].user, "institute_id", None)
        if iid:
            self.fields["course"].queryset = Course.all_objects.filter(institute_id=iid)
            self.fields["term"].queryset = AcademicTerm.all_objects.filter(
                institute_id=iid
            )

    def validate(self, attrs):
        inst = self.instance
        course = attrs.get("course") or getattr(inst, "course", None)
        class_number = attrs.get("class_number") or getattr(inst, "class_number", None)
        if course and class_number:
            total = course.classes_total
            if not (1 <= class_number <= total):
                raise serializers.ValidationError(
                    {"class_number": f"Must be within 1..{total}."}
                )
        return attrs

    def create(self, validated):
        validated["institute_id"] = self.context["request"].user.institute_id
        return super().create(validated)


# =========================================================
# CourseInstructor (unchanged behavior, add a READ serializer for UX)
# =========================================================


class CourseInstructorReadSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(
        source="course_class.course.name", read_only=True
    )
    class_number = serializers.IntegerField(
        source="course_class.class_number", read_only=True
    )
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
        read_only_fields = [
            "created_at",
            "course_name",
            "class_number",
            "instructor_name",
        ]

    def get_instructor_name(self, obj):
        return (
            getattr(obj.instructor, "full_name", None)
            or f"{obj.instructor.first_name} {obj.instructor.last_name}".strip()
        )


class CourseInstructorSerializer(serializers.ModelSerializer):
    course_class = serializers.PrimaryKeyRelatedField(
        queryset=CourseClass.all_objects.none()
    )
    instructor = serializers.PrimaryKeyRelatedField(
        queryset=Employee.all_objects.none()
    )

    class Meta:
        model = CourseInstructor
        fields = ["id", "course_class", "instructor"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        req = self.context["request"]
        iid = getattr(req.user, "institute_id", None)
        if iid:
            # scope both FKs explicitly by institute
            self.fields["course_class"].queryset = CourseClass.all_objects.filter(
                institute_id=iid
            )
            self.fields["instructor"].queryset = q_active_instructors(iid)

    def validate(self, attrs):
        iid = getattr(self.context["request"].user, "institute_id", None)
        inst: Employee = attrs["instructor"]

        # still belt & suspenders: ensure the chosen PK is eligible
        if not q_active_instructors(iid).filter(pk=inst.pk).exists():
            raise serializers.ValidationError(
                {"instructor": "Selected employee is not an active Instructor."}
            )

        # (optional) cross-institute guard: course_class and instructor must be same institute
        cc: CourseClass = attrs["course_class"]
        if getattr(cc, "institute_id", None) != getattr(inst, "institute_id", None):
            raise serializers.ValidationError(
                {"instructor": "Instructor belongs to a different institute."}
            )
        return attrs

    def create(self, validated):
        validated["institute_id"] = self.context["request"].user.institute_id
        return super().create(validated)
