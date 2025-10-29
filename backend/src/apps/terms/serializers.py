from rest_framework import serializers
from .models import AcademicTerm
from .services import create_term_with_auto_name, compute_next_term_name


class AcademicTermReadSerializer(serializers.ModelSerializer):
    class Meta:
        model = AcademicTerm
        fields = ["id", "name", "start_date", "end_date"]


class AcademicTermWriteSerializer(serializers.Serializer):
    """
    Create/Update payload: name is system-generated (read-only).
    """

    start_date = serializers.DateField()
    end_date = serializers.DateField()

    def create(self, validated):
        request = self.context["request"]
        iid = getattr(request.user, "institute_id", None)
        if not iid:
            raise serializers.ValidationError("User has no institute assigned.")
        # auto-generate; use current calendar year for the ordinal sequence
        term = create_term_with_auto_name(
            institute_id=iid,
            start_date=validated["start_date"],
            end_date=validated["end_date"],
        )
        return term

    def update(self, instance, validated):
        # Name is immutable; keep server as the source of truth.
        instance.start_date = validated.get("start_date", instance.start_date)
        instance.end_date = validated.get("end_date", instance.end_date)
        instance.full_clean()
        instance.save(update_fields=["start_date", "end_date"])
        return instance


class NextNameResponseSerializer(serializers.Serializer):
    name = serializers.CharField()
    year = serializers.IntegerField()
    ordinal = serializers.IntegerField()
