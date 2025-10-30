from django.db import transaction
from django.utils import timezone
from django.contrib.auth.models import Group

from apps.employees.models import Employee, EmployeeCareer, EmployeeFunction
from apps.accounts.models import User
from apps.common.generate_pin import generate_employee_pin


@transaction.atomic
def provision_institute_admin_employee(user: User) -> Employee:
    """
    Ensure an Employee exists for this institute admin user, link the system_user,
    and ensure an open 'Managing Director' assignment.

    Idempotent:
      - Reuses existing Employee (prefers one already linked to this user).
      - Attaches system_user if missing; refuses if attached to a different user.
      - If an open career row exists with a different function, it is closed and a new
        'Managing Director' row is opened.
    """
    if not user.institute_id:
        raise ValueError(
            "User must be assigned to an institute before provisioning employee."
        )

    today = timezone.now().date()
    first = (user.first_name or user.username).strip()
    last = (user.last_name or "-").strip()

    # 1) Prefer employee already linked to this user in this institute
    emp = Employee.all_objects.filter(
        institute_id=user.institute_id, system_user_id=user.id
    ).first()

    # 2) Otherwise try to reuse by (first_name, last_name) in this institute
    if not emp:
        emp = (
            Employee.all_objects.filter(
                institute_id=user.institute_id,
                first_name=first,
                last_name=last,
            )
            .order_by("id")
            .first()
        )

    # 3) Create if still missing
    if not emp:
        epin = generate_employee_pin(institute_id=user.institute_id)
        print(epin)
        emp = Employee.all_objects.create(
            institute_id=user.institute_id,
            epin=epin.pin,
            first_name=first,
            last_name=last,
            email=user.email,
            entry_date=today,
            system_user=user,  # <-- link system account on create
        )
    else:
        # Link system_user if not linked yet; guard against a different link
        if emp.system_user_id and emp.system_user_id != user.id:
            raise ValueError("Employee already linked to a different system account.")
        if not emp.system_user_id:
            emp.system_user = user
            if not emp.entry_date:
                emp.entry_date = today
            emp.save(update_fields=["system_user", "entry_date"])

    # 4) Resolve the global 'Managing Director' function
    director_fn = (
        EmployeeFunction.objects.filter(institute__isnull=True, code="director").first()
        or EmployeeFunction.objects.filter(
            institute__isnull=True, name="Managing Director"
        ).first()
    )

    # 5) Ensure single open career row and that it is 'Managing Director'
    open_row = (
        EmployeeCareer.all_objects.filter(institute_id=user.institute_id, employee=emp)
        .select_related("function")
        .first()
    )

    if not open_row:
        EmployeeCareer.all_objects.create(
            institute_id=user.institute_id,
            employee=emp,
            function=director_fn,
            start_date=today,
        )
    elif open_row.function_id != director_fn.id:
        # Close the existing open row and open a Director row
        EmployeeCareer.all_objects.create(
            institute_id=user.institute_id,
            employee=emp,
            function=director_fn,
            start_date=today,
        )

    return emp


@transaction.atomic
def assign_default_role(user: User, *, is_institute_admin: bool = False) -> None:
    """
    Business rule:
      - If is_institute_admin -> add 'institute_admin' (and remove 'employee' if you want them disjoint).
      - Else -> add 'employee'.
    Idempotent; safe to call multiple times.
    """
    employee = Group.objects.get(name="employee")
    admin = Group.objects.get(name="institute_admin")

    if is_institute_admin:
        user.groups.add(admin)
        # Choose one of the two policies (I recommend disjoint roles):
        # (A) Disjoint:
        user.groups.remove(employee)
        # (B) Hierarchical (admin also has employee permissions):
        # user.groups.add(employee)
    else:
        # Not admin => ensure employee
        user.groups.add(employee)
        # Ensure not accidentally in admin (if you want strict disjointness):
        # user.groups.remove(admin)
