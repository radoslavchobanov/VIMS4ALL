from rest_framework import serializers

from apps.courses.models import CourseClass
from apps.terms.models import AcademicTerm
from apps.terms.serializers import AcademicTermReadSerializer
from apps.terms.services import get_nearest_term

from .models import Status, Student, StudentCustodian, StudentStatus
from .services.photos import ensure_student_photo_or_default
from .services.dedup import has_potential_duplicate

from apps.common.media import public_media_url
from apps.common.generate_pin import generate_pin


def mgr(model):
    """Return all_objects if present (soft-delete setups), else .objects."""
    return getattr(model, "all_objects", model.objects)


STATUS_TRANSITIONS = {
    "enquire": {"accepted", "not_accepted"},
    "accepted": {"no_show", "active"},
    "no_show": set(),
    "active": {"retake", "failed", "graduate", "drop_out", "expelled"},
    "retake": {"active", "failed", "graduate", "drop_out", "expelled"},
    "failed": {"retake", "drop_out"},
    "graduate": set(),
    "drop_out": set(),
    "expelled": set(),
    "not_accepted": set(),
}


class StudentReadSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Student
        fields = [
            "id",
            "first_name",
            "last_name",
            "date_of_birth",
            "gender",
            "spin",
            "photo_url",
            "marital_status",
            "phone_number",
            "email",
            "nationality",
            "national_id",
            "previous_institute",
            "grade_acquired",
            "district",
            "county",
            "sub_county_division",
            "parish",
            "cell_village",
            "entry_date",
            "exit_date",
            "comments",
            "created_at",
        ]
        read_only_fields = ["spin", "created_at", "photo_url"]

    def get_photo_url(self, obj):
        f = getattr(obj, "photo", None)
        key = getattr(f, "name", None) if f and f.name else None
        return public_media_url(key, obj.institute_id)


class StudentWriteSerializer(serializers.ModelSerializer):
    """Create/Update accepts ALL fields (except photo). Only 3 are mandatory by model."""

    class Meta:
        model = Student
        exclude = [
            "id",
            "spin",
            "photo",
            "created_at",
            "institute",
        ]  # institute & spin are set server-side

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user
        iid = getattr(user, "institute_id", None)
        if not iid:
            raise serializers.ValidationError("User has no institute assigned.")

        # Ensure mandatory are present (model enforces it anyway, but be explicit)
        for f in ("first_name", "last_name", "date_of_birth"):
            if not validated_data.get(f):
                raise serializers.ValidationError({f: "This field is required."})

        # Duplicate guard (≤ ACTIVE)
        if has_potential_duplicate(
            iid,
            validated_data["first_name"],
            validated_data["last_name"],
            validated_data["date_of_birth"],
        ):
            raise serializers.ValidationError(
                "A student with the same name and birth date already exists (status ≤ active)."
            )

        validated_data["institute_id"] = iid
        validated_data["spin"] = generate_pin("S", iid, validated_data["first_name"])

        student = super().create(validated_data)

        # TODO default photo (institute logo) ; add "getattr(user.institute, "logo_key", None)" when having institute logo
        ensure_student_photo_or_default(student, None)

        # initial status = ENQUIRE (+ nearest term)
        term = get_nearest_term(iid)
        StudentStatus.objects.create(
            institute_id=iid,
            student=student,
            status=Status.ENQUIRE,
            term=term,
            is_active=True,
        )
        return student


class StudentPhotoUploadSerializer(serializers.Serializer):
    photo = serializers.ImageField()


class PhotoUploadResponseSerializer(serializers.Serializer):
    photo_url = serializers.URLField()


