import { useEffect, useState } from "react";
import {
  TextField,
  MenuItem,
  Box,
  Paper,
  Typography,
  Button,
  Snackbar,
  Alert,
} from "@mui/material";
import { useFinanceAccounts, financeMut } from "../../hooks/useFinance";
import SwapHorizIcon from "@mui/icons-material/SwapHoriz";

export function TransferPanel() {
  const { accounts } = useFinanceAccounts();
  const [toast, setToast] = useState<{
    severity: "success" | "error";
    msg: string;
  } | null>(null);

  const [form, setForm] = useState({
    from_account: 0 as any,
    to_account: 0 as any,
    date: new Date().toISOString().slice(0, 10),
    amount: "" as any,
    comment: "",
    counterparty: "Internal transfer",
  });

  useEffect(() => {
    if (!accounts.length) return;
    setForm((f) => ({
      ...f,
      from_account: f.from_account || (accounts[0]?.id as any),
      to_account: f.to_account || ((accounts[1]?.id ?? accounts[0]?.id) as any),
    }));
  }, [accounts]);

  const update = (p: Partial<typeof form>) =>
    setForm((prev) => ({ ...prev, ...p }));

  async function submit() {
    if (!form.from_account || !form.to_account || !form.amount) {
      setToast({ severity: "error", msg: "From, To and Amount are required." });
      return;
    }
    if (form.from_account === form.to_account) {
      setToast({
        severity: "error",
        msg: "From and To must be different accounts.",
      });
      return;
    }
    try {
      await financeMut.transfer({ ...form, amount: form.amount });
      setToast({ severity: "success", msg: "Transfer completed" });
    } catch (e: any) {
      setToast({
        severity: "error",
        msg: e?.response?.data?.detail ?? e?.message ?? "Transfer failed",
      });
    }
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Typography variant="h6" sx={{ mb: 2 }}>
        Transfer funds
      </Typography>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        <TextField
          select
          label="From account"
          value={form.from_account ?? 0}
          onChange={(e) => update({ from_account: e.target.value as any })}
        >
          <MenuItem value={0} disabled>
            Select…
          </MenuItem>
          {accounts.map((a) => (
            <MenuItem value={a.id as any} key={a.id as any}>
              {a.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="To account"
          value={form.to_account ?? 0}
          onChange={(e) => update({ to_account: e.target.value as any })}
        >
          <MenuItem value={0} disabled>
            Select…
          </MenuItem>
          {accounts.map((a) => (
            <MenuItem value={a.id as any} key={a.id as any}>
              {a.name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          label="Date"
          type="date"
          value={form.date}
          onChange={(e) => update({ date: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Amount"
          type="number"
          value={form.amount as any}
          onChange={(e) => update({ amount: e.target.value as any })}
        />
      </Box>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          mt: 2,
        }}
      >
        <TextField
          label="Counterparty"
          value={form.counterparty}
          onChange={(e) => update({ counterparty: e.target.value })}
        />
        <TextField
          label="Comment"
          value={form.comment}
          onChange={(e) => update({ comment: e.target.value })}
        />
      </Box>
      <Box sx={{ mt: 2 }}>
        <Button
          variant="contained"
          startIcon={<SwapHorizIcon />}
          onClick={submit}
        >
          Transfer
        </Button>
      </Box>

      {toast && (
        <Snackbar
          open
          autoHideDuration={2500}
          onClose={() => setToast(null)}
          anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
        >
          <Alert
            severity={toast.severity}
            onClose={() => setToast(null)}
            sx={{ width: "100%" }}
          >
            {toast.msg}
          </Alert>
        </Snackbar>
      )}
    </Paper>
  );
}
