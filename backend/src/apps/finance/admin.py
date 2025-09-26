# apps/finance/admin.py
from django.contrib import admin
from .models import AccountType, FinanceAccount, FinanceLedgerEntry


@admin.register(AccountType)
class AccountTypeAdmin(admin.ModelAdmin):
    list_display = ("acc_category", "section", "code", "is_active")
    search_fields = ("acc_category", "code")
    list_filter = ("section", "is_active")


@admin.register(FinanceAccount)
class FinanceAccountAdmin(admin.ModelAdmin):
    list_display = ("name", "kind", "institute_id", "currency", "is_active")
    list_filter = ("kind", "is_active")
    search_fields = ("name",)


@admin.register(FinanceLedgerEntry)
class FinanceLedgerEntryAdmin(admin.ModelAdmin):
    list_display = (
        "date",
        "account",
        "amount",
        "category",
        "institute_id",
        "transfer_id",
    )
    list_filter = ("account__kind", "category__section")
    search_fields = ("counterparty", "comment")
    readonly_fields = ("created_at", "updated_at")
