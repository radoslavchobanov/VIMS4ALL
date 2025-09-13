from rest_framework import serializers
from django.core.files.storage import default_storage
from .models import Institute


class InstituteReadSerializer(serializers.ModelSerializer):
    logo_url = serializers.SerializerMethodField()

    class Meta:
        model = Institute
        fields = [
            "id",
            "name",
            "business_year_start",
            "business_year_end",
            "logo_key",  # read-only key we store in DB
            "logo_url",  # computed public URL
            "created_at",
        ]
        read_only_fields = ["id", "created_at", "logo_key", "logo_url"]

    def get_logo_url(self, obj):
        if obj.logo_key:
            try:
                return default_storage.url(obj.logo_key)
            except Exception:
                return None
        return None


class InstituteWriteSerializer(serializers.ModelSerializer):
    """
    POST/PUT/PATCH payload. No logo_key here.
    All listed fields are required on POST (DRF default), you said they should be mandatory.
    """

    class Meta:
        model = Institute
        fields = ["name", "business_year_start", "business_year_end"]

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


class InstituteLogoUploadSerializer(serializers.Serializer):
    logo = serializers.ImageField()


class InstituteLogoUploadResponseSerializer(serializers.Serializer):
    logo_url = serializers.URLField()
