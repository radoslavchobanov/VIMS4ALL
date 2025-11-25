from rest_framework import serializers
from django.utils import timezone

from .models import Employee, EmployeeFunction, EmployeeCareer, EmployeeDependent
from apps.common.generate_pin import generate_employee_pin
from .services.dedup import has_potential_duplicate_employee
from apps.common.media import public_media_url


class EmployeeFunctionSerializer(serializers.ModelSerializer):
    scope = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeFunction
        fields = ["id", "name", "scope"]

    def get_scope(self, obj):
        return "global" if obj.institute_id is None else "institute"


class EmployeeFunctionWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeFunction
        fields = [
            "id",
            "name",
            "code",
        ]  # institute is inferred; code optional if you want to expose it
        extra_kwargs = {"id": {"read_only": True}}

    def create(self, validated):
        req = self.context["request"]
        iid = getattr(req.user, "institute_id", None)
        if not iid:
            raise serializers.ValidationError("User has no institute assigned.")
        name = validated.get("name")
        code = name.lower()
        return EmployeeFunction.objects.create(institute_id=iid, name=name, code=code)

    def update(self, instance, validated):
        # Editing GLOBAL rows is forbidden
        if instance.institute_id is None:
            raise serializers.ValidationError("Default functions cannot be edited.")
        # Renaming within same institute is allowed

        name = validated.get("name", instance.name)
        code = name.lower()
        instance.name = name
        instance.code = code
        instance.save(update_fields=["name", "code"])
        return instance


class EmployeeReadSerializer(serializers.ModelSerializer):
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "epin",
            "first_name",
            "last_name",
            "date_of_birth",
            "gender",
            "family_state",
            "phone_number",
            "email",
            "national_id",
            "nssf_id",
            "paye_id",
            "nationality",
            "district",
            "country",
            "sub_country",
            "parish",
            "cell_village",
            "previous_employer",
            "entry_date",
            "exit_date",
            "comments",
            "bank_name",
            "bank_account_number",
            "created_at",
            "updated_at",
            "photo_url",
        ]
        read_only_fields = ["epin", "created_at", "updated_at", "photo_url"]

    def get_photo_url(self, obj):
        key = getattr(getattr(obj, "photo", None), "name", None)
        # Convert updated_at to Unix timestamp for cache busting
        timestamp = None
        if hasattr(obj, "updated_at") and obj.updated_at:
            timestamp = str(int(obj.updated_at.timestamp()))
        return public_media_url(key, timestamp=timestamp) if key else None


class EmployeeWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        exclude = ["id", "epin", "created_at", "updated_at", "institute", "photo"]

    def create(self, validated):
        req = self.context["request"]
        iid = getattr(req.user, "institute_id", None)
        if not iid:
            raise serializers.ValidationError("User has no institute assigned.")
        for f in ("first_name", "last_name"):
            if not validated.get(f):
                raise serializers.ValidationError({f: "This field is required."})
        if validated.get("date_of_birth") and has_potential_duplicate_employee(
            iid,
            validated["first_name"],
            validated["last_name"],
            validated["date_of_birth"],
        ):
            raise serializers.ValidationError(
                "An active employee with the same name and birth date already exists."
            )
        validated["institute_id"] = iid
        validated["epin"] = generate_employee_pin(institute_id=iid).pin
        return super().create(validated)


class EmployeePhotoUploadSerializer(serializers.Serializer):
    photo = serializers.ImageField()


class EmployeePhotoUploadResponseSerializer(serializers.Serializer):
    photo_url = serializers.URLField()


