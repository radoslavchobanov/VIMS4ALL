# src/apps/students/services/spin.py
import hashlib


def _mod97(s: str) -> int:
    # ISO 7064 mod97-10 check: works on digits; we feed hex as digits by int base 16 then mod 97 on decimal str
    return int(s, 16) % 97


def generate_spin(institute_id: int, first: str, last: str, dob) -> str:
    base = f"{institute_id}:{first.strip().lower()}:{last.strip().lower()}:{dob.isoformat()}"
    core = hashlib.sha1(base.encode("utf-8")).hexdigest()[:14]  # 14 hex
    cd = _mod97(core)  # 0..96
    return f"{core}{cd:02d}"  # 16 chars total
