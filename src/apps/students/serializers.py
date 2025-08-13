from rest_framework import serializers
from .models import Student
from .services.spin import generate_spin


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

    def create(self, validated):
        request = self.context["request"]
        user = request.user
        if not getattr(user, "institute_id", None):
            raise serializers.ValidationError("User has no institute assigned.")
        validated["institute_id"] = user.institute_id
        validated["spin"] = generate_spin(
            user.institute_id,
            validated["first_name"],
            validated["last_name"],
            validated["date_of_birth"],
        )
        return super().create(validated)
