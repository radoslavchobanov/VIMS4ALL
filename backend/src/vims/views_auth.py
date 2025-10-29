from datetime import datetime
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group, AnonymousUser
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

from apps.institutes.models import Institute
from apps.employees.models import Employee, EmployeeCareer
from apps.common.media import public_media_url
from apps.terms.models import AcademicTerm

User = get_user_model()


def _roles_for(user):
    roles = list(Group.objects.filter(user=user).values_list("name", flat=True))
    if getattr(user, "is_superuser", False) and "superuser" not in roles:
        roles.append("superuser")
    return sorted(set(roles))


def _abs_from_key(request, storage_key: str | None) -> str | None:
    """public_media_url(key) -> absolute URL (build absolute if helper returns relative)."""
    if not storage_key:
        return None
    url = public_media_url(storage_key)
    if not url:
        return None
    return url if url.startswith("http") else request.build_absolute_uri(url)


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        assert u and not isinstance(u, AnonymousUser)

        # ---- Institute by claim on the user
        inst_payload = None
        iid = getattr(u, "institute_id", None)
        if iid:
            inst = (
                Institute.objects.filter(pk=iid)
                .only(
                    "id",
                    "name",
                    "short_name",
                    "district",
                    "county",
                    "sub_county",
                    "parish",
                    "cell_village",
                    "email",
                    "logo_key",
                )
                .first()
            )

            # ---- Active academic term for institute
            active_term_payload = None
            today = datetime.today()
            active_term = (
                AcademicTerm.objects.filter(
                    institute_id=iid,
                    start_date__lte=today,
                    end_date__gte=today,
                )
                .only("id", "name", "start_date", "end_date")
                .first()
            )
            if active_term:
                active_term_payload = {
                    "id": str(active_term.id),
                    "name": active_term.name,
                    "start_date": active_term.start_date,
                    "end_date": active_term.end_date,
                }

            if inst:
                inst_payload = {
                    "id": str(inst.id),
                    "name": inst.name,
                    "abbr_name": inst.short_name,
                    "logo_url": _abs_from_key(request, inst.logo_key),
                    "active_term": active_term_payload,
                }

        # ---- Employee by system_user (OneToOne)
        emp_payload = None
        emp = (
            Employee.all_objects.select_related("institute")
            .filter(system_user_id=u.id, institute_id=iid)  # ensure tenant safety
            .only("id", "first_name", "last_name", "system_user_id", "institute_id")
            .first()
        )

        func_payload = None
        if emp:
            # Current (open) career row -> function
            cur = (
                EmployeeCareer.all_objects.select_related("function")
                .filter(employee_id=emp.id, end_date__isnull=True)
                .only("function_id", "employee_id")
                .first()
            )
            if cur and hasattr(cur, "function") and cur.function:
                func_payload = {
                    "id": str(cur.function.id),
                    "name": cur.function.name,
                    "code": getattr(cur.function, "code", None),
                }

            emp_payload = {
                "id": str(emp.id),
                "epin": emp.epin,
                "first_name": emp.first_name,
                "last_name": emp.last_name,
                "function": func_payload,
                "photo_url": _abs_from_key(request, emp.photo.name),
            }

        data = {
            "id": str(u.pk),
            "username": u.get_username(),
            "email": getattr(u, "email", "") or "",
            "roles": _roles_for(u),
            # convenience IDs for FE gating
            "institute_id": inst_payload["id"] if inst_payload else None,
            "employee_id": emp_payload["id"] if emp_payload else None,
            # nested cards for the Home page
            "institute": inst_payload,
            "employee": emp_payload,
        }
        return Response(data, status=200)
