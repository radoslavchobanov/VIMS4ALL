# src/apps/students/urls.py
from rest_framework.routers import DefaultRouter
from .views import (
    StudentViewSet,
    TermViewSet,
    StudentCustodianViewSet,
    StudentStatusViewSet,
)

router = DefaultRouter()
router.register("students", StudentViewSet, basename="student")
router.register("terms", TermViewSet, basename="term")
router.register(
    "student-custodians", StudentCustodianViewSet, basename="student-custodian"
)
router.register("student-statuses", StudentStatusViewSet, basename="student-status")

urlpatterns = router.urls
