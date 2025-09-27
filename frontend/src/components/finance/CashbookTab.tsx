import { Typography } from "@mui/material";
import { LedgerTable } from "./LedgerTable";
import { useFinanceAccounts } from "../../hooks/useFinance";
import { AccountSummary } from "./AccountSummary";

export function CashbookTab() {
  const { cashbox } = useFinanceAccounts();
  if (!cashbox)
    return (
      <Typography>No Cashbox account. Create one in Accounts tab.</Typography>
    );

  return (
    <>
      <AccountSummary
        name={cashbox.name}
        currency={cashbox.currency as any}
        balance={(cashbox as any).balance}
      />
      <LedgerTable account={cashbox} />
    </>
  );
}
