from datetime import date
from django.db import transaction
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework import serializers
from apps.institutes.models import Institute
from .services import provision_institute_admin_employee


User = get_user_model()


class AccountAdminCreateSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    institute_id = serializers.PrimaryKeyRelatedField(
        queryset=Institute.objects.all(),
        source="institute",
        required=False,
        allow_null=True,
    )
    make_institute_admin = serializers.BooleanField(
        write_only=True, required=False, default=False
    )

    # NEW: minimal employee fields needed for Employee creation
    employee_date_of_birth = serializers.DateField(write_only=True, required=False)
    employee_phone_number = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )
    employee_nationality = serializers.CharField(
        write_only=True, required=False, allow_blank=True
    )

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "password",
            "first_name",
            "last_name",
            "institute_id",
            "make_institute_admin",
            "employee_date_of_birth",
            "employee_phone_number",
            "employee_nationality",
            "is_active",
            "is_staff",
        ]
        read_only_fields = ["id"]
        extra_kwargs = {
            "is_active": {"required": False, "default": True},
            "is_staff": {"required": False, "default": False},
        }

    def validate(self, attrs):
        make_admin = attrs.get("make_institute_admin", False)
        if make_admin:
            if not attrs.get("institute"):
                raise serializers.ValidationError(
                    {"institute_id": "Required when making an institute admin."}
                )
        return attrs

    @transaction.atomic
    def create(self, validated):
        make_admin = validated.pop("make_institute_admin", False)

        # Pop employee-related fields before user creation
        dob: date | None = validated.pop("employee_date_of_birth", None)
        phone = validated.pop("employee_phone_number", "")
        nationality = validated.pop("employee_nationality", "")

        user = User.objects.create_user(**validated)

        if make_admin:
            grp, _ = Group.objects.get_or_create(name="institute_admin")
            user.groups.add(grp)

            # Optional: staff for Django admin access
            if not user.is_staff:
                user.is_staff = True
                user.save(update_fields=["is_staff"])

            provision_institute_admin_employee(user)

        return user


class AccountAdminListSerializer(serializers.ModelSerializer):
    institute_name = serializers.CharField(source="institute.name", read_only=True)
    is_institute_admin = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id",
            "username",
            "email",
            "first_name",
            "last_name",
            "institute",
            "institute_name",
            "is_active",
            "is_staff",
            "is_institute_admin",
        ]

    def get_is_institute_admin(self, obj):
        return obj.groups.filter(name="institute_admin").exists()
