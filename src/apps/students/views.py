from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from .models import Student, StudentCustodian, StudentStatus, Term
from .serializers import (
    StudentSerializer,
    StudentCustodianSerializer,
    StudentStatusSerializer,
    TermSerializer,
)
from .permissions import HasInstitute


class ScopedModelViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, HasInstitute]

    def get_queryset(self):
        """
        Always resolve the queryset at request time so that the
        InstituteScopedManager sees the current institute from middleware.
        """
        if hasattr(self, "model"):
            return self.model.objects.all()
        return super().get_queryset()


class StudentViewSet(ScopedModelViewSet):
    model = Student
    serializer_class = StudentSerializer

    @action(detail=False, methods=["get"], url_path="dedup")
    def dedup(self, request):
        # /api/students/dedup?first_name=...&last_name=...&date_of_birth=YYYY-MM-DD
        first = request.query_params.get("first_name", "").strip()
        last = request.query_params.get("last_name", "").strip()
        dob = request.query_params.get("date_of_birth", "").strip()
        if not (first and last and dob):
            return Response(
                {"detail": "first_name, last_name, date_of_birth are required."},
                status=status.HTTP_400_BAD_REQUEST,
            )
        exists = Student.objects.filter(
            first_name__iexact=first, last_name__iexact=last, date_of_birth=dob
        ).exists()
        return Response({"duplicate": exists})


class TermViewSet(ScopedModelViewSet):
    model = Term
    serializer_class = TermSerializer


class StudentCustodianViewSet(ScopedModelViewSet):
    model = StudentCustodian
    serializer_class = StudentCustodianSerializer


class StudentStatusViewSet(ScopedModelViewSet):
    model = StudentStatus
    serializer_class = StudentStatusSerializer

    def perform_create(self, serializer):
        # mark previous statuses inactive, new one active
        student = serializer.validated_data["student"]
        StudentStatus.objects.filter(student=student, is_active=True).update(
            is_active=False
        )
        serializer.save(is_active=True, institute_id=self.request.user.institute_id)
