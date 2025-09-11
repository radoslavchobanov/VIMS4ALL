from __future__ import annotations
from datetime import date
from typing import Optional
from django.db.models import Q
from apps.students.models import AcademicTerm


def get_nearest_term(
    institute_id: int, ref_date: Optional[date] = None
) -> Optional[AcademicTerm]:
    """
    Returns the term closest to ref_date for the given institute.
    Preference order:
      a) term containing ref_date (start <= ref_date <= end)
      b) latest past term (start <= ref_date) if no current term
      c) earliest future term (start > ref_date) as last fallback
    """
    ref_date = ref_date or date.today()

    qs = AcademicTerm.all_objects.filter(institute_id=institute_id)

    # a) term covering ref_date
    current = (
        qs.filter(start_date__lte=ref_date, end_date__gte=ref_date)
        .order_by("-start_date")
        .first()
    )
    if current:
        return current

    # b) nearest past
    past = qs.filter(start_date__lte=ref_date).order_by("-start_date").first()
    if past:
        return past

    # c) earliest future
    future = qs.filter(start_date__gt=ref_date).order_by("start_date").first()
    return future
