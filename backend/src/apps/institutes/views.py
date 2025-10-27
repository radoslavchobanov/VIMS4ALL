from pathlib import Path
from rest_framework import viewsets, status, mixins
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
from apps.common.media import public_media_url


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

        return Response({"logo_url": public_media_url(institute.logo_key)}, status=200)


class InstituteViewSet(
    mixins.RetrieveModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet
):
    """
    GET    /api/institutes/{id}/
    PATCH  /api/institutes/{id}/
    POST   /api/institutes/{id}/logo/
    """

    queryset = Institute.objects.all()
    serializer_class = InstituteReadSerializer
    permission_classes = [IsSuperuserOrInstituteAdminOfSameInstitute]

    @action(
        detail=True,
        methods=["post"],
        url_path="logo",
        parser_classes=[MultiPartParser, FormParser],
        permission_classes=[IsSuperuserOrInstituteAdminOfSameInstitute],
    )
    def logo(self, request, pk=None):
        inst: Institute = self.get_object()

        # Accept both names to stay compatible with PhotoBox and any other clients
        file = (
            request.FILES.get("photo")
            or request.FILES.get("logo")
            or request.data.get("photo")
            or request.data.get("logo")
        )
        if not file:
            return Response({"detail": "photo (or logo) is required"}, status=400)

        ext = Path(file.name).suffix.lower() or ".jpg"
        if ext not in {".jpg", ".jpeg", ".png", ".webp"}:
            return Response({"detail": "Unsupported file type"}, status=400)

        object_key = f"institutes/{inst.id}{ext}"

        # Save to ImageField if present; else save via storage and set logo_key
        if hasattr(inst, "logo"):
            if inst.logo:
                inst.logo.delete(save=False)
            inst.logo.save(object_key, file, save=True)
            key = inst.logo.name
        else:
            from django.core.files.storage import default_storage

            if getattr(inst, "logo_key", None):
                try:
                    default_storage.delete(inst.logo_key)
                except Exception:
                    pass
            saved = default_storage.save(object_key, file)
            setattr(inst, "logo_key", saved)
            inst.save(update_fields=["logo_key"])
            key = saved

        url = public_media_url(key)
        # Return both keys for maximum compatibility with existing UI widgets
        return Response({"photo_url": url, "logo_url": url}, status=status.HTTP_200_OK)
