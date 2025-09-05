from rest_framework import serializers
from .models import Institute


class InstituteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Institute
        fields = [
            "id",
            "name",
            "business_year_start",
            "business_year_end",
            "logo_key",
            "created_at",
        ]
        read_only_fields = ["id", "created_at"]

    def validate(self, attrs):
        start = attrs.get("business_year_start") or getattr(
            self.instance, "business_year_start", None
        )
        end = attrs.get("business_year_end") or getattr(
            self.instance, "business_year_end", None
        )
        if start and end and end < start:
            raise serializers.ValidationError(
                "Business year end must be on/after start."
            )
        return attrs
