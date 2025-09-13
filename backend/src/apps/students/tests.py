# src/apps/students/tests.py (sketch)
import io
from django.urls import reverse
from rest_framework.test import APIClient
from django.core.files.uploadedfile import SimpleUploadedFile
from django.contrib.auth import get_user_model
from apps.institutes.models import Institute
from .models import Student, StudentStatus, Term


def test_student_create_without_photo_uses_institute_logo(db, settings):
    # setup: institute with logo in storage
    # create user, issue JWT, POST students/ -> assert photo key == f"students/{spin}.jpg"
    ...


def test_dedup_endpoint(db, api_client_with_jwt):
    # create student; call /api/students/dedup?first_name=... -> duplicate True
    ...


def test_status_transitions(db, api_client_with_jwt):
    # create student; create ENROLLED; then SUSPENDED ok; then ENROLLED ok; then GRADUATED ok; try ENROLLED -> 400
    ...
