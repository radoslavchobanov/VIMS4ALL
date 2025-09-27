export function PostingPreview({ entry }: { entry: any }) {
  const dr = entry.debit_finance_account
    ? entry.debit_finance_account.name
    : entry.debit_category?.acc_category;
  const cr = entry.credit_finance_account
    ? entry.credit_finance_account.name
    : entry.credit_category?.acc_category;
  return (
    <span>
      Dr {dr ?? "–"} / Cr {cr ?? "–"}
    </span>
  );
}
