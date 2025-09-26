import uuid
from decimal import Decimal
from django.db import transaction
from .models import FinanceLedgerEntry, AccountType, AccountSection


class LedgerService:
    @staticmethod
    @transaction.atomic
    def transfer_between_accounts(
        *,
        institute_id,
        from_account_id: int,
        to_account_id: int,
        date,
        amount_positive: Decimal,  # > 0
        comment: str,
        created_by_id,
        counterparty: str = "Internal transfer",
    ):
        if from_account_id == to_account_id:
            raise ValueError("Source and target accounts must differ.")

        # pick any active LFB category (or you can pin a code like 'bank_liquid_funds')
        lfb = AccountType.objects.filter(
            section=AccountSection.LIQUID_FUNDS_BANKS, is_active=True
        ).first()
        if not lfb:
            raise ValueError("No active 'Liquid funds – Banks' category configured.")

        t_id = uuid.uuid4()

        out_entry = FinanceLedgerEntry.objects.create(
            institute_id=institute_id,
            account_id=from_account_id,
            date=date,
            counterparty=counterparty,
            comment=comment or "",
            amount=-abs(Decimal(amount_positive)),
            category=lfb,
            transfer_id=t_id,
            created_by_id=created_by_id,
        )
        in_entry = FinanceLedgerEntry.objects.create(
            institute_id=institute_id,
            account_id=to_account_id,
            date=date,
            counterparty=counterparty,
            comment=comment or "",
            amount=abs(Decimal(amount_positive)),
            category=lfb,
            transfer_id=t_id,
            created_by_id=created_by_id,
        )
        return out_entry, in_entry
