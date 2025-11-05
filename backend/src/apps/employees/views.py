from pathlib import Path
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action
from rest_framework import status
from rest_framework.exceptions import PermissionDenied
from drf_spectacular.utils import extend_schema
from django.db.models import Q, OuterRef, Subquery
from django.conf import settings
from django.utils import timezone

from apps.common.permissions import HasInstitute, HasEmployeeFunctionCode
from .models import Employee, EmployeeFunction, EmployeeCareer, EmployeeDependent
from .serializers import (
    EmployeeFunctionSerializer,
    EmployeeFunctionWriteSerializer,
    EmployeeListSerializer,
    EmployeeReadSerializer,
    EmployeeWriteSerializer,
    EmployeePhotoUploadSerializer,
    EmployeePhotoUploadResponseSerializer,
    EmployeeCareerSerializer,
    EmployeeDependentSerializer,
)
from .services.accounts import (
    create_employee_account_custom,
    create_employee_account_send_email,
    create_employee_account_invite,
    reset_employee_account,
)
from apps.common.media import public_media_url


class ScopedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasInstitute]
    model = None

    def _iid(self):
        return getattr(self.request.user, "institute_id", None)

    def get_queryset(self):
        iid = self._iid()
        return (
            self.model.all_objects.filter(institute_id=iid)
            if iid
            else self.model.all_objects.none()
        )

    def perform_create(self, serializer):
        serializer.save(institute_id=self._iid())


class EmployeeViewSet(ScopedModelViewSet):
    model = Employee

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return EmployeeWriteSerializer
        if self.action == "list":
            return EmployeeListSerializer
        return EmployeeReadSerializer

    def get_permissions(self):
        base = [p() for p in self.permission_classes]
        # include the merged action name here
        if self.action in {"account", "create_account", "reset_account"}:
            self.required_function_codes = getattr(
                settings,
                "ACCOUNT_MGMT_ALLOWED_FUNCTION_CODES",
                {"director", "registrar"},
            )
            base.append(HasEmployeeFunctionCode())
        return base

    def get_queryset(self):
        qs = super().get_queryset()
        today = timezone.now().date()
        open_fun = (
            EmployeeCareer.all_objects.filter(
                employee_id=OuterRef("pk"), start_date__lte=today
            )
            .order_by("-start_date", "-id")
            .values("function__name")[:1]
        )
        return qs.annotate(_current_function_name=Subquery(open_fun))

    @extend_schema(
        responses={200: EmployeeFunctionSerializer(many=True)}, parameters=[]
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="photo",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_photo(self, request, pk=None):
        employee = self.get_object()
        ser = EmployeePhotoUploadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        file = ser.validated_data["photo"]
        ext = Path(file.name).suffix.lower() or ".jpg"
        if ext not in (".jpg", ".jpeg", ".png", ".webp"):
            return Response({"detail": "Unsupported file type"}, status=400)
        if ext == ".jpeg":
            ext = ".jpg"

        if employee.photo:
            employee.photo.delete(save=False)
        object_key = f"{employee.epin}{ext}"
        employee.photo.save(object_key, file, save=True)
        return Response(
            {"photo_url": public_media_url(employee.photo.name)}, status=200
        )

    @action(detail=True, methods=["get"], url_path="functions")
    def functions(self, request, pk=None):
        """
        List functions actually assigned to this employee (distinct).
        By default: all historical + current.
        Use ?current=1 to limit to open assignment(s).
        """
        iid = self._iid()
        # ensure the employee belongs to caller's institute
        if not Employee.all_objects.filter(pk=pk, institute_id=iid).exists():
            return Response([], status=200)

        qs = EmployeeFunction.objects.filter(
            Q(institute__isnull=True) | Q(institute_id=iid),
            assignments__employee_id=pk,
        )

        qs = qs.distinct().only("id", "name", "code")
        ser = EmployeeFunctionSerializer(qs, many=True)
        return Response(ser.data, status=200)

    @action(detail=True, methods=["post", "delete"], url_path="account")
    def account(self, request, pk=None):
        """
        POST -> create account (email/custom)
        DELETE -> reset account
        """
        employee = self.get_object()

        if request.method == "DELETE":
            try:
                reset_employee_account(employee=employee)
                return Response(status=status.HTTP_204_NO_CONTENT)
            except ValueError as e:
                # already superuser / no account, etc.
                return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)

        # POST (create)
        data = request.data or {}
        mode = str(data.get("mode", "")).lower()

        # Optional: idempotency fast-path
        if employee.system_user_id:
            return Response(
                {
                    "detail": "Employee already has a system account.",
                    "user_id": employee.system_user_id,
                },
                status=status.HTTP_409_CONFLICT,
            )

        try:
            if mode == "email":
                res = create_employee_account_send_email(employee=employee)
                return Response(
                    {
                        "user_id": res.user_id,
                        "username": res.username,
                        "email_sent": True,
                    },
                    status=status.HTTP_201_CREATED,
                )

            if mode == "custom":
                username = (data.get("username") or "").strip().lower()
                password = data.get("password")
                if not username or not password:
                    return Response(
                        {
                            "detail": "username and password are required in custom mode."
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                res = create_employee_account_custom(
                    employee=employee, username=username, password=password
                )
                # If product requires showing the temp password, keep it; otherwise remove it.
                return Response(
                    {
                        "user_id": res.user_id,
                        "username": res.username,
                        "password": res.temporary_password,  # consider removing in future
                    },
                    status=status.HTTP_201_CREATED,
                )

            return Response({"detail": "mode must be 'email' or 'custom'."}, status=400)

        except ValueError as e:
            return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)


class OptionallyScopedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasInstitute]
    model = None
    serializer_class = None

    def get_queryset(self):
        # Manager already returns union (GLOBAL ∪ current institute) using middleware iid
        return self.model.objects.all()

    def perform_create(self, serializer):
        """
        Policy:
        - If payload omits 'institute', default to current user's institute (tenant-scoped).
        - If payload sets 'institute' NULL (global), allow ONLY for superusers (hardening).
        - If payload sets a non-NULL 'institute', enforce it matches current institute.
        """
        iid = getattr(self.request.user, "institute_id", None)
        is_global = serializer.validated_data.get("institute") is None

        if (
            "institute" not in serializer.validated_data
            and "institute_id" not in serializer.validated_data
        ):
            # default to tenant-scoped
            serializer.save(institute_id=iid)
            return

        if is_global:
            if not getattr(self.request.user, "is_superuser", False):
                from rest_framework.exceptions import PermissionDenied

                raise PermissionDenied(
                    "Only superusers can create global employee functions."
                )
            serializer.save()
            return

        # institute explicitly provided -> must match caller's institute
        if serializer.validated_data.get("institute_id") != iid:
            from rest_framework.exceptions import PermissionDenied

            raise PermissionDenied("Cannot create functions for another institute.")
        serializer.save()


