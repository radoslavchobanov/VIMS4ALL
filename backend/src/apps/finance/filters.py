from django_filters import rest_framework as filters
from .models import FinanceLedgerEntry, FinanceAccount, AccountType


class LedgerEntryFilter(filters.FilterSet):
    # We override the queryset at runtime (per-request) in __init__
    account = filters.ModelChoiceFilter(
        field_name="account",
        queryset=FinanceAccount.all_objects.none(),
    )
    category = filters.ModelChoiceFilter(
        field_name="category",
        queryset=AccountType.objects.filter(is_active=True),
    )
    date = filters.DateFilter(field_name="date")  # exact date; add range if needed

    class Meta:
        model = FinanceLedgerEntry
        fields = ["account", "category", "date"]

    def __init__(self, data=None, queryset=None, *, request=None, prefix=None):
        super().__init__(data=data, queryset=queryset, request=request, prefix=prefix)
        iid = getattr(getattr(request, "user", None), "institute_id", None)
        if iid:
            self.filters["account"].queryset = FinanceAccount.all_objects.filter(
                institute_id=iid, is_active=True
            )
        else:
            # no institute -> no accounts (defensive)
            self.filters["account"].queryset = FinanceAccount.all_objects.none()
