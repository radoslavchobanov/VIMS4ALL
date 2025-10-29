from __future__ import annotations
import re
from datetime import date
from django.db import connection, transaction
from django.db.models import Q
from .models import AcademicTerm

_PREFIX_RE = re.compile(r"^T(\d{4})_(\d+)$")


def _advisory_lock_key(institute_id: int, year: int) -> int:
    # Simple 64-bit hash for (iid, year); keep deterministic and low collision.
    return (institute_id & 0xFFFFFFFF) << 32 | (year & 0xFFFFFFFF)


def compute_next_term_name(
    *, institute_id: int, year: int | None = None
) -> tuple[str, int]:
    """
    Pure computation (no write). Scans existing names with prefix TYYYY_ and returns next ordinal.
    """
    yr = year or date.today().year
    prefix = f"T{yr}_"
    names = list(
        AcademicTerm.objects.filter(
            institute_id=institute_id, name__startswith=prefix
        ).values_list("name", flat=True)
    )
    max_ord = 0
    for n in names:
        m = _PREFIX_RE.match(n)
        if m and int(m.group(1)) == yr:
            try:
                max_ord = max(max_ord, int(m.group(2)))
            except ValueError:
                pass
    return f"{prefix}{max_ord + 1}", max_ord + 1


@transaction.atomic
def create_term_with_auto_name(
    *, institute_id: int, start_date, end_date, year: int | None = None
) -> AcademicTerm:
    """
    Concurrency-safe creation using a PG advisory lock per (institute,year).
    - Name format: T{year}_{ordinal}
    - Year default: current calendar year.
    """
    yr = year or date.today().year
    lock_key = _advisory_lock_key(institute_id, yr)
    with connection.cursor() as cur:
        cur.execute("SELECT pg_advisory_xact_lock(%s);", [lock_key])

    # Recompute under lock and create.
    name, _ = compute_next_term_name(institute_id=institute_id, year=yr)
    term = AcademicTerm.objects.create(
        institute_id=institute_id, name=name, start_date=start_date, end_date=end_date
    )
    return term


def get_nearest_term(
    institute_id: int, as_of: date | None = None
) -> AcademicTerm | None:
    """
    Returns the term covering 'as_of' (default today). If none:
      - next upcoming (min by start_date >= as_of),
      - else the most recent past (max by end_date < as_of),
      - else None if no terms exist.
    """
    d = as_of or date.today()
    qs = AcademicTerm.objects.filter(institute_id=institute_id)
    current = (
        qs.filter(start_date__lte=d, end_date__gte=d).order_by("-start_date").first()
    )
    if current:
        return current
    upcoming = qs.filter(start_date__gt=d).order_by("start_date").first()
    if upcoming:
        return upcoming
    return qs.order_by("-end_date").first()