class EmployeeCareerSerializer(serializers.ModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.all_objects.none())
    function = serializers.PrimaryKeyRelatedField(
        queryset=EmployeeFunction.all_objects.none()
    )
    function_name = serializers.CharField(source="function.name", read_only=True)
    created_by_name = serializers.SerializerMethodField()
    created_by_function = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeCareer
        fields = [
            "id",
            "employee",
            "function",
            "function_name",
            "start_date",
            "total_salary",
            "gross_salary",
            "take_home_salary",
            "paye",
            "employee_nssf",
            "institute_nssf",
            "notes",
            "created_by_name",
            "created_by_function",
        ]
        read_only_fields = ["created_by", "function_name", "created_by_name", "created_by_function"]

    def get_created_by_name(self, obj):
        """Get the full name of the employee who created this career assignment."""
        if not obj.created_by:
            return None
        return f"{obj.created_by.first_name} {obj.created_by.last_name}".strip()

    def get_created_by_function(self, obj):
        """Get the current function/role of the employee who created this career assignment."""
        if not obj.created_by:
            return None

        from django.utils import timezone

        # Get the most recent function assignment for this employee
        today = timezone.now().date()
        current_function = (
            EmployeeCareer.all_objects
            .filter(
                employee=obj.created_by,
                start_date__lte=today
            )
            .order_by("-start_date", "-id")
            .select_related("function")
            .first()
        )

        if current_function and current_function.function:
            return current_function.function.name

        return None

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        req = self.context.get("request")
        if req and getattr(req.user, "institute_id", None):
            iid = req.user.institute_id
            self.fields["employee"].queryset = Employee.all_objects.filter(
                institute_id=iid
            )
            # CRITICAL: union of global + current institute
            self.fields["function"].queryset = EmployeeFunction.objects.all()

    def validate(self, data):
        from django.utils import timezone
        from datetime import timedelta

        # Validate start_date: must be at least 1 month from today
        start_date = data.get("start_date")
        if start_date:
            today = timezone.now().date()
            one_month_from_today = today + timedelta(days=30)  # Approximately 1 month

            if start_date < one_month_from_today:
                raise serializers.ValidationError(
                    {
                        "start_date": f"Start date must be at least 1 month from today (minimum: {one_month_from_today.strftime('%Y-%m-%d')})."
                    }
                )

        # Double-check the selected function is in the union visible to employee's institute
        employee = data.get("employee")
        func = data.get("function")
        if employee and func:
            allowed = EmployeeFunction.objects.filter(pk=func.pk).exists()
            if not allowed:
                raise serializers.ValidationError(
                    {"function": "Function is not available for this institute."}
                )
        return data

    def create(self, validated_data):
        # Automatically set created_by from the current user's employee record
        req = self.context.get("request")
        if req and req.user:
            try:
                employee = Employee.all_objects.get(system_user=req.user)
                validated_data["created_by"] = employee
            except Employee.DoesNotExist:
                # User doesn't have an associated employee record
                pass

        return super().create(validated_data)


class EmployeeDependentSerializer(serializers.ModelSerializer):
    employee = serializers.PrimaryKeyRelatedField(queryset=Employee.all_objects.none())

    class Meta:
        model = EmployeeDependent
        fields = [
            "id",
            "employee",
            "name",
            "relation",
            "gender",
            "phone_number_1",
            "phone_number_2",
            "address",
            "comments",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        req = self.context.get("request")
        if req and getattr(req.user, "institute_id", None):
            self.fields["employee"].queryset = Employee.all_objects.filter(
                institute_id=req.user.institute_id
            )


class EmployeeListSerializer(serializers.ModelSerializer):
    current_function = serializers.SerializerMethodField()
    photo_url = serializers.SerializerMethodField()

    class Meta:
        model = Employee
        fields = [
            "id",
            "epin",
            "first_name",
            "last_name",
            "email",
            "current_function",
            "have_system_account",
            "photo_url",
            "exit_date",
        ]

    def get_current_function(self, obj):
        cf = getattr(obj, "_current_function_name", None)
        if cf is not None:
            return cf
        row = (
            EmployeeCareer.all_objects.filter(
                employee_id=obj.id, start_date__lte=timezone.now().date()
            )
            .select_related("function")
            .order_by("-start_date", "-id")
            .first()
        )
        return row.function.name if row else None

    def get_photo_url(self, obj):
        key = getattr(getattr(obj, "photo", None), "name", None)
        # Convert updated_at to Unix timestamp for cache busting
        timestamp = None
        if hasattr(obj, "updated_at") and obj.updated_at:
            timestamp = str(int(obj.updated_at.timestamp()))
        return public_media_url(key, timestamp=timestamp) if key else None
