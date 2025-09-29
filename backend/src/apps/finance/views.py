from decimal import Decimal, InvalidOperation
from drf_spectacular.utils import extend_schema
from django.db.models import Q, Sum, OuterRef, Subquery, Value, ProtectedError
from django.db.models.functions import Coalesce
from rest_framework import viewsets, status, filters
from rest_framework.decorators import action
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.response import Response
from django_filters.rest_framework import DjangoFilterBackend

from apps.common.permissions import (
    IsSuperuser,
    IsSuperuserOrInstituteAdminOfSameInstitute,
)
from apps.common.views import ScopedModelViewSet
from apps.finance.filters import LedgerEntryFilter
from .models import AccountType, FinanceAccount, FinanceLedgerEntry, AccountSection
from .serializers import (
    AccountTypeSerializer,
    FinanceAccountSerializer,
    LedgerEntryReadSerializer,
    LedgerEntryWriteSerializer,
    TransferRequestSerializer,
    TransferResponseSerializer,
)
from .services import LedgerService


# ---- Permissions composition helpers ----


class AllowReadOnlyOtherwiseSuperuser(BasePermission):
    """Anyone authenticated can read AccountType; only superuser can mutate."""

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return bool(request.user and request.user.is_authenticated)
        return IsSuperuser().has_permission(request, view)


# ---- ViewSets ----


class AccountTypeViewSet(viewsets.ModelViewSet):
    queryset = AccountType.objects.all().order_by("acc_category")
    serializer_class = AccountTypeSerializer
    permission_classes = [AllowReadOnlyOtherwiseSuperuser]

    def destroy(self, request, *args, **kwargs):
        try:
            return super().destroy(request, *args, **kwargs)
        except ProtectedError:
            return Response(
                {"detail": "Cannot delete: category is referenced by ledger entries."},
                status=status.HTTP_400_BAD_REQUEST,
            )


class FinanceAccountViewSet(ScopedModelViewSet):
    model = FinanceAccount
    serializer_class = FinanceAccountSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        sum_qs = (
            FinanceLedgerEntry.all_objects.filter(
                account_id=OuterRef("pk"), institute_id=OuterRef("institute_id")
            )
            .values("account_id")
            .annotate(b=Coalesce(Sum("amount"), Value(Decimal("0"))))
            .values("b")[:1]
        )
        return qs.annotate(balance=Coalesce(Subquery(sum_qs), Value(Decimal("0"))))


class LedgerEntryViewSet(ScopedModelViewSet):
    """
    Institute-scoped ledger (cashbook/bankbook).
    """

    model = FinanceLedgerEntry
    serializer_class = LedgerEntryReadSerializer  # default read

    filter_backends = [
        DjangoFilterBackend,
        filters.SearchFilter,
        filters.OrderingFilter,
    ]
    filterset_class = LedgerEntryFilter
    search_fields = ["counterparty", "comment"]
    ordering_fields = ["date", "amount", "id"]
    ordering = ["-date", "-id"]

    def get_queryset(self):
        qs = (
            super()
            .get_queryset()
            .select_related(
                "account",
                "category",
                "debit_finance_account",
                "credit_finance_account",
                "debit_category",
                "credit_category",
            )
        )
        return qs

    def get_serializer_class(self):
        if self.action in ("create", "update", "partial_update"):
            return LedgerEntryWriteSerializer
        return LedgerEntryReadSerializer

    def perform_create(self, serializer):
        serializer.save(
            institute_id=self.get_institute_id(),
            created_by_id=str(getattr(self.request.user, "id", "")),
        )

    @action(detail=False, methods=["get"], url_path="categories-for-amount")
    def categories_for_amount(self, request):
        """
        GET ?amount=<decimal>
        Positive -> REVENUE + LFB
        Negative -> EXPENSE + LFB
        """
        raw = request.query_params.get("amount")
        try:
            amount = Decimal(raw)
        except (TypeError, InvalidOperation):
            return Response(
                {"detail": "amount query param required (Decimal)."}, status=400
            )

        if amount == 0:
            return Response({"detail": "amount cannot be zero"}, status=400)

        base = AccountType.objects.filter(is_active=True)
        if amount > 0:
            qs = base.filter(
                Q(section=AccountSection.REVENUE)
                | Q(section=AccountSection.LIQUID_FUNDS_BANKS)
            )
        else:
            qs = base.filter(
                Q(section=AccountSection.EXPENSE)
                | Q(section=AccountSection.LIQUID_FUNDS_BANKS)
            )

        return Response(
            AccountTypeSerializer(qs.order_by("acc_category"), many=True).data
        )

    @extend_schema(
        request=TransferRequestSerializer, responses={201: TransferResponseSerializer}
    )
    @action(detail=False, methods=["post"], url_path="transfer")
    def transfer(self, request):
        ser = TransferRequestSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)

        iid = self.get_institute_id()
        data = ser.validated_data

        out_entry, in_entry = LedgerService.transfer_between_accounts(
            institute_id=iid,
            from_account_id=data["from_account"],
            to_account_id=data["to_account"],
            date=data["date"],
            amount_positive=data["amount"],
            comment=data.get("comment") or "",
            created_by_id=str(getattr(request.user, "id", "")),
            counterparty=data.get("counterparty") or "Internal transfer",
        )

        return Response(
            {"out_entry": out_entry.pk, "in_entry": in_entry.pk},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="balance")
    def balance(self, request):
        iid = self.get_institute_id()
        rows = (
            FinanceLedgerEntry.all_objects.filter(institute_id=iid)
            .values("account__id", "account__name")
            .annotate(balance=Sum("amount"))
            .order_by("account__name")
        )
        return Response(list(rows))
