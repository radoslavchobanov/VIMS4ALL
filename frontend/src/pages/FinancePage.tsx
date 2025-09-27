import { Paper, Box, Button, Typography } from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { CashbookTab } from "../components/finance/CashbookTab";
import { BankbookTab } from "../components/finance/BankbookTab";
import { TransferPanel } from "../components/finance/TransferPanel";
import { AccountTypeTable } from "../components/finance/AccountTypeTable";
import { AccountTable } from "../components/finance/AccountTable";
import { useEffect, useState } from "react";

export default function FinancePage() {
  const { hasRole } = useAuth();
  const isSuper = hasRole("superuser");

  const [tab, setTab] = useState<
    "cash" | "bank" | "transfer" | "acctypes" | "accounts"
  >(isSuper ? "acctypes" : "cash");

  // safety: if role changes at runtime
  useEffect(() => {
    if (isSuper) {
      setTab("acctypes");
    } else if (tab === "acctypes") {
      setTab("cash");
    }
  }, [isSuper, tab]);

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ display: "flex", gap: 1, mb: 2 }}>
        {isSuper ? (
          <Button
            variant={tab === "acctypes" ? "contained" : "outlined"}
            onClick={() => setTab("acctypes")}
          >
            Account Types
          </Button>
        ) : (
          <>
            <Button
              variant={tab === "cash" ? "contained" : "outlined"}
              onClick={() => setTab("cash")}
            >
              Cashbox
            </Button>
            <Button
              variant={tab === "bank" ? "contained" : "outlined"}
              onClick={() => setTab("bank")}
            >
              Bank
            </Button>
            <Button
              variant={tab === "transfer" ? "contained" : "outlined"}
              onClick={() => setTab("transfer")}
            >
              Transfer
            </Button>
            <Button
              variant={tab === "accounts" ? "contained" : "outlined"}
              onClick={() => setTab("accounts")}
            >
              Accounts
            </Button>
          </>
        )}
      </Box>

      {/* content */}
      {isSuper ? (
        tab === "acctypes" && <AccountTypeTable />
      ) : (
        <>
          {tab === "cash" && <CashbookTab />}
          {tab === "bank" && <BankbookTab />}
          {tab === "transfer" && <TransferPanel />}
          {tab === "accounts" && <AccountTable />}
        </>
      )}
    </Paper>
  );
}