class StudentCustodianSerializer(serializers.ModelSerializer):
    student = serializers.PrimaryKeyRelatedField(queryset=Student.all_objects.none())

    class Meta:
        model = StudentCustodian
        fields = [
            "id",
            "student",
            "first_name",
            "last_name",
            "gender",
            "relation",
            "phone_number_1",
            "phone_number_2",
            "place_of_work",
            "nationality",
            "country",
            "sub_country",
            "parish",
            "cell",
            "comments",
        ]
        # Only these 4 are mandatory; model already enforces first_name/last_name/relation not null
        extra_kwargs = {
            "gender": {"required": False, "allow_null": True},
            "phone_number_1": {"required": False, "allow_null": True},
            "phone_number_2": {"required": False, "allow_null": True},
            "place_of_work": {"required": False, "allow_null": True},
            "nationality": {"required": False, "allow_null": True},
            "country": {"required": False, "allow_null": True},
            "sub_country": {"required": False, "allow_null": True},
            "parish": {"required": False, "allow_null": True},
            "cell": {"required": False, "allow_null": True},
            "comments": {"required": False, "allow_null": True},
        }

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        req = self.context.get("request")
        if req and getattr(req.user, "institute_id", None):
            self.fields["student"].queryset = mgr(Student).filter(
                institute_id=req.user.institute_id
            )

    def validate(self, attrs):
        # tenant safety: the selected student must belong to the caller’s institute
        req = self.context.get("request")
        if req and getattr(req.user, "institute_id", None):
            st = attrs.get("student") or getattr(self.instance, "student", None)
            if st and st.institute_id != req.user.institute_id:
                raise serializers.ValidationError("Student not in your institute.")
        return attrs

    # make 'relation' tolerant to case/wording like "PARENTS"/"Mother"
    def validate_relation(self, value: str):
        v = (value or "").strip().lower()
        if v in {"parent", "parents", "mother", "father", "mum", "mom", "dad"}:
            return StudentCustodian.Relationship.PARENT
        if v in {"guardian", "guard", "caregiver", "relative"}:
            return StudentCustodian.Relationship.GUARDIAN
        if v in {"sponsor", "sponsorship", "donor"}:
            return StudentCustodian.Relationship.SPONSOR
        return value


class StudentStatusWriteSerializer(serializers.ModelSerializer):
    student = serializers.PrimaryKeyRelatedField(queryset=mgr(Student).none())
    term = serializers.PrimaryKeyRelatedField(
        queryset=mgr(AcademicTerm).none(), allow_null=True, required=False
    )
    course_class = serializers.PrimaryKeyRelatedField(
        queryset=mgr(CourseClass).none(), allow_null=True, required=False
    )

    class Meta:
        model = StudentStatus
        fields = [
            "id",
            "student",
            "status",
            "term",
            "course_class",
            "is_active",
            "note",
            "effective_at",
        ]
        read_only_fields = ["is_active"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        req = self.context.get("request")
        if req and getattr(req.user, "institute_id", None):
            iid = req.user.institute_id
            self.fields["student"].queryset = mgr(Student).filter(institute_id=iid)
            self.fields["term"].queryset = mgr(AcademicTerm).filter(institute_id=iid)
            self.fields["course_class"].queryset = mgr(CourseClass).filter(
                institute_id=iid
            )

    def validate(self, attrs):
        req = self.context["request"]
        iid = req.user.institute_id
        student = attrs.get("student")
        new_status = attrs.get("status")
        term = attrs.get("term")

        last = (
            mgr(StudentStatus)
            .filter(institute_id=iid, student=student)
            .order_by("-is_active", "-effective_at", "-id")
            .first()
        )
        current = last.status if last else "enquire"

        allowed = STATUS_TRANSITIONS.get(current, set())
        if new_status not in allowed:
            raise serializers.ValidationError(
                {
                    "status": f"Transition from '{current}' to '{new_status}' is not allowed."
                }
            )

        # Require term for instructional statuses
        if new_status in {"active", "retake"} and term is None:
            raise serializers.ValidationError(
                {"term": "Term is required for ACTIVE/RETAKE."}
            )
        if new_status not in {"active", "retake"}:
            attrs["term"] = None

        return attrs


class CourseClassMinSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source="course.name", read_only=True)

    class Meta:
        model = CourseClass
        fields = ("id", "name", "course_name")


class StudentStatusReadSerializer(serializers.ModelSerializer):
    term = AcademicTermReadSerializer(read_only=True)
    term_name = serializers.CharField(source="term.name", read_only=True)
    course_class = CourseClassMinSerializer(read_only=True)
    class_name = serializers.CharField(source="course_class.name", read_only=True)

    class Meta:
        model = StudentStatus
        fields = (
            "id",
            "student",
            "status",
            "note",
            "effective_at",
            "is_active",
            "term",
            "term_name",
            "course_class",
            "class_name",
        )
