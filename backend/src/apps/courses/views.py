from __future__ import annotations
from django.db.models import Q
from rest_framework import viewsets, permissions
from rest_framework.decorators import action
from rest_framework.response import Response

from apps.employees.selectors import q_active_instructors
from .models import CertificateType, Course, CourseClass, CourseInstructor
from .serializers import (
    CourseReadSerializer,
    CourseWriteSerializer,
    CourseClassReadSerializer,
    CourseClassWriteSerializer,
    CourseInstructorReadSerializer,
    CourseInstructorWriteSerializer,
)


def _mgr(model):
    # non-scoped manager when available
    return getattr(model, "all_objects", model.objects)


class IsAuthenticatedAndTenant(permissions.IsAuthenticated):
    pass


class CourseViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndTenant]

    def get_queryset(self):
        iid = getattr(self.request.user, "institute_id", None)
        qs = Course.objects.filter(institute_id=iid).prefetch_related("classes")
        q = self.request.query_params.get("q")
        if q:
            qs = qs.filter(Q(name__icontains=q) | Q(abbreviation__icontains=q))
        return qs.order_by("name")

    def get_serializer_class(self):
        return (
            CourseWriteSerializer
            if self.action in {"create", "update", "partial_update"}
            else CourseReadSerializer
        )

    @action(detail=True, methods=["get"], url_path="classes")
    def classes(self, request, pk=None):
        iid = getattr(request.user, "institute_id", None)
        qs = (
            CourseClass.objects.select_related("course")
            .filter(course__institute_id=iid, course_id=pk)
            .order_by("index")
        )
        return Response(CourseClassReadSerializer(qs, many=True).data)


class CourseClassViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticatedAndTenant]

    def get_queryset(self):
        iid = getattr(self.request.user, "institute_id", None)
        qs = CourseClass.objects.select_related("course").filter(
            course__institute_id=iid
        )
        course_id = self.request.query_params.get("course")
        if course_id:
            qs = qs.filter(course_id=course_id)
        return qs.order_by("course__name", "index")

    def get_serializer_class(self):
        return (
            CourseClassWriteSerializer
            if self.action in {"create", "update", "partial_update"}
            else CourseClassReadSerializer
        )

    @action(detail=False, methods=["get"], url_path="choices")
    def choices(self, request):
        return Response(
            {
                "certificate_type": [
                    {"value": c.value, "display_name": c.label} for c in CertificateType
                ]
            }
        )


class CourseInstructorViewSet(viewsets.ModelViewSet):
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        iid = getattr(self.request.user, "institute_id", None)

        qs = _mgr(CourseInstructor).select_related(
            "course_class", "course_class__course", "instructor"
        )

        if iid is not None:
            qs = qs.filter(institute_id=iid)

        cc = self.request.query_params.get("course_class")
        if cc:
            try:
                qs = qs.filter(course_class_id=int(str(cc).strip().strip("/")))
            except ValueError:
                return _mgr(CourseInstructor).none()

        return qs.order_by("-created_at")

    def get_serializer_class(self):
        return (
            CourseInstructorReadSerializer
            if self.action in {"list", "retrieve"}
            else CourseInstructorWriteSerializer
        )

    def perform_create(self, serializer):
        serializer.save(institute_id=self.request.user.institute_id)

    @action(detail=False, methods=["get"], url_path="eligible-instructors")
    def eligible_instructors(self, request):
        iid = getattr(request.user, "institute_id", None)
        rows = [
            {
                "id": e.id,
                "name": getattr(e, "full_name", None)
                or f"{e.first_name} {e.last_name}".strip(),
            }
            for e in q_active_instructors(iid)
        ]
        return Response(rows)
