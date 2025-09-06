# src/apps/students/serializers.py
from rest_framework import serializers
from .models import Status, Student, StudentCustodian, StudentStatus, Term
from .services.spin import generate_spin
from .services.photos import ensure_student_photo_or_default
from .services.terms import get_nearest_term
from .services.dedup import has_potential_duplicate


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
        return getattr(f, "url", None) if f else None


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
        validated_data["spin"] = generate_spin(
            iid,
            validated_data["first_name"],
            validated_data["last_name"],
            validated_data["date_of_birth"],
        )

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


class TermSerializer(serializers.ModelSerializer):
    class Meta:
        model = Term
        fields = ["id", "name", "start_date", "end_date"]

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user
        if not getattr(user, "institute_id", None):
            raise serializers.ValidationError("User has no institute assigned.")
        validated_data["institute_id"] = user.institute_id
        return super().create(validated_data)


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
        # scope 'student' to the caller's institute
        req = self.context.get("request")
        if req and getattr(req.user, "institute_id", None):
            self.fields["student"].queryset = Student.all_objects.filter(
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
        # Let DRF raise the choices error if it’s something else
        return value


class StudentStatusSerializer(serializers.ModelSerializer):
    student = serializers.PrimaryKeyRelatedField(queryset=Student.all_objects.none())
    term = serializers.PrimaryKeyRelatedField(
        queryset=Term.all_objects.none(), allow_null=True, required=False
    )

    class Meta:
        model = StudentStatus
        fields = [
            "id",
            "student",
            "status",
            "term",
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
            self.fields["student"].queryset = Student.all_objects.filter(
                institute_id=iid
            )
            self.fields["term"].queryset = Term.all_objects.filter(institute_id=iid)
