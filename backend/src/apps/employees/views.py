from pathlib import Path
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema

from apps.common.permissions import HasInstitute
from .models import Employee, EmployeeFunction, EmployeeCareer, EmployeeDependent
from .serializers import (
    EmployeeReadSerializer,
    EmployeeWriteSerializer,
    EmployeePhotoUploadSerializer,
    EmployeePhotoUploadResponseSerializer,
    EmployeeFunctionSerializer,
    EmployeeCareerSerializer,
    EmployeeDependentSerializer,
)


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
        return (
            EmployeeWriteSerializer
            if self.action in ("create", "update", "partial_update")
            else EmployeeReadSerializer
        )

    @extend_schema(
        request=EmployeePhotoUploadSerializer,
        responses={200: EmployeePhotoUploadResponseSerializer},
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
        return Response({"photo_url": getattr(employee.photo, "url", None)}, status=200)


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
    serializer_class = EmployeeFunctionSerializer


class EmployeeCareerViewSet(ScopedModelViewSet):
    model = EmployeeCareer
    serializer_class = EmployeeCareerSerializer


class EmployeeDependentViewSet(ScopedModelViewSet):
    model = EmployeeDependent
    serializer_class = EmployeeDependentSerializer
