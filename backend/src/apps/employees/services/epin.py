import hashlib
from datetime import date


def generate_epin(institute_id: int, first_name: str, last_name: str, dob: date) -> str:
    base = f"{institute_id}:{first_name}:{last_name}:{dob.isoformat()}".lower().encode()
    return (
        f"E{institute_id}_{dob.strftime('%y%m%d')}_{hashlib.sha1(base).hexdigest()[:6]}"
    )
