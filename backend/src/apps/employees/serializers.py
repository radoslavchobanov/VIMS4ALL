from rest_framework import serializers
from .models import Employee, EmployeeFunction, EmployeeCareer, EmployeeDependent
from .services.epin import generate_epin


class EmployeeFunctionSerializer(serializers.ModelSerializer):
    class Meta:
        model = EmployeeFunction
        fields = ["id", "name"]


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
        # exclude fields managed server-side or by uploads
        exclude = [
            "id",
            "epin",
            "created_at",
            "institute",
        ]

    def create(self, validated):
        req = self.context["request"]
        iid = getattr(req.user, "institute_id", None)
        if not iid:
            raise serializers.ValidationError("User has no institute assigned.")

        # required by model
        for f in ("first_name", "last_name", "date_of_birth"):
            if not validated.get(f):
                raise serializers.ValidationError({f: "This field is required."})

        validated["institute_id"] = iid
        validated["epin"] = generate_epin(
            iid,
            validated["first_name"],
            validated["last_name"],
            validated["date_of_birth"],
        )
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
            self.fields["function"].queryset = EmployeeFunction.all_objects.filter(
                institute_id=iid
            )


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
