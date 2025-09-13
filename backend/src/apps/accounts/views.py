from rest_framework import viewsets, mixins, status
from rest_framework.response import Response
from rest_framework.decorators import action
from apps.common.permissions import IsSuperuser
from .serializers import AccountAdminCreateSerializer, AccountAdminListSerializer
from django.contrib.auth import get_user_model

User = get_user_model()


class AccountAdminViewSet(
    mixins.CreateModelMixin,
    mixins.ListModelMixin,
    mixins.RetrieveModelMixin,
    mixins.UpdateModelMixin,
    viewsets.GenericViewSet,
):
    """
    Superuser-only endpoints to create/list/update accounts and assign them to institutes.
    """

    permission_classes = [IsSuperuser]
    queryset = User.objects.all()

    def get_serializer_class(self):
        if self.action in ["create", "update", "partial_update"]:
            return AccountAdminCreateSerializer
        return AccountAdminListSerializer

    @action(detail=True, methods=["post"])
    def set_password(self, request, pk=None):
        user = self.get_object()
        pwd = request.data.get("password")
        if not pwd:
            return Response(
                {"detail": "password required"}, status=status.HTTP_400_BAD_REQUEST
            )
        user.set_password(pwd)
        user.save(update_fields=["password"])
        return Response({"detail": "password updated"})
