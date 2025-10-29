from datetime import date
from django.utils import timezone
from dataclasses import dataclass
from django.db import transaction
from django.db.models import F

from apps.common.models import PinCounter, PinKind
from apps.terms.services import pick_term_by_closeness


@dataclass(frozen=True)
class PinResult:
    pin: str
    year2: int
    term_no: int | None
    seq: int


def _year2(dt: date) -> int:
    return dt.year % 100


def _bump_and_get(
    institute_id: int, *, kind: str, year2: int, term_no: int | None
) -> int:
    with transaction.atomic():
        counter, _ = PinCounter.objects.select_for_update().get_or_create(
            institute_id=institute_id,
            kind=kind,
            year2=year2,
            term_no=term_no,
            defaults={"last_no": 0},
        )
        counter.last_no = F("last_no") + 1
        counter.save(update_fields=["last_no"])
        counter.refresh_from_db(fields=["last_no"])
        return int(counter.last_no)


def generate_employee_pin(
    *, institute_id: int, entry_date: date | None = None
) -> PinResult:
    d = entry_date or timezone.localdate()
    yy = _year2(d)
    seq = _bump_and_get(institute_id, kind=PinKind.EMPLOYEE, year2=yy, term_no=None)
    return PinResult(pin=f"E{yy:02d}{seq:03d}", year2=yy, term_no=None, seq=seq)


def generate_student_pin(
    *, institute_id: int, enquiry_date: date | None = None
) -> PinResult:
    d = enquiry_date or timezone.localdate()
    yy = _year2(d)
    sel = pick_term_by_closeness(institute_id, d)
    T = int(sel.term_no)  # parsed from "TYYYY_N"
    seq = _bump_and_get(institute_id, kind=PinKind.STUDENT, year2=yy, term_no=T)
    return PinResult(pin=f"S{yy:02d}{T}{seq:03d}", year2=yy, term_no=T, seq=seq)
