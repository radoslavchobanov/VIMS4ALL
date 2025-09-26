from drf_spectacular.utils import extend_schema
from django.db.models import Q, Sum
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import SAFE_METHODS, BasePermission
from rest_framework.response import Response

from apps.common.permissions import (
    IsSuperuser,
    IsSuperuserOrInstituteAdminOfSameInstitute,
)
from apps.common.views import ScopedModelViewSet
from .models import AccountType, FinanceAccount, FinanceLedgerEntry, AccountSection
from .serializers import (
    AccountTypeSerializer,
    FinanceAccountSerializer,
    LedgerEntrySerializer,
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


class FinanceAccountViewSet(ScopedModelViewSet):
    model = FinanceAccount
    serializer_class = FinanceAccountSerializer


class LedgerEntryViewSet(ScopedModelViewSet):
    """
    Institute-scoped ledger (cashbook/bankbook).
    Scoping & institute_id injection are handled by ScopedModelViewSet.
    """

    model = FinanceLedgerEntry
    serializer_class = LedgerEntrySerializer
    filterset_fields = ["account", "category", "date"]
    search_fields = ["counterparty", "comment"]
    ordering_fields = ["date", "amount", "id"]
    ordering = ["-date", "-id"]

    def perform_create(self, serializer):
        # Base class will add institute_id; we add created_by_id
        serializer.save(
            institute_id=self.get_institute_id(),
            created_by_id=str(getattr(self.request.user, "id", "")),
        )

    @action(detail=False, methods=["get"], url_path="categories-for-amount")
    def categories_for_amount(self, request):
        """
        GET ?amount=123.45
        Positive -> REVENUE + LFB
        Negative -> EXPENSE + LFB
        """
        try:
            amount = float(request.query_params.get("amount"))
        except (TypeError, ValueError):
            return Response({"detail": "amount query param required"}, status=400)

        base = AccountType.objects.filter(is_active=True)
        if amount > 0:
            qs = base.filter(
                Q(section=AccountSection.REVENUE)
                | Q(section=AccountSection.LIQUID_FUNDS_BANKS)
            )
        elif amount < 0:
            qs = base.filter(
                Q(section=AccountSection.EXPENSE)
                | Q(section=AccountSection.LIQUID_FUNDS_BANKS)
            )
        else:
            return Response({"detail": "amount cannot be zero"}, status=400)

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

        # compact response (PKs); swap to full serializers if you prefer
        return Response(
            {"out_entry": out_entry.pk, "in_entry": in_entry.pk},
            status=status.HTTP_201_CREATED,
        )

    @action(detail=False, methods=["get"], url_path="balance")
    def balance(self, request):
        # Use the escape-hatch manager + explicit iid to avoid double scoping
        iid = self.get_institute_id()
        rows = (
            FinanceLedgerEntry.all_objects.filter(institute_id=iid)
            .values("account__id", "account__name")
            .annotate(balance=Sum("amount"))
            .order_by("account__name")
        )
        return Response(list(rows))
