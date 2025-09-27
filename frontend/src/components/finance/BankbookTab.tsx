import { useEffect, useState } from "react";
import { MenuItem, TextField, Box, Typography } from "@mui/material";
import { LedgerTable } from "./LedgerTable";
import { useFinanceAccounts } from "../../hooks/useFinance";
import { AccountSummary, formatMoney } from "./AccountSummary";

export function BankbookTab() {
  const { banks } = useFinanceAccounts();
  const [sel, setSel] = useState<string | number | null>(banks[0]?.id ?? null);

  useEffect(() => {
    if (!sel && banks.length) setSel(banks[0].id);
  }, [banks, sel]);

  if (!banks.length)
    return (
      <Typography>No Bank account. Create one in Accounts tab.</Typography>
    );

  const active = banks.find((b) => b.id === sel) ?? banks[0];

  return (
    <>
      <Box sx={{ mb: 1 }}>
        <TextField
          size="small"
          select
          label="Bank account"
          value={active.id}
          onChange={(e) => setSel(e.target.value as any)}
          sx={{ minWidth: 220 }}
        >
          {banks.map((b) => (
            <MenuItem key={b.id as any} value={b.id as any}>
              {b.name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      <AccountSummary
        name={active.name}
        currency={active.currency as any}
        balance={(active as any).balance}
      />

      <LedgerTable account={active} />
    </>
  );
}