class EmployeeFunctionViewSet(OptionallyScopedModelViewSet):
    model = EmployeeFunction
    # serializer_class set dynamically

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update", "destroy"):
            return EmployeeFunctionWriteSerializer
        return EmployeeFunctionSerializer

    def get_permissions(self):
        base = [p() for p in self.permission_classes]  # IsAuthenticated, HasInstitute
        if self.action in {"create", "update", "partial_update", "destroy"}:
            # gate writes to directors only (reuse your HasEmployeeFunctionCode)
            self.required_function_codes = getattr(
                settings, "EMPLOYEE_FUNCTION_WRITE_CODES", {"director"}
            )
            from apps.common.permissions import HasEmployeeFunctionCode

            base.append(HasEmployeeFunctionCode())
        return base

    def perform_create(self, serializer):
        """
        Only directors can create, and only for their own institute.
        Global (NULL institute) creation reserved for superusers (not exposed here).
        """
        iid = getattr(self.request.user, "institute_id", None)
        if not iid:
            raise PermissionDenied("No institute.")
        # Enforce institute-scoped creation
        serializer.save()  # serializer uses request.user.institute_id

    def perform_update(self, serializer):
        obj = self.get_object()
        if obj.institute_id is None:
            raise PermissionDenied("Default functions cannot be edited.")
        iid = getattr(self.request.user, "institute_id", None)
        if obj.institute_id != iid:
            raise PermissionDenied("You can edit only your institute's functions.")
        serializer.save()

    def perform_destroy(self, instance):
        if instance.institute_id is None:
            raise PermissionDenied("Default functions cannot be deleted.")
        iid = getattr(self.request.user, "institute_id", None)
        if instance.institute_id != iid:
            raise PermissionDenied("You can delete only your institute's functions.")
        instance.delete()

    def get_queryset(self):
        """
        Return GLOBAL (NULL institute) ∪ current user's institute.
        Optionally filter by ?employee=<id> while keeping the same union.
        """
        iid = getattr(self.request.user, "institute_id", None)
        if not iid:
            return self.model.objects.none()

        qs = self.model.all_objects.filter(
            Q(institute__isnull=True) | Q(institute_id=iid)
        )

        employee_id = self.request.query_params.get("employee")
        if employee_id:
            # Ensure the employee belongs to the same institute
            if not Employee.all_objects.filter(
                pk=employee_id, institute_id=iid
            ).exists():
                return self.model.objects.none()
            qs = qs.filter(assignments__employee_id=employee_id)

        # include institute_id in only() so your `scope` field can resolve correctly
        return qs.distinct().only("id", "name", "code", "institute_id")


class EmployeeCareerViewSet(ScopedModelViewSet):
    model = EmployeeCareer
    serializer_class = EmployeeCareerSerializer

    def get_queryset(self):
        qs = super().get_queryset()  # already scoped to request.user.institute_id
        params = self.request.query_params

        employee_id = params.get("employee")
        if employee_id:
            qs = qs.filter(employee_id=employee_id)

        # optional filters (handy for UI)
        function_id = params.get("function")
        if function_id:
            qs = qs.filter(function_id=function_id)

        current = params.get("current")

        return qs.order_by("-start_date", "-id")


class EmployeeDependentViewSet(ScopedModelViewSet):
    model = EmployeeDependent
    serializer_class = EmployeeDependentSerializer
