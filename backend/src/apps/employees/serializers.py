from rest_framework import serializers
from .models import Employee, EmployeeFunction, EmployeeCareer, EmployeeDependent
from apps.common.generate_pin import generate_pin
from .services.dedup import has_potential_duplicate_employee


class EmployeeFunctionSerializer(serializers.ModelSerializer):
    scope = serializers.SerializerMethodField()

    class Meta:
        model = EmployeeFunction
        fields = ["id", "name", "scope"]

    def get_scope(self, obj):
        return "global" if obj.institute_id is None else "institute"


class EmployeeReadSerializer(serializers.ModelSerializer):

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
            "created_at",
        ]
        read_only_fields = ["epin", "created_at"]


class EmployeeWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Employee
        exclude = ["id", "epin", "created_at", "institute"]

    def create(self, validated):
        req = self.context["request"]
        iid = getattr(req.user, "institute_id", None)
        if not iid:
            raise serializers.ValidationError("User has no institute assigned.")

        # model-required
        for f in ("first_name", "last_name"):
            if not validated.get(f):
                raise serializers.ValidationError({f: "This field is required."})

        # duplicate guard (active employees only; also checks swapped names)
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
        validated["epin"] = generate_pin("E", iid, validated["first_name"])
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

    class Meta:
        model = EmployeeCareer
        fields = [
            "id",
            "employee",
            "function",
            "start_date",
            "end_date",
            "net_salary_due",
            "notes",
        ]

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
        ]

    def get_current_function(self, obj):
        cf = getattr(obj, "_current_function_name", None)
        if cf is not None:
            return cf
        row = (
            EmployeeCareer.all_objects.filter(employee_id=obj.id, end_date__isnull=True)
            .select_related("function")
            .first()
        )
        return row.function.name if row else None
