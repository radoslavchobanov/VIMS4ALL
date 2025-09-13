from django.contrib.auth import get_user_model
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated

User = get_user_model()


class MeView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        u = request.user
        # roles via groups; add 'superuser' convenience role
        group_names = list(u.groups.values_list("name", flat=True))
        roles = group_names.copy()
        if u.is_superuser and "superuser" not in roles:
            roles.append("superuser")

        # if your custom User has institute FK/field, expose its id
        institute_id = getattr(u, "institute_id", None)
        # or if FK: getattr(u, "institute_id", None) already gives the raw id

        data = {
            "id": str(u.pk),
            "username": u.get_username(),
            "email": getattr(u, "email", "") or "",
            "roles": roles,
            "institute_id": institute_id,
        }
        return Response(data, status=200)
