from rest_framework.routers import DefaultRouter

from apps.students.views import (
    StudentViewSet,
    AcademicTermViewSet,
    StudentCustodianViewSet,
    StudentStatusViewSet,
)
from apps.employees.views import (
    EmployeeViewSet,
    EmployeeFunctionViewSet,
    EmployeeCareerViewSet,
    EmployeeDependentViewSet,
)
from apps.courses.views import (
    CourseViewSet,
    CourseClassViewSet,
    CourseInstructorViewSet,
)
from apps.finance.views import (
    AccountTypeViewSet,
    FinanceAccountViewSet,
    LedgerEntryViewSet,
)
from apps.institutes.views import InstituteAdminViewSet, InstituteViewSet
from apps.accounts.views import AccountAdminViewSet

router = DefaultRouter()


# ADMIN ENDPOINTS
router.register(r"admin/institutes", InstituteAdminViewSet, basename="admin-institutes")
router.register(r"admin/accounts", AccountAdminViewSet, basename="admin-accounts")

# INSTITUTE ENDPOINTS
router.register(r"institutes", InstituteViewSet, basename="institutes")


# STUDENT ENDPOINTS
router.register(r"students", StudentViewSet, basename="students")
router.register(r"academic-terms", AcademicTermViewSet, basename="academic-terms")
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

# COURSE ENDPOINTS
router.register(r"courses", CourseViewSet, basename="courses")
router.register(r"course-classes", CourseClassViewSet, basename="course-classes")
router.register(
    r"course-instructors", CourseInstructorViewSet, basename="course-instructors"
)

# FINANCE ENDPOINTS
router.register(
    r"finance/account-types", AccountTypeViewSet, basename="finance-account-types"
)
router.register(r"finance/accounts", FinanceAccountViewSet, basename="finance-accounts")
router.register(r"finance/ledger", LedgerEntryViewSet, basename="finance-ledger")

urlpatterns = router.urls
