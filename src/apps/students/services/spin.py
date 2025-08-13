import hashlib
from datetime import date


def generate_spin(institute_id: int, first: str, last: str, dob: date) -> str:
    base = f"{institute_id}:{first.strip().lower()}:{last.strip().lower()}:{dob.isoformat()}"
    return hashlib.sha1(base.encode("utf-8")).hexdigest()[:16]
