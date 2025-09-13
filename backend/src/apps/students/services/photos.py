# src/apps/students/services/photos.py
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage


def ensure_student_photo_or_default(student, institute_logo_key: str | None):
    """
    If no photo uploaded, copy institute logo to 'students/{spin}.jpg'.
    NOP if neither exists.
    """
    if student.photo:
        return

    if not institute_logo_key:
        return  # nothing to copy

    # read logo
    with default_storage.open(institute_logo_key, "rb") as src:
        data = src.read()

    dest_key = f"students/{student.spin}.jpg"
    default_storage.save(dest_key, ContentFile(data))
    student.photo.name = dest_key
    student.save(update_fields=["photo"])
