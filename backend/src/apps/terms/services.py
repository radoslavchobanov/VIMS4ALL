from __future__ import annotations
import re
from dataclasses import dataclass
from django.utils import timezone
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
    yr = year or date.today().year
    lock_key = _advisory_lock_key(institute_id, yr)
    with connection.cursor() as cur:
        cur.execute("SELECT pg_advisory_xact_lock(%s);", [lock_key])

    # Recompute under lock and validate before persisting
    name, _ = compute_next_term_name(institute_id=institute_id, year=yr)

    term = AcademicTerm(
        institute_id=institute_id,
        name=name,
        start_date=start_date,
        end_date=end_date,
    )
    # <-- triggers your clean() which checks overlaps and date order
    term.full_clean()
    term.save()  # persist only after successful validation
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


@dataclass(frozen=True)
class TermSelection:
    chosen: AcademicTerm
    current: AcademicTerm | None
    next_: AcademicTerm | None
    term_no: int  # <-- expose the parsed number


def pick_term_by_closeness(
    institute_id: int, enquiry_date: date | None = None
) -> TermSelection:
    d = enquiry_date or timezone.localdate()

    qs = AcademicTerm.objects.filter(institute_id=institute_id).order_by("start_date")
    current = qs.filter(start_date__lte=d).last()
    next_ = qs.filter(start_date__gt=d).first()

    if current and next_:
        diff_curr = abs((d - current.start_date).days)
        diff_next = abs((next_.start_date - d).days)
        chosen = next_ if diff_next <= diff_curr else current
    elif next_:
        chosen = next_
    elif current:
        chosen = current
    else:
        raise ValueError("No academic terms defined for this institute.")

    parsed = parse_term_name(chosen.name)  # e.g. "T2025_2" -> num=2
    return TermSelection(
        chosen=chosen, current=current, next_=next_, term_no=parsed.num
    )


TERM_PATTERNS = [
    re.compile(r"^T(?P<year>\d{4})_(?P<num>\d+)$", re.IGNORECASE),
    re.compile(r"^T(?P<year>\d{2})_(?P<num>\d+)$", re.IGNORECASE),
]


@dataclass(frozen=True)
class ParsedTermName:
    year: int
    num: int


def parse_term_name(name: str) -> ParsedTermName:
    if not name:
        raise ValueError("Term name is empty.")
    for pat in TERM_PATTERNS:
        m = pat.match(name.strip())
        if m:
            year = int(m.group("year"))
            # normalize 2-digit years to 2000..2099 (tweak if you support other centuries)
            if year < 100:
                year += 2000
            num = int(m.group("num"))
            if num < 1:
                raise ValueError(f"Invalid term number in '{name}'.")
            return ParsedTermName(year=year, num=num)
    raise ValueError(f"Term name '{name}' does not match TYYYY_N.")


def fallback_term_num_by_order(term, qs_for_year):
    ordered = list(qs_for_year.order_by("start_date").values_list("id", flat=True))
    try:
        return ordered.index(term.id) + 1  # 1-based
    except ValueError:
        raise ValueError("Chosen term not found in same-year queryset.")
