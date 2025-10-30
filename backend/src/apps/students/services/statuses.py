from django.db import transaction
from django.utils import timezone
from django.core.exceptions import ValidationError
from apps.students.models import StudentStatus, Status


@transaction.atomic
def set_student_status(
    *,
    institute_id: int,
    student_id: int,
    course_class_id: int,
    new_status: str,
    note: str = "",
    effective_at=None,
) -> StudentStatus:
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
    if new_status not in StudentStatus.ALLOWED.get(prev_code, set()):
        raise ValidationError(f"Invalid transition {prev_code or '∅'} → {new_status}")

    # Deactivate any active row for this pair
    qs.filter(is_active=True).update(is_active=False)

    row = StudentStatus.objects.create(
        institute_id=institute_id,
        student_id=student_id,
        course_class_id=course_class_id,
        status=new_status,
        is_active=True,
        note=note or "",
        effective_at=effective_at or timezone.now(),
    )
    return row
