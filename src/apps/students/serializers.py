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
    # bind a safe default; we’ll override per-request
    student = serializers.PrimaryKeyRelatedField(queryset=Student.all_objects.none())

    class Meta:
        model = StudentCustodian
        fields = ["id", "student", "full_name", "relation", "phone", "email"]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Set queryset at REQUEST time to avoid early evaluation
        req = self.context.get("request")
        if req and getattr(req.user, "institute_id", None):
            self.fields["student"].queryset = Student.all_objects.filter(
                institute_id=req.user.institute_id
            )

    def validate(self, attrs):
        # Optional: require at least one contact method
        if not attrs.get("phone") and not attrs.get("email"):
            raise serializers.ValidationError("Provide at least phone or email.")
        return attrs


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
