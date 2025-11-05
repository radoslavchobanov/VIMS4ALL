# apps/students/services/statuses.py
from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.students.models import StudentStatus, Status, Student
from apps.courses.models import CourseClass


def _apply_formal_dates(student: Student, cc: CourseClass, new_status: str) -> None:
    """
    Mutate student's formal start/end dates per client rules.
    """
    if new_status == Status.ENQUIRE:
        student.entry_date = cc.start_date
        # do not touch exit_date here
    elif new_status == Status.NOT_ACCEPTED:
        student.exit_date = cc.start_date
    elif new_status == Status.NO_SHOW:
        student.exit_date = cc.start_date
    elif new_status in {
        Status.DROP_OUT,
        Status.GRADUATE,
        Status.EXPELLED,
        Status.FAILED,
    }:
        student.exit_date = cc.end_date
    elif new_status == Status.RETAKE:
        # leave exit_date open
        student.exit_date = None
    elif new_status == Status.ACTIVE:
        # becoming active (incl. second life): ensure open enrollment window
        student.entry_date = student.entry_date or cc.start_date
        student.exit_date = None
    # else: nothing to do


@transaction.atomic
def set_student_status(
    *,
    institute_id: int,
    student_id: int,
    course_class_id: int,
    new_status: str,
    note: str = "",
    effective_at=None,
    allow_second_life: bool = True,  # explicit toggle (kept True; service enforces cross-class)
) -> StudentStatus:
    # Lock rows in THIS class context
    qs = (
        StudentStatus.objects.select_for_update()
        .filter(
            institute_id=institute_id,
            student_id=student_id,
            course_class_id=course_class_id,
        )
        .order_by("-is_active", "-effective_at", "-id")
    )
    prev = qs.first()
    prev_code = prev.status if prev else None

    # Validate transition (per-class)
    if new_status not in StudentStatus.ALLOWED.get(prev_code, set()):
        raise ValidationError(f"Invalid transition {prev_code or '∅'} → {new_status}")

    # Disallow terminal→active IN-PLACE; require second life in ANOTHER class
    if prev_code in StudentStatus.TERMINAL and new_status == Status.ACTIVE:
        raise ValidationError(
            "Use second life by creating an ACTIVE status in a different course class."
        )

    # Deactivate any active row for this pair
    qs.filter(is_active=True).update(is_active=False)

    # Create the new status row
    row = StudentStatus.objects.create(
        institute_id=institute_id,
        student_id=student_id,
        course_class_id=course_class_id,
        status=new_status,
        is_active=True,
        note=note or "",
        effective_at=effective_at or timezone.now(),
    )

    # Apply formal dates on Student (master record)
    student = Student.objects.select_for_update().get(
        pk=student_id, institute_id=institute_id
    )
    cc = CourseClass.objects.get(pk=course_class_id)
    _apply_formal_dates(student, cc, new_status)
    student.save(update_fields=["entry_date", "exit_date"])

    return row


@transaction.atomic
def second_life_activate(
    *,
    institute_id: int,
    student_id: int,
    new_course_class_id: int,
    note: str = "",
    effective_at=None,
) -> StudentStatus:
    """
    Grant a student with a terminal state a 'second life' by activating them in another class.
    """
    # sanity: ensure last overall status (any class) is terminal
    last_any = (
        StudentStatus.objects.select_for_update()
        .filter(institute_id=institute_id, student_id=student_id)
        .order_by("-effective_at", "-id")
        .first()
    )
    if not last_any or last_any.status not in StudentStatus.TERMINAL:
        raise ValidationError("Second life is only available after a terminal state.")

    # And ensure it's a different class
    if last_any.course_class_id == new_course_class_id:
        raise ValidationError(
            "Second life must enroll the student into a different course class."
        )

    # Deactivate any active in the new class (defensive)
    StudentStatus.objects.filter(
        institute_id=institute_id,
        student_id=student_id,
        course_class_id=new_course_class_id,
        is_active=True,
    ).update(is_active=False)

    row = StudentStatus.objects.create(
        institute_id=institute_id,
        student_id=student_id,
        course_class_id=new_course_class_id,
        status=Status.ACTIVE,
        is_active=True,
        note=note or "Second life activation",
        effective_at=effective_at or timezone.now(),
    )

    # Update formal dates: entry = new class start, exit reset to NULL
    student = Student.objects.select_for_update().get(
        pk=student_id, institute_id=institute_id
    )
    cc = CourseClass.objects.get(pk=new_course_class_id)
    _apply_formal_dates(student, cc, Status.ACTIVE)
    student.save(update_fields=["entry_date", "exit_date"])

    return row
