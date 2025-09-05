# src/apps/students/services/dedup.py
from typing import Iterable
from apps.students.models import Status, Student, StudentStatus

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


def has_potential_duplicate(iid: int, first: str, last: str, dob: str) -> bool:
    """
    A 'duplicate' means: student with same (first,last,dob) in this institute
    having at least one *active* status among statuses <= ACTIVE (enquire/accepted/no_show/active).
    """
    return Student.all_objects.filter(
        institute_id=iid,
        first_name__iexact=first.strip(),
        last_name__iexact=last.strip(),
        date_of_birth=dob,
        statuses__is_active=True,
        statuses__status__in=DUPLICATE_STATUSES,
    ).exists()
