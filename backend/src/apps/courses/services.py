from django.db import transaction
from django.utils import timezone
from .models import Course, CourseClass


def _class_name(base: str, index: int) -> str:
    return f"{base.strip()}-{index}"


@transaction.atomic
def create_course_with_classes(
    *, institute, name: str, abbreviation: str | None, total_classes: int
) -> Course:
    course = Course.objects.create(
        institute=institute,
        name=name.strip(),
        abbreviation=(abbreviation or "").strip(),
        total_classes=total_classes,
    )
    bulk = [
        CourseClass(course=course, index=i, name=_class_name(course.name, i))
        for i in range(1, total_classes + 1)
    ]
    CourseClass.objects.bulk_create(bulk)
    return course


@transaction.atomic
def rename_course_and_sync_classes(
    *, course: Course, new_name: str, new_abbreviation: str | None = None
) -> Course:
    new_name = new_name.strip()
    course.name = new_name
    if new_abbreviation is not None:
        course.abbreviation = new_abbreviation.strip()
    course.save(update_fields=["name", "abbreviation", "updated_at"])
    # keep class names in sync
    classes = CourseClass.objects.select_for_update().filter(course=course)
    for c in classes:
        c.name = _class_name(new_name, c.index)
    CourseClass.objects.bulk_update(classes, ["name", "updated_at"])
    return course


@transaction.atomic
def adjust_total_classes(*, course: Course, new_total: int) -> None:
    """
    If increasing: append missing CourseClass rows.
    If decreasing: only allow trimming tail indices with no dependent enrollments (future-proof).
    """
    if new_total < 1:
        raise ValueError("total_classes must be >= 1")

    current = course.total_classes
    if new_total == current:
        return

    if new_total > current:
        bulk = [
            CourseClass(course=course, index=i, name=_class_name(course.name, i))
            for i in range(current + 1, new_total + 1)
        ]
        CourseClass.objects.bulk_create(bulk)
        course.total_classes = new_total
        course.save(update_fields=["total_classes", "updated_at"])
        return

    # shrinking: enforce safety (replace `has_dependencies` with your actual checks later)
    tail = CourseClass.objects.filter(course=course, index__gt=new_total).order_by(
        "-index"
    )

    # Example guard: you may check StudentCourseEnrollment or historical statuses before delete.
    for c in tail:
        # if has_dependencies(c): raise ValueError("Cannot reduce total_classes due to existing enrollments/history")
        pass

    tail.delete()
    course.total_classes = new_total
    course.save(update_fields=["total_classes", "updated_at"])


@transaction.atomic
def ensure_course_classes(course: Course) -> None:
    """
    Keep CourseClass rows in sync with Course:
    - Ensure indexes 1..total_classes exist (name = "{course.name}-{i}")
    - Rename labels when course.name changes
    - Remove rows where index > total_classes
    Idempotent and safe for concurrent calls.
    """
    total = int(course.total_classes or 0)
    if total < 1:
        # no classes to maintain; prune any leftovers just in case
        CourseClass.objects.filter(course=course).delete()
        return

    # Create/rename
    for i in range(1, total + 1):
        cc, created = CourseClass.objects.get_or_create(
            course=course,
            index=i,
            defaults={
                "name": f"{course.name}-{i}",
                "start_date": timezone.localdate(),
            },
        )
        expected = f"{course.name}-{i}"
        if not created and cc.name != expected:
            CourseClass.objects.filter(pk=cc.pk).update(name=expected)

    # Remove extras
    CourseClass.objects.filter(course=course, index__gt=total).delete()
