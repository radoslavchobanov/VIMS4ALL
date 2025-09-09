from rest_framework.routers import DefaultRouter

from apps.students.views import (
    StudentViewSet,
    TermViewSet,
    StudentCustodianViewSet,
    StudentStatusViewSet,
)
from apps.employees.views import (
    EmployeeViewSet,
    EmployeeFunctionViewSet,
    EmployeeCareerViewSet,
    EmployeeDependentViewSet,
)
from apps.institutes.views import InstituteAdminViewSet
from apps.accounts.views import AccountAdminViewSet

router = DefaultRouter()


# ADMIN ENDPPOINTS
router.register(r"admin/institutes", InstituteAdminViewSet, basename="admin-institutes")
router.register(r"admin/accounts", AccountAdminViewSet, basename="admin-accounts")

# STUDENT ENDPOINTS
router.register(r"students", StudentViewSet, basename="students")
router.register(r"terms", TermViewSet, basename="terms")
router.register(
    r"student-custodians", StudentCustodianViewSet, basename="student-custodians"
)
router.register(r"student-statuses", StudentStatusViewSet, basename="student-statuses")

# EMPLOYEE ENDPOINTS
router.register(r"employees", EmployeeViewSet, basename="employees")
router.register(
    r"employee-functions", EmployeeFunctionViewSet, basename="employee-functions"
)
router.register(r"employee-careers", EmployeeCareerViewSet, basename="employee-careers")
router.register(
    r"employee-dependents", EmployeeDependentViewSet, basename="employee-dependents"
)

urlpatterns = router.urls
