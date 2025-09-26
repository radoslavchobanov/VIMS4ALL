from pathlib import Path
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema

from .models import Student, StudentCustodian, StudentStatus, AcademicTerm
from .serializers import (
    PhotoUploadResponseSerializer,
    StudentPhotoUploadSerializer,
    StudentReadSerializer,
    StudentCustodianSerializer,
    StudentStatusSerializer,
    StudentWriteSerializer,
    AcademicTermSerializer,
)
from apps.common.media import public_media_url
from apps.common.views import ScopedModelViewSet


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

        return Response({"photo_url": public_media_url(student.photo.name)}, status=200)

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

    @action(detail=True, methods=["get"], url_path="offered-classes")
    def offered_classes(self, request, pk=None):
        """
        List classes that currently have >=1 instructor linked.
        Sorted by course name, class number.
        """
        from apps.courses.models import CourseClass, CourseInstructor

        iid = self.get_institute_id()

        cls_ids = (
            CourseInstructor.all_objects.filter(institute_id=iid)
            .values_list("course_class_id", flat=True)
            .distinct()
        )

        qs = CourseClass.all_objects.filter(
            institute_id=iid, id__in=cls_ids
        ).select_related("course")
        data = [
            {
                "id": cc.id,
                "course_name": cc.course.name,
                "abbr_name": cc.course.abbr_name,
                "class_number": cc.class_number,
                "classes_total": cc.course.classes_total,
            }
            for cc in qs
        ]
        return Response(
            sorted(data, key=lambda x: (x["course_name"], x["class_number"]))
        )


class AcademicTermViewSet(ScopedModelViewSet):
    model = AcademicTerm
    serializer_class = AcademicTermSerializer
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
