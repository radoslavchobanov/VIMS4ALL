from django.shortcuts import get_object_or_404
from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema

from apps.employees.models import Employee
from apps.students.permissions import HasInstitute
from apps.employees.selectors import q_active_instructors
from .models import Course, CourseClass, CourseInstructor
from .serializers import (
    CourseSerializer,
    CourseClassReadSerializer,
    CourseClassWriteSerializer,
    CourseInstructorReadSerializer,
    CourseInstructorSerializer,
)


class ScopedModelViewSet(viewsets.ModelViewSet):
    """
    Base ViewSet that automatically scopes all queries to the current user's institute
    and stamps created objects with that institute. Subclasses only need to set:
      - model
      - (optionally) serializer_class or override get_serializer_class
    """

    permission_classes = [IsAuthenticated, HasInstitute]
    model = None  # type: ignore
    serializer_class = None  # type: ignore

    # Opt-in hooks for subclasses (SRP-friendly)
    select_related = tuple()
    prefetch_related = tuple()

    filterset_fields = ()
    search_fields = ()
    ordering_fields = ()
    ordering = ()

    def get_queryset(self):
        iid = getattr(self.request.user, "institute_id", None)
        qs = (
            self.model.all_objects.filter(institute_id=iid)  # type: ignore
            if iid
            else self.model.all_objects.none()  # type: ignore
        )
        if self.select_related:
            qs = qs.select_related(*self.select_related)
        if self.prefetch_related:
            qs = qs.prefetch_related(*self.prefetch_related)
        return qs

    def perform_create(self, serializer):
        serializer.save(institute_id=getattr(self.request.user, "institute_id", None))


# -------------------------- Courses --------------------------


class CourseViewSet(ScopedModelViewSet):
    model = Course
    serializer_class = CourseSerializer
    search_fields = ("name", "abbr_name")
    filterset_fields = ("certificate_type",)
    ordering_fields = ("name", "valid_from", "valid_until", "classes_total")
    ordering = ("name",)


# -------------------------- Course Classes --------------------------


class CourseClassViewSet(ScopedModelViewSet):
    model = CourseClass
    select_related = ("course", "term")

    # Read/Write split
    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return CourseClassWriteSerializer
        return CourseClassReadSerializer

    # Useful filters for UI
    filterset_fields = ("course", "term", "class_number")
    search_fields = ("name",)
    ordering_fields = ("class_number", "name", "term__start_date", "course__name")
    ordering = ("course__name", "term__start_date", "class_number")

    # Make GET responses clearly use the Read serializer in the schema
    @extend_schema(
        responses=CourseClassReadSerializer, request=CourseClassWriteSerializer
    )
    def list(self, *args, **kwargs):
        return super().list(*args, **kwargs)

    @extend_schema(
        responses=CourseClassReadSerializer, request=CourseClassWriteSerializer
    )
    def retrieve(self, *args, **kwargs):
        return super().retrieve(*args, **kwargs)

    @action(detail=False, methods=["get"], url_path=r"by-term/(?P<term_id>\d+)")
    def by_term(self, request, term_id: str):
        qs = (
            self.get_queryset()
            .filter(term_id=term_id)
            .order_by("course__name", "term__start_date", "class_number")
        )
        page = self.paginate_queryset(qs)
        ser = CourseClassReadSerializer(
            page or qs, many=True, context={"request": request}
        )
        if page is not None:
            return self.get_paginated_response(ser.data)
        return Response(ser.data)


# -------------------------- Course Instructors --------------------------


class CourseInstructorViewSet(ScopedModelViewSet):
    model = CourseInstructor
    select_related = ("course_class__course", "instructor")

    def get_serializer_class(self):
        if self.action in ("list", "retrieve"):
            return CourseInstructorReadSerializer
        return CourseInstructorSerializer

    filterset_fields = ("course_class", "instructor")
    search_fields = (
        "instructor__first_name",
        "instructor__last_name",
        "course_class__course__name",
    )
    ordering_fields = ("id", "course_class__class_number", "instructor__last_name")
    ordering = ("id",)

    @action(detail=False, methods=["get"], url_path="eligible-instructors")
    def eligible_instructors(self, request):
        iid = request.user.institute_id
        qs = (
            q_active_instructors(iid)
            .order_by("last_name", "first_name")
            .only("id", "first_name", "last_name")
        )
        data = [
            {"id": str(e.id), "name": f"{e.first_name} {e.last_name}".strip()}
            for e in qs
        ]
        return Response(data)

    @action(detail=False, methods=["get"], url_path=r"by-class/(?P<class_id>\d+)")
    def by_class(self, request, class_id: str):
        iid = request.user.institute_id
        # 404 if the class is not in this institute (prevents leakage)
        get_object_or_404(CourseClass.all_objects, pk=class_id, institute_id=iid)

        qs = (
            self.get_queryset()
            .filter(course_class_id=class_id)
            .select_related("instructor", "course_class__course")
            .order_by("instructor__last_name", "instructor__first_name", "id")
        )

        page = self.paginate_queryset(qs)
        serializer = CourseInstructorReadSerializer(
            page or qs, many=True, context={"request": request}
        )
        if page is not None:
            return self.get_paginated_response(serializer.data)
        return Response(serializer.data)
