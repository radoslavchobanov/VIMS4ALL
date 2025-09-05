# src/vims/api_router.py
from rest_framework.routers import DefaultRouter

from apps.students.views import (
    StudentViewSet,
    TermViewSet,
    StudentCustodianViewSet,
    StudentStatusViewSet,
)
from apps.institutes.views import InstituteAdminViewSet
from apps.accounts.views import AccountAdminViewSet

router = DefaultRouter()

# institute-scoped endpoints (already had these in students)
router.register(r"students", StudentViewSet, basename="students")
router.register(r"terms", TermViewSet, basename="terms")
router.register(
    r"student-custodians", StudentCustodianViewSet, basename="student-custodians"
)
router.register(r"student-statuses", StudentStatusViewSet, basename="student-statuses")

# superuser-only admin endpoints
router.register(r"admin/institutes", InstituteAdminViewSet, basename="admin-institutes")
router.register(r"admin/accounts", AccountAdminViewSet, basename="admin-accounts")

urlpatterns = router.urls
