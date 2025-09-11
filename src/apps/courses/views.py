from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.students.permissions import HasInstitute
from .models import Course, CourseClass, CourseInstructor
from .serializers import (
    CourseSerializer,
    CourseClassSerializer,
    CourseInstructorSerializer,
)


class ScopedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasInstitute]
    model = None
    serializer_class = None

    def get_queryset(self):
        iid = getattr(self.request.user, "institute_id", None)
        return (
            self.model.all_objects.filter(institute_id=iid)
            if iid
            else self.model.all_objects.none()
        )

    def perform_create(self, serializer):
        serializer.save(institute_id=getattr(self.request.user, "institute_id", None))


class CourseViewSet(ScopedModelViewSet):
    model = Course
    serializer_class = CourseSerializer


class CourseClassViewSet(ScopedModelViewSet):
    model = CourseClass
    serializer_class = CourseClassSerializer


class CourseInstructorViewSet(ScopedModelViewSet):
    model = CourseInstructor
    serializer_class = CourseInstructorSerializer
