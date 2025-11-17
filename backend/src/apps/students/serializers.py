from rest_framework import serializers

from apps.courses.models import CourseClass

from .models import Status, Student, StudentCustodian, StudentStatus
from .services.photos import ensure_student_photo_or_default
from .services.dedup import has_potential_duplicate

from apps.common.media import public_media_url
from apps.common.generate_pin import generate_student_pin


def mgr(model):
    """Return all_objects if present (soft-delete setups), else .objects."""
    return getattr(model, "all_objects", model.objects)


PROGRESSION_CHOICES = [
    (Status.ACTIVE, Status.ACTIVE.label),
    (Status.RETAKE, Status.RETAKE.label),
    (Status.FAILED, Status.FAILED.label),
    (Status.GRADUATE, Status.GRADUATE.label),
    (Status.DROP_OUT, Status.DROP_OUT.label),
    (Status.EXPELLED, Status.EXPELLED.label),
]


class StudentReadSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()
    current_status = serializers.SerializerMethodField()
    current_course_class = serializers.SerializerMethodField()
    current_course_class_name = serializers.SerializerMethodField()

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
            "bank_name",
            "bank_account_number",
            "created_at",
            "updated_at",
            "current_status",
            "current_course_class",
            "current_course_class_name",
        ]
        read_only_fields = ["spin", "created_at", "updated_at", "photo_url", "current_status", "current_course_class", "current_course_class_name"]

    def get_photo_url(self, obj):
        f = getattr(obj, "photo", None)
        key = getattr(f, "name", None) if f and f.name else None
        # Convert updated_at to Unix timestamp for cache busting
        timestamp = None
        if hasattr(obj, "updated_at") and obj.updated_at:
            timestamp = str(int(obj.updated_at.timestamp()))
        return public_media_url(key, obj.institute_id, timestamp)

    def get_current_status(self, obj):
        """
        Get the current status of the student.
        Priority: latest active status, otherwise latest status overall.
        """
        # First try to get the latest active status
        active_status = (
            mgr(StudentStatus)
            .filter(student=obj, is_active=True)
            .order_by("-effective_at", "-id")
            .first()
        )

        if active_status:
            return active_status.status

        # If no active status, get the latest status overall
        latest_status = (
            mgr(StudentStatus)
            .filter(student=obj)
            .order_by("-effective_at", "-id")
            .first()
        )

        return latest_status.status if latest_status else None

    def get_current_course_class(self, obj):
        """
        Get the ID of the current course class.
        Priority: latest active status, otherwise latest status overall.
        """
        # First try to get the latest active status
        active_status = (
            mgr(StudentStatus)
            .filter(student=obj, is_active=True)
            .order_by("-effective_at", "-id")
            .first()
        )

        if active_status:
            return active_status.course_class_id

        # If no active status, get the latest status overall
        latest_status = (
            mgr(StudentStatus)
            .filter(student=obj)
            .order_by("-effective_at", "-id")
            .first()
        )

        return latest_status.course_class_id if latest_status else None

    def get_current_course_class_name(self, obj):
        """
        Get the name of the current course class.
        Priority: latest active status, otherwise latest status overall.
        """
        # First try to get the latest active status
        active_status = (
            mgr(StudentStatus)
            .filter(student=obj, is_active=True)
            .select_related("course_class")
            .order_by("-effective_at", "-id")
            .first()
        )

        if active_status:
            return active_status.course_class.name if active_status.course_class else None

        # If no active status, get the latest status overall
        latest_status = (
            mgr(StudentStatus)
            .filter(student=obj)
            .select_related("course_class")
            .order_by("-effective_at", "-id")
            .first()
        )

        return latest_status.course_class.name if latest_status and latest_status.course_class else None


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
        validated_data["spin"] = generate_student_pin(institute_id=iid).pin

        student = super().create(validated_data)

        # TODO default photo (institute logo) ; add "getattr(user.institute, "logo_key", None)" when having institute logo
        ensure_student_photo_or_default(student, None)

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
    course_class = serializers.PrimaryKeyRelatedField(
        queryset=mgr(CourseClass).none(), allow_null=False, required=True
    )

    # Use full Status enum values here:
    status = serializers.ChoiceField(choices=Status.choices)

    class Meta:
        model = StudentStatus
        fields = [
            "id",
            "student",
            "status",
            "course_class",
            "is_active",
            "note",
            "effective_at",
        ]
        read_only_fields = ["is_active"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        req = self.context.get("request")
        iid = getattr(getattr(req, "user", None), "institute_id", None)
        if iid:
            from django.utils import timezone
            from django.db.models import Q

            today = timezone.now().date()
            self.fields["student"].queryset = mgr(Student).filter(institute_id=iid)
            # Only show course classes from active courses
            # Active = valid_until is NULL OR valid_until > today
            self.fields["course_class"].queryset = mgr(CourseClass).filter(
                course__institute_id=iid
            ).filter(
                Q(course__valid_until__isnull=True) | Q(course__valid_until__gt=today)
            )

    def validate(self, attrs):
        req = self.context["request"]
        iid = req.user.institute_id
        student = attrs["student"]
        cc = attrs["course_class"]
        new_status = attrs["status"]
        new_effective_at = attrs.get("effective_at")

        # current (in this class)
        last = (
            mgr(StudentStatus)
            .filter(institute_id=iid, student=student, course_class=cc)
            .order_by("-is_active", "-effective_at", "-id")
            .first()
        )
        prev = last.status if last else None
        allowed = StudentStatus.ALLOWED.get(prev, set())
        if new_status not in allowed:
            raise serializers.ValidationError(
                {
                    "status": f"Transition from '{prev or '∅'}' to '{new_status}' is not allowed for this class."
                }
            )

        # Validate effective_at: must be after the previous status's effective_at for the same course class
        if last and new_effective_at and new_effective_at <= last.effective_at:
            raise serializers.ValidationError(
                {
                    "effective_at": f"Effect date must be after the previous status's effect date ({last.effective_at.strftime('%Y-%m-%d %H:%M:%S')})."
                }
            )

        return attrs

    def validate_status(self, value: str):
        v = (value or "").strip().lower()
        # normalize to enum value
        for code, _label in Status.choices:
            if v == code:
                return code
        raise serializers.ValidationError("Invalid status code.")


class CourseClassMinSerializer(serializers.ModelSerializer):
    course_name = serializers.CharField(source="course.name", read_only=True)

    class Meta:
        model = CourseClass
        fields = ("id", "name", "course_name")


class StudentStatusReadSerializer(serializers.ModelSerializer):
    course_class = CourseClassMinSerializer(read_only=True)
    class_name = serializers.CharField(source="course_class.name", read_only=True)
    term = serializers.SerializerMethodField()

    class Meta:
        model = StudentStatus
        fields = (
            "id",
            "student",
            "status",
            "note",
            "effective_at",
            "is_active",
            "course_class",
            "class_name",
            "term",
        )

    def get_term(self, obj):
        """
        Get the academic term name for this status record.
        Logic: Based on the status and effective_at date:
        - For active status: find term where effective_at falls within term dates
        - For enquire/accepted status: find the next future term after effective_at
        """
        from apps.terms.models import AcademicTerm

        if not obj.effective_at:
            return None

        status_code = obj.status
        effective_date = obj.effective_at.date() if hasattr(obj.effective_at, 'date') else obj.effective_at

        # For active students, find the term where effective_at falls within term dates
        if status_code == Status.ACTIVE:
            term = (
                AcademicTerm.objects
                .filter(
                    institute_id=obj.institute_id,
                    start_date__lte=effective_date,
                    end_date__gte=effective_date
                )
                .first()
            )
            return term.name if term else None

        # For enquire/accepted students, find the next future term after effective_at
        if status_code in {Status.ENQUIRE, Status.ACCEPTED}:
            next_term = (
                AcademicTerm.objects
                .filter(institute_id=obj.institute_id, start_date__gt=effective_date)
                .order_by("start_date")
                .first()
            )
            return next_term.name if next_term else None

        return None
