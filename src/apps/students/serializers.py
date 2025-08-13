# src/apps/students/serializers.py
from rest_framework import serializers
from .models import Student, StudentCustodian, StudentStatus, Term
from .services.spin import generate_spin
from .services.photos import ensure_student_photo_or_default


class StudentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Student
        fields = [
            "id",
            "first_name",
            "last_name",
            "date_of_birth",
            "spin",
            "photo",
            "created_at",
        ]
        read_only_fields = ["spin", "created_at"]

    def create(self, validated_data):
        request = self.context["request"]
        user = request.user
        if not getattr(user, "institute_id", None):
            raise serializers.ValidationError("User has no institute assigned.")
        validated_data["institute_id"] = user.institute_id
        validated_data["spin"] = generate_spin(
            user.institute_id,
            validated_data["first_name"],
            validated_data["last_name"],
            validated_data["date_of_birth"],
        )
        student = super().create(validated_data)
        # default photo handling
        ensure_student_photo_or_default(
            student, getattr(user.institute, "logo_key", None)
        )
        return student


class TermSerializer(serializers.ModelSerializer):
    class Meta:
        model = Term
        fields = ["id", "name", "start_date", "end_date"]


class StudentCustodianSerializer(serializers.ModelSerializer):
    class Meta:
        model = StudentCustodian
        fields = ["id", "student", "full_name", "relation", "phone", "email"]


class StudentStatusSerializer(serializers.ModelSerializer):
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
        read_only_fields = ["is_active"]  # is_active toggled by service below
