from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework import status
from drf_spectacular.utils import extend_schema
from datetime import date, timedelta
from django.utils import timezone
from django.db import transaction
from apps.common.views import ScopedModelViewSet
from .models import AcademicTerm, TermTransition
from .serializers import (
    AcademicTermReadSerializer,
    AcademicTermWriteSerializer,
    NextNameResponseSerializer,
)
from .services import compute_next_term_name


class AcademicTermViewSet(ScopedModelViewSet):
    model = AcademicTerm

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return AcademicTermWriteSerializer
        return AcademicTermReadSerializer

    def get_queryset(self):
        return super().get_queryset().select_related("institute")

    @extend_schema(
        responses={200: NextNameResponseSerializer},
        summary="Preview the next auto-generated term name for the current institute",
    )
    @action(detail=False, methods=["get"], url_path="next-name")
    def next_name(self, request):
        iid = self.get_institute_id()
        start_date_param = request.query_params.get("start_date")
        year_param = request.query_params.get("year")

        # Parse start_date if provided (format: YYYY-MM-DD)
        start_date_obj = None
        if start_date_param:
            try:
                start_date_obj = date.fromisoformat(start_date_param)
            except (ValueError, TypeError):
                pass

        # Compute next name based on start_date or year
        year = int(year_param) if year_param else None
        name, ordinal = compute_next_term_name(
            institute_id=iid, year=year, start_date=start_date_obj
        )

        # Determine the year used for the response
        if start_date_obj:
            response_year = start_date_obj.year
        elif year:
            response_year = year
        else:
            response_year = date.today().year

        return Response({"name": name, "year": response_year, "ordinal": ordinal})

    @extend_schema(
        summary="Move students to next term",
        description=(
            "Bulk move of ACTIVE students to the next term (keeping same class). "
            "Can only be executed once per term, within 1 week after term end date. "
            "Only available for director and registrar roles."
        ),
    )
    @action(detail=True, methods=["post"], url_path="move-students")
    def move_students(self, request, pk=None):
        """
        Move all ACTIVE students to the next term while keeping them in their current class.
        Requirements:
        - Current date must be within 1 week after term end date
        - Transition must not have been executed already
        - User must have director or registrar role
        """
        from apps.students.models import Student, StudentStatus, Status
        from apps.courses.models import CourseClass

        from django.contrib.auth.models import Group
        from apps.employees.models import Employee, EmployeeCareer

        term = self.get_object()
        user = request.user
        institute_id = self.get_institute_id()

        # Get user roles from Groups
        roles = list(Group.objects.filter(user=user).values_list("name", flat=True))
        if getattr(user, "is_superuser", False) and "superuser" not in roles:
            roles.append("superuser")

        # Fetch employee and function code
        function_code = None
        emp = (
            Employee.all_objects.select_related("institute")
            .filter(system_user_id=user.id, institute_id=institute_id)
            .only("id", "system_user_id", "institute_id")
            .first()
        )

        if emp:
            # Get current (open) career row -> function
            cur = (
                EmployeeCareer.all_objects.select_related("function")
                .filter(employee_id=emp.id)
                .only("function_id", "employee_id")
                .first()
            )
            if cur and hasattr(cur, "function") and cur.function:
                function_code = getattr(cur.function, "code", None)

        has_permission = "institute_admin" in roles or function_code in [
            "director",
            "registrar",
        ]

        if not has_permission:
            return Response(
                {"error": "Only directors and registrars can move students."},
                status=status.HTTP_403_FORBIDDEN,
            )

        # Check if within 1 week after term end
        today = timezone.now().date()
        one_week_after_end = term.end_date + timedelta(days=7)

        if today < term.end_date:
            return Response(
                {"error": f"Cannot move students before term ends on {term.end_date}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if today > one_week_after_end:
            return Response(
                {"error": f"Move students window expired on {one_week_after_end}."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Get or create TermTransition record
        transition, created = TermTransition.objects.get_or_create(
            term=term,
            institute_id=institute_id,
        )

        # Check if already executed
        if transition.transition_executed_at:
            return Response(
                {
                    "error": f"Students already moved on {transition.transition_executed_at}.",
                    "executed_by": transition.executed_by,
                    "students_moved": transition.students_moved_count,
                },
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Find the next term
        next_term = (
            AcademicTerm.objects.filter(
                institute_id=institute_id, start_date__gt=term.end_date
            )
            .order_by("start_date")
            .first()
        )

        if not next_term:
            return Response(
                {"error": "No upcoming term found to move students to."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Begin transaction
        students_moved = 0
        with transaction.atomic():
            # Get all students for this institute (use all_objects to bypass scoping)
            active_students = Student.all_objects.filter(
                institute_id=institute_id
            ).select_related("institute")

            for student in active_students:
                print(f"Processing student: {student.first_name} {student.last_name} (ID: {student.id})")

                # Get latest active status
                latest_status = (
                    StudentStatus.all_objects.filter(student=student, is_active=True)
                    .select_related("course_class", "course_class__course")
                    .order_by("-effective_at", "-id")
                    .first()
                )

                print(f"  Latest status: {latest_status}")
                if latest_status:
                    print(f"    Status code: {latest_status.status}")
                    print(f"    Is active: {latest_status.is_active}")

                if not latest_status or latest_status.status != Status.ACTIVE:
                    print(f"  Skipping: No active status or status != ACTIVE")
                    continue  # Skip non-active students

                current_class = latest_status.course_class
                if not current_class:
                    print(f"  Skipping: No course class")
                    continue  # Skip students without a class

                print(f"  Current class: {current_class.name}")

                # Deactivate current status
                latest_status.is_active = False
                latest_status.save(update_fields=["is_active"])

                # Create new status for next term (same class, same status)
                StudentStatus.all_objects.create(
                    student=student,
                    status=Status.ACTIVE,
                    course_class=current_class,  # Keep same class
                    effective_at=next_term.start_date,
                    is_active=True,
                    note=f"Moved to term {next_term.name} by term transition",
                    institute_id=institute_id,
                )

                students_moved += 1

            # Update transition record
            transition.transition_executed_at = timezone.now()
            transition.executed_by = user.username
            transition.students_moved_count = students_moved
            transition.save(
                update_fields=[
                    "transition_executed_at",
                    "executed_by",
                    "students_moved_count",
                    "updated_at",
                ]
            )

        return Response(
            {
                "success": True,
                "message": f"Successfully moved {students_moved} students to next term.",
                "students_moved": students_moved,
                "next_term": next_term.name,
                "executed_at": transition.transition_executed_at,
            },
            status=status.HTTP_200_OK,
        )
