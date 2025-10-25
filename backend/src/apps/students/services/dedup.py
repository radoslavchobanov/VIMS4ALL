from typing import Iterable
from apps.students.models import Status, Student, StudentStatus
from django.db.models import Q

# Define the “order” from the Access list to express "<= active"
STATUS_ORDER = {
    Status.ENQUIRE: 1,
    Status.ACCEPTED: 2,
    Status.NO_SHOW: 3,
    Status.ACTIVE: 4,
    Status.RETAKE: 5,
    Status.FAILED: 6,
    Status.GRADUATE: 7,
    Status.DROP_OUT: 8,
    Status.EXPELLED: 9,
    Status.NOT_ACCEPTED: 10,
}

# any status whose rank <= ACTIVE (4)
DUPLICATE_CUTOFF = STATUS_ORDER[Status.ACTIVE]
DUPLICATE_STATUSES: Iterable[str] = [
    s for s, rank in STATUS_ORDER.items() if rank <= DUPLICATE_CUTOFF
]


def _clean(s: str | None) -> str:
    return (s or "").strip()


ACTIVE_OR_PRIOR = {Status.ENQUIRE, Status.ACCEPTED, Status.ACTIVE}


def has_potential_duplicate(
    institute_id: int, first_name: str, last_name: str, date_of_birth
) -> bool:
    """
    Duplicate rule (spec): block creation if a student with the same
    (first_name, last_name, DOB) already exists in THIS institute
    AND has an active status in {enquire, accepted, active}.
    Also guard when first/last names are swapped.
    """
    fn = _clean(first_name)
    ln = _clean(last_name)

    # Candidate set by names (normal + swapped) + DOB in the same institute
    base = Student.all_objects.filter(
        institute_id=institute_id,
        date_of_birth=date_of_birth,
    ).filter(
        Q(first_name__iexact=fn, last_name__iexact=ln)
        | Q(first_name__iexact=ln, last_name__iexact=fn)  # swapped
    )

    if not base.exists():
        return False

    # Require current status in ACTIVE_OR_PRIOR
    return StudentStatus.all_objects.filter(
        student__in=base,
        is_active=True,
        status__in=ACTIVE_OR_PRIOR,
    ).exists()
