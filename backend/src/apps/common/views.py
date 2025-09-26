from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated
from apps.common.permissions import HasInstitute


class ScopedModelViewSet(viewsets.ModelViewSet):
    """
    A reusable base for institute-scoped models.
    Enforces that all queries and creates are bound to request.user.institute_id.
    """

    permission_classes = [IsAuthenticated, HasInstitute]
    model = None  # must be set in subclasses

    def get_institute_id(self):
        return getattr(self.request.user, "institute_id", None)

    def get_queryset(self):
        iid = self.get_institute_id()
        qs = self.model.all_objects
        return qs.filter(institute_id=iid) if iid else qs.none()

    def perform_create(self, serializer):
        serializer.save(institute_id=self.get_institute_id())
