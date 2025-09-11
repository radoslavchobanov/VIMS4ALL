from rest_framework import serializers
from apps.employees.models import Employee
from .models import Course, CourseClass, CourseInstructor


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
            "created_at",
        ]
        read_only_fields = ["created_at"]

    def create(self, validated):
        validated["institute_id"] = self.context["request"].user.institute_id
        return super().create(validated)


# ---- CourseClass ----
class CourseClassSerializer(serializers.ModelSerializer):
    course = serializers.PrimaryKeyRelatedField(queryset=Course.all_objects.none())

    class Meta:
        model = CourseClass
        fields = ["id", "course", "class_number"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        iid = getattr(self.context["request"].user, "institute_id", None)
        if iid:
            self.fields["course"].queryset = Course.all_objects.filter(institute_id=iid)

    def create(self, validated):
        validated["institute_id"] = self.context["request"].user.institute_id
        # optional guard: class_number within 1..course.classes_total
        total = validated["course"].classes_total
        n = validated["class_number"]
        if not (1 <= n <= total):
            raise serializers.ValidationError(
                {"class_number": f"Must be in 1..{total}"}
            )
        return super().create(validated)


# ---- Instructor link ----
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
        iid = getattr(self.context["request"].user, "institute_id", None)
        if iid:
            self.fields["course_class"].queryset = CourseClass.all_objects.filter(
                institute_id=iid
            )
            # only active instructors: function == "Instructor" AND exit_date is null
            from apps.employees.models import EmployeeCareer, EmployeeFunction

            # We allow choosing any employee here, but validate on save for correctness
            self.fields["instructor"].queryset = Employee.all_objects.filter(
                institute_id=iid
            )

    def validate(self, attrs):
        inst = attrs["instructor"]
        # Guard: active Instructor
        from apps.employees.models import EmployeeCareer, EmployeeFunction

        has_active_instructor_role = EmployeeCareer.all_objects.filter(
            institute_id=inst.institute_id,
            employee=inst,
            end_date__isnull=True,
            function__name__iexact="instructor",
        ).exists()
        if not has_active_instructor_role or inst.exit_date is not None:
            raise serializers.ValidationError(
                "Selected employee is not an active Instructor."
            )
        return attrs

    def create(self, validated):
        validated["institute_id"] = self.context["request"].user.institute_id
        return super().create(validated)
