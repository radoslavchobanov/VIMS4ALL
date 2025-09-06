# apps/students/views.py
from pathlib import Path
from rest_framework import viewsets, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema

from .models import Student, StudentCustodian, StudentStatus, Term
from .serializers import (
    PhotoUploadResponseSerializer,
    StudentPhotoUploadSerializer,
    StudentReadSerializer,
    StudentCustodianSerializer,
    StudentStatusSerializer,
    StudentWriteSerializer,
    TermSerializer,
)
from .permissions import HasInstitute


class ScopedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasInstitute]
    model = None

    def get_institute_id(self):
        return getattr(self.request.user, "institute_id", None)

    def get_queryset(self):
        iid = self.get_institute_id()
        qs = self.model.all_objects
        return qs.filter(institute_id=iid) if iid else qs.none()

    def perform_create(self, serializer):
        serializer.save(institute_id=self.get_institute_id())


class StudentViewSet(ScopedModelViewSet):
    model = Student

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return StudentWriteSerializer
        return StudentReadSerializer


class StudentViewSet(ScopedModelViewSet):
    model = Student

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return StudentWriteSerializer
        return StudentReadSerializer

    @extend_schema(
        request=StudentPhotoUploadSerializer,
        responses={200: PhotoUploadResponseSerializer},
        summary="Upload/replace student photo (multipart/form-data)",
    )
    @action(
        detail=True,
        methods=["post"],
        url_path="photo",
        parser_classes=[MultiPartParser, FormParser],
    )
    def upload_photo(self, request, pk=None):
        student = self.get_object()
        ser = StudentPhotoUploadSerializer(data=request.data)
        ser.is_valid(raise_exception=True)

        file = ser.validated_data["photo"]
        ext = Path(file.name).suffix.lower()
        if ext in (".jpeg", ""):
            ext = ".jpg"
        if ext not in (".jpg", ".png", ".webp"):
            return Response({"detail": "Unsupported file type"}, status=400)

        # Delete previous object (MinIO) if any
        if student.photo:
            student.photo.delete(save=False)

        # Deterministic object key under the bucket
        object_key = f"{student.spin}{ext}"

        # Save via Django storage (configured to MinIO below)
        student.photo.save(object_key, file, save=True)

        return Response({"photo_url": getattr(student.photo, "url", None)}, status=200)

    @action(detail=False, methods=["get"], url_path="dedup")
    def dedup(self, request):
        # unchanged from earlier, now using service internally
        first = request.query_params.get("first_name", "").strip()
        last = request.query_params.get("last_name", "").strip()
        dob = request.query_params.get("date_of_birth", "").strip()
        if not (first and last and dob):
            return Response(
                {"detail": "first_name, last_name, date_of_birth are required."},
                status=400,
            )
        from .services.dedup import has_potential_duplicate

        exists = has_potential_duplicate(self.get_institute_id(), first, last, dob)
        return Response({"duplicate": exists})


class TermViewSet(ScopedModelViewSet):
    model = Term
    serializer_class = TermSerializer
    # perform_create inherited sets institute_id


class StudentCustodianViewSet(ScopedModelViewSet):
    model = StudentCustodian
    serializer_class = StudentCustodianSerializer
    # perform_create inherited sets institute_id


class StudentStatusViewSet(ScopedModelViewSet):
    model = StudentStatus
    serializer_class = StudentStatusSerializer

    def perform_create(self, serializer):
        # Deactivate previous active; set institute_id on new row
        iid = self.get_institute_id()
        student = serializer.validated_data["student"]
        StudentStatus.all_objects.filter(student=student, is_active=True).update(
            is_active=False
        )
        serializer.save(is_active=True, institute_id=iid)
