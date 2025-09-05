from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from rest_framework import serializers
from apps.institutes.models import Institute

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
            "is_active",
            "is_staff",
        ]
        read_only_fields = ["id"]
        extra_kwargs = {
            "is_active": {"required": False, "default": True},
            "is_staff": {
                "required": False,
                "default": False,
            },  # staff can access Django admin; you decide
        }

    def create(self, validated):
        make_admin = validated.pop("make_institute_admin", False)
        user = User.objects.create_user(**validated)
        if make_admin:
            grp, _ = Group.objects.get_or_create(name="institute_admin")
            user.groups.add(grp)
            # Optional: mark staff to use Django admin UI
            if not user.is_staff:
                user.is_staff = True
                user.save(update_fields=["is_staff"])
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
