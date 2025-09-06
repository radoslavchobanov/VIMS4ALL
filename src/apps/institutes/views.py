# apps/institutes/views.py
from pathlib import Path
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.decorators import action
from rest_framework.parsers import MultiPartParser, FormParser
from drf_spectacular.utils import extend_schema
from django.core.files.storage import default_storage

from apps.common.permissions import (
    IsSuperuser,
    IsSuperuserOrInstituteAdminOfSameInstitute,
)
from .models import Institute
from .serializers import (
    InstituteReadSerializer,
    InstituteWriteSerializer,
    InstituteLogoUploadSerializer,
    InstituteLogoUploadResponseSerializer,
)


class InstituteAdminViewSet(viewsets.ModelViewSet):
    queryset = Institute.objects.all()
    permission_classes = [IsSuperuser]  # default for all standard actions

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return InstituteWriteSerializer
        return InstituteReadSerializer

    @extend_schema(
        request=InstituteLogoUploadSerializer,
        responses={200: InstituteLogoUploadResponseSerializer},
        summary="Upload/replace institute logo (multipart/form-data)",
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="logo",
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[
            IsSuperuserOrInstituteAdminOfSameInstitute
        ],  # 👈 override here
    )
    def upload_logo(self, request, pk=None):
        institute = self.get_object()  # object-level permission will run here
        ser = InstituteLogoUploadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        file = ser.validated_data["logo"]
        ext = Path(file.name).suffix.lower()
        if ext in (".jpeg", ""):
            ext = ".jpg"
        if ext not in (".jpg", ".png", ".webp"):
            return Response(
                {"detail": "Unsupported file type"}, status=status.HTTP_400_BAD_REQUEST
            )

        # delete old logo if any
        if institute.logo_key:
            try:
                default_storage.delete(institute.logo_key)
            except Exception:
                pass

        key = f"institutes/{institute.id}/logo{ext}"
        saved_key = default_storage.save(key, file)
        institute.logo_key = saved_key
        institute.save(update_fields=["logo_key"])

        return Response({"logo_url": default_storage.url(saved_key)}, status=200)
