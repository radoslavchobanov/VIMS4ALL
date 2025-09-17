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
            "short_name",
            "business_year_start",
            "business_year_end",
            "post_office_box",
            "phone",
            "email",
            "district",
            "county",
            "sub_county",
            "parish",
            "cell_village",
            "registration_no",
            "inst_nssf_no",
            "inst_paye_no",
            "taxflag",
            "directions_and_comments",
            "logo_key",
            "logo_url",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at", "logo_key", "logo_url"]

    def get_logo_url(self, obj):
        if obj.logo_key:
            try:
                return default_storage.url(obj.logo_key)
            except Exception:
                return None
        return None


class InstituteWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Institute
        fields = [
            "name",
            "short_name",
            "business_year_start",
            "business_year_end",
            "post_office_box",
            "phone",
            "email",
            "district",
            "county",
            "sub_county",
            "parish",
            "cell_village",
            "registration_no",
            "inst_nssf_no",
            "inst_paye_no",
            "taxflag",
            "directions_and_comments",
        ]

    def validate(self, attrs):
        inst = getattr(self, "instance", None)
        start = attrs.get("business_year_start") or getattr(
            inst, "business_year_start", None
        )
        end = attrs.get("business_year_end") or getattr(inst, "business_year_end", None)
        if start and end and end < start:
            raise serializers.ValidationError(
                "Business year end must be on/after start."
            )
        phone = attrs.get("phone")
        if phone:
            normalized = (
                phone.replace(" / ", "/")
                .replace("/", ",")
                .replace(" ,", ",")
                .replace("  ", " ")
                .strip()
            )
            attrs["phone"] = normalized
        return attrs


class InstituteLogoUploadSerializer(serializers.Serializer):
    logo = serializers.ImageField()


class InstituteLogoUploadResponseSerializer(serializers.Serializer):
    logo_url = serializers.URLField()
