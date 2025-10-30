from pathlib import Path
from rest_framework import status as drf_status
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.decorators import action
from drf_spectacular.utils import extend_schema
from django.db.models import QuerySet
from django.http import HttpResponse
from openpyxl import Workbook

from .models import Student, StudentCustodian, StudentStatus
from .serializers import (
    PhotoUploadResponseSerializer,
    StudentPhotoUploadSerializer,
    StudentReadSerializer,
    StudentCustodianSerializer,
    StudentStatusReadSerializer,
    StudentStatusWriteSerializer,
    StudentWriteSerializer,
)
from .services.import_xlsx import import_students_xlsx, CANONICAL_COLUMNS
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

    @action(detail=True, methods=["get"], url_path="statuses/allowed-next")
    def allowed_next_statuses(self, request, pk=None):
        """GET /api/students/{id}/statuses/allowed-next?course_class={id}"""
        from .models import StudentStatus  # local import to avoid cycles

        iid = self.get_institute_id()
        ccid = request.query_params.get("course_class")
        if not ccid:
            return Response(
                {"detail": "course_class query param is required."}, status=400
            )

        qs = StudentStatus.all_objects.filter(
            institute_id=iid, student_id=pk, course_class_id=ccid
        ).order_by("-is_active", "-effective_at", "-id")
        current = qs.filter(is_active=True).first() or qs.first()
        code = current.status if current else None
        return Response(sorted(StudentStatus.ALLOWED.get(code, set())))

    @action(
        detail=False,
        methods=["post"],
        url_path="import-xlsx",
        parser_classes=[MultiPartParser, FormParser],
    )
    def import_xlsx(self, request):
        """
        POST /api/students/import-xlsx?commit=0|1&atomic=0|1

        - commit=0 (default): dry-run (validate only)
        - commit=1: create records
        - atomic=1 with commit=1 makes it all-or-nothing
        """
        file = request.FILES.get("file")
        if not file:
            return Response({"detail": "Upload a file as 'file'."}, status=400)

        commit = request.query_params.get("commit", "0").lower() in {"1", "true", "yes"}
        atomic = request.query_params.get("atomic", "0").lower() in {"1", "true", "yes"}

        if commit and atomic:
            # A single transaction for the whole file:
            from django.db import transaction

            with transaction.atomic():
                payload = import_students_xlsx(request, file, commit=True, atomic=True)
        else:
            payload = import_students_xlsx(request, file, commit=commit, atomic=False)

        return Response(payload, status=drf_status.HTTP_200_OK)

    @action(detail=False, methods=["get"], url_path="import-template")
    def import_template(self, request):
        """
        GET /api/students/import-template
        Returns a simple XLSX with the expected columns and one example row.
        """
        wb = Workbook()
        ws = wb.active
        ws.title = "students"
        ws.append(CANONICAL_COLUMNS)
        # example row (only required fields filled)
        ws.append(
            [
                "John",
                "Doe",
                "2006-09-15",  # first_name,last_name,date_of_birth(ISO)
                "male",
                "single",
                "5551234567",
                "john.doe@example.com",
                "American",
                "ID123456",
                "Lincoln High School",
                "10th grade",
                "Seattle",
                "Washington",
                "King County",
                "",
                "",
                "2023-09-15",
                "",
                "Imported via bulk",
            ]
        )

        resp = HttpResponse(
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        )
        resp["Content-Disposition"] = (
            'attachment; filename="students_import_template.xlsx"'
        )
        wb.save(resp)
        return resp


class StudentCustodianViewSet(ScopedModelViewSet):
    model = StudentCustodian
    serializer_class = StudentCustodianSerializer
    # perform_create inherited sets institute_id


class StudentStatusViewSet(ScopedModelViewSet):
    model = StudentStatus

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return StudentStatusWriteSerializer
        return StudentStatusReadSerializer

    def get_queryset(self):
        # Base queryset must be StudentStatus; no 'term' anymore.
        qs = (
            super()
            .get_queryset()
            .filter(institute_id=self.get_institute_id())
            .select_related(
                "student",
                "course_class",
                "course_class__course",
            )
            .order_by("-is_active", "-effective_at", "-id")
        )
        sid = self.request.query_params.get("student")
        if sid:
            qs = qs.filter(student_id=sid)
        ccid = self.request.query_params.get("course_class")
        if ccid:
            qs = qs.filter(course_class_id=ccid)
        return qs

    def perform_create(self, serializer):
        # Deactivate only within (student, course_class), not globally
        iid = self.get_institute_id()
        student = serializer.validated_data["student"]
        cc = serializer.validated_data["course_class"]
        StudentStatus.all_objects.filter(
            institute_id=iid, student=student, course_class=cc, is_active=True
        ).update(is_active=False)
        serializer.save(is_active=True, institute_id=iid)
