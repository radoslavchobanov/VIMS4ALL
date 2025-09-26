from decimal import Decimal
from django.core.exceptions import ValidationError
from django.db import models
from django.db.models import Q
from apps.common.models import InstituteScopedModel, TimeStampedModel


class AccountSection(models.TextChoices):
    REVENUE = "REVENUE", "Revenue"
    EXPENSE = "EXPENSE", "Expense"
    LIQUID_FUNDS_BANKS = "LFB", "Liquid funds - Banks"  # keep label short, code stable


class FinanceAccountKind(models.TextChoices):
    CASHBOX = "CASHBOX", "Cashbox"
    BANK = "BANK", "Bank"


class AccountType(models.Model):
    code = models.SlugField(unique=True, db_index=True)
    acc_category = models.CharField(max_length=128, unique=True)
    section = models.CharField(max_length=16, choices=AccountSection.choices)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ["acc_category"]

    def __str__(self):
        return f"{self.acc_category} [{self.section}]"


class FinanceAccount(InstituteScopedModel):
    kind = models.CharField(max_length=16, choices=FinanceAccountKind.choices)
    name = models.CharField(max_length=128)
    currency = models.CharField(max_length=3, default="UGX")
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [("institute", "name")]
        indexes = [models.Index(fields=["institute", "kind"])]

    def __str__(self):
        return f"{self.name} ({self.kind})"


class FinanceLedgerEntry(InstituteScopedModel):
    account = models.ForeignKey(
        FinanceAccount, on_delete=models.PROTECT, related_name="entries"
    )
    date = models.DateField()
    counterparty = models.CharField(max_length=256, blank=True)
    comment = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=14, decimal_places=2)
    category = models.ForeignKey(AccountType, on_delete=models.PROTECT)
    transfer_id = models.UUIDField(null=True, blank=True, db_index=True)

    # Nnormalized debit/credit “targets”
    debit_finance_account = models.ForeignKey(
        FinanceAccount,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="debit_entries",
    )
    debit_category = models.ForeignKey(
        AccountType,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="debit_entries",
    )
    credit_finance_account = models.ForeignKey(
        FinanceAccount,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="credit_entries",
    )
    credit_category = models.ForeignKey(
        AccountType,
        null=True,
        blank=True,
        on_delete=models.PROTECT,
        related_name="credit_entries",
    )

    created_by_id = models.CharField(max_length=64)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = "finance_ledger_entry"
        ordering = ["-date", "-id"]
        indexes = [
            models.Index(fields=["institute", "date"]),
            models.Index(fields=["institute", "account", "date"]),
            models.Index(fields=["transfer_id"]),
        ]

    def clean(self):
        from django.core.exceptions import ValidationError

        if self.amount == 0:
            raise ValidationError({"amount": "Amount cannot be zero."})

        # Sign ↔ category section rule
        if self.amount > 0 and self.category.section not in {"REVENUE", "LFB"}:
            raise ValidationError(
                {"category": "Positive amount requires Revenue or Liquid Funds (LFB)."}
            )
        if self.amount < 0 and self.category.section not in {"EXPENSE", "LFB"}:
            raise ValidationError(
                {"category": "Negative amount requires Expense or Liquid Funds (LFB)."}
            )

        # Auto-populate debit/credit sides based on sign
        if self.amount > 0:
            # Incoming: Debit bank/cash; Credit category
            self.debit_finance_account = self.account
            self.debit_category = None
            self.credit_finance_account = None
            self.credit_category = self.category
        else:
            # Outgoing: Debit category; Credit bank/cash
            self.debit_finance_account = None
            self.debit_category = self.category
            self.credit_finance_account = self.account
            self.credit_category = None

        # Enforce exactly one target per side
        if bool(self.debit_finance_account) == bool(self.debit_category):
            raise ValidationError(
                "Exactly one of (debit_finance_account, debit_category) must be set."
            )
        if bool(self.credit_finance_account) == bool(self.credit_category):
            raise ValidationError(
                "Exactly one of (credit_finance_account, credit_category) must be set."
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        return super().save(*args, **kwargs)
