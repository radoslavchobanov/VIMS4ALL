from .models import AccountSection

# (code, acc_category, section)
DEFAULT_ACCOUNT_TYPES = [
    ("lfb", "Liquid funds – Banks", AccountSection.LIQUID_FUNDS_BANKS),
    ("tuition", "Tuition revenue", AccountSection.REVENUE),
    ("donation", "Donations", AccountSection.REVENUE),
    ("supplies", "Supplies expense", AccountSection.EXPENSE),
    ("salaries", "Salaries expense", AccountSection.EXPENSE),
]
