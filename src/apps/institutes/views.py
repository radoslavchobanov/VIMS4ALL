from rest_framework import viewsets
from apps.common.permissions import IsSuperuser
from .models import Institute
from .serializers import InstituteSerializer


class InstituteAdminViewSet(viewsets.ModelViewSet):
    """
    Superuser-only CRUD for Institutes.
    """

    queryset = Institute.objects.all()
    serializer_class = InstituteSerializer
    permission_classes = [IsSuperuser]
