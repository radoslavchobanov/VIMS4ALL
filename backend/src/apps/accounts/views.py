from rest_framework import viewsets, mixins, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.decorators import action
from apps.common.permissions import IsSuperuser
from .serializers import (
    AccountAdminCreateSerializer,
    AccountAdminListSerializer,
    SetOwnPasswordSerializer,
)
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


class SetOwnPasswordView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    @action(
        detail=False,
        methods=["post"],
        url_path="set-password",
        url_name="set-own-password",
    )
    def set_password(self, request):
        s = SetOwnPasswordSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        user = request.user
        user.set_password(s.validated_data["new_password"])
        user.must_change_password = False
        user.save(update_fields=["password", "must_change_password"])
        return Response(
            {"detail": "Password updated.", "must_change_password": False},
            status=status.HTTP_200_OK,
        )
