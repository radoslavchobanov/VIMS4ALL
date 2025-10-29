from rest_framework.decorators import action
from rest_framework.response import Response
from drf_spectacular.utils import extend_schema
from datetime import date
from apps.common.views import ScopedModelViewSet
from .models import AcademicTerm
from .serializers import (
    AcademicTermReadSerializer,
    AcademicTermWriteSerializer,
    NextNameResponseSerializer,
)
from .services import compute_next_term_name


class AcademicTermViewSet(ScopedModelViewSet):
    model = AcademicTerm

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return AcademicTermWriteSerializer
        return AcademicTermReadSerializer

    def get_queryset(self):
        return super().get_queryset().select_related("institute")

    @extend_schema(
        responses={200: NextNameResponseSerializer},
        summary="Preview the next auto-generated term name for the current institute",
    )
    @action(detail=False, methods=["get"], url_path="next-name")
    def next_name(self, request):
        iid = self.get_institute_id()
        year_param = request.query_params.get("year")
        year = int(year_param) if year_param else date.today().year
        name, ordinal = compute_next_term_name(institute_id=iid, year=year)
        return Response({"name": name, "year": year, "ordinal": ordinal})
