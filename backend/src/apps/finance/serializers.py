from decimal import Decimal
from rest_framework import serializers
from .models import AccountType, FinanceAccount, FinanceLedgerEntry


class AccountTypeSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountType
        fields = ["id", "code", "acc_category", "section", "is_active"]


class FinanceAccountSerializer(serializers.ModelSerializer):
    balance = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = FinanceAccount
        read_only_fields = ["id", "institute_id", "balance"]
        fields = [
            "id",
            "institute_id",
            "kind",
            "name",
            "currency",
            "is_active",
            "balance",
        ]


class FinanceAccountLiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = FinanceAccount
        fields = ["id", "name", "kind", "currency"]


class AccountTypeLiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = AccountType
        fields = ["id", "code", "acc_category", "section"]


class LedgerEntryWriteSerializer(serializers.ModelSerializer):
    # make FKs explicit; queryset is narrowed in __init__ by institute
    account = serializers.PrimaryKeyRelatedField(
        queryset=FinanceAccount.all_objects.all()
    )
    category = serializers.PrimaryKeyRelatedField(queryset=AccountType.objects.all())

    class Meta:
        model = FinanceLedgerEntry
        read_only_fields = [
            "id",
            "institute",
            "transfer_id",
            "created_at",
            "updated_at",
            "created_by_id",
            "debit_finance_account",
            "debit_category",
            "credit_finance_account",
            "credit_category",
        ]
        fields = [
            "id",
            "institute",
            "account",
            "date",
            "counterparty",
            "comment",
            "amount",
            "category",
            "transfer_id",
            "created_by_id",
            "created_at",
            "updated_at",
            # (read-only)
            "debit_finance_account",
            "debit_category",
            "credit_finance_account",
            "credit_category",
        ]

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Scope selectable accounts/categories
        request = self.context.get("request")
        iid = getattr(getattr(request, "user", None), "institute_id", None)
        if iid:
            self.fields["account"].queryset = FinanceAccount.all_objects.filter(
                institute_id=iid, is_active=True
            )
        self.fields["category"].queryset = AccountType.objects.filter(is_active=True)

    def validate(self, attrs):
        """Defensive check that account belongs to the current institute."""
        request = self.context.get("request")
        iid = getattr(getattr(request, "user", None), "institute_id", None)
        acc = attrs.get("account")
        if iid and acc and getattr(acc, "institute_id", None) != iid:
            raise serializers.ValidationError(
                {"account": "Account not found for this institute."}
            )
        return attrs

    def create(self, validated_data):
        # populate institute/user ids from request
        req = self.context["request"]
        validated_data["institute_id"] = getattr(req.user, "institute_id", None)
        validated_data["created_by_id"] = (
            str(getattr(req.user, "id", "")) if getattr(req, "user", None) else None
        )
        return super().create(validated_data)


class LedgerEntryReadSerializer(serializers.ModelSerializer):
    account = FinanceAccountLiteSerializer(read_only=True)
    category = AccountTypeLiteSerializer(read_only=True)
    debit_finance_account = FinanceAccountLiteSerializer(read_only=True)
    credit_finance_account = FinanceAccountLiteSerializer(read_only=True)
    debit_category = AccountTypeLiteSerializer(read_only=True)
    credit_category = AccountTypeLiteSerializer(read_only=True)

    class Meta:
        model = FinanceLedgerEntry
        fields = [
            "id",
            "institute",
            "account",
            "date",
            "counterparty",
            "comment",
            "amount",
            "category",
            "transfer_id",
            "debit_finance_account",
            "debit_category",
            "credit_finance_account",
            "credit_category",
            "created_by_id",
            "created_at",
            "updated_at",
        ]


class TransferRequestSerializer(serializers.Serializer):
    from_account = serializers.IntegerField()
    to_account = serializers.IntegerField()
    date = serializers.DateField()
    amount = serializers.DecimalField(
        max_digits=14, decimal_places=2, min_value=Decimal("0.01")
    )  # positive
    comment = serializers.CharField(allow_blank=True, required=False)
    counterparty = serializers.CharField(allow_blank=True, required=False)

    def validate(self, attrs):
        request = self.context["request"]
        iid = getattr(request.user, "institute_id", None)

        if attrs["from_account"] == attrs["to_account"]:
            raise serializers.ValidationError(
                "from_account and to_account must differ."
            )

        for field in ("from_account", "to_account"):
            acc_id = attrs[field]
            exists = FinanceAccount.all_objects.filter(
                id=acc_id, institute_id=iid
            ).exists()
            if not exists:
                raise serializers.ValidationError(
                    {field: f"Account {acc_id} not found for this institute."}
                )
        return attrs


class TransferResponseSerializer(serializers.Serializer):
    out_entry = serializers.PrimaryKeyRelatedField(read_only=True)
    in_entry = serializers.PrimaryKeyRelatedField(read_only=True)
