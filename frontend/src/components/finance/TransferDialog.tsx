import { useEffect, useState } from "react";
import { TextField, MenuItem, Box } from "@mui/material";
import { EntityFormDialog } from "../EntityFormDialog";
import { useFinanceAccounts, financeMut } from "../../hooks/useFinance";
import { LedgerTransferWrite } from "../../api/finance";

export function TransferDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { accounts } = useFinanceAccounts();
  const [form, setForm] = useState<LedgerTransferWrite>({
    from_account: 0 as any,
    to_account: 0 as any,
    date: new Date().toISOString().slice(0, 10),
    amount: "" as any,
    comment: "",
    counterparty: "Internal transfer",
  });

  useEffect(() => {
    if (!open) return;
    setForm((f) => ({ ...f, date: new Date().toISOString().slice(0, 10) }));
  }, [open]);

  const update = (p: Partial<LedgerTransferWrite>) =>
    setForm((prev) => ({ ...prev, ...p }));

  const submit = async () => {
    if (!form.from_account || !form.to_account || !form.amount) {
      throw new Error("From, To and Amount are required.");
    }
    await financeMut.transfer({ ...form, amount: form.amount });
  };

  return (
    <EntityFormDialog<LedgerTransferWrite, any>
      title="Transfer funds"
      open={open}
      mode="create"
      emptyFactory={() => form}
      onClose={onClose}
      onSubmit={async () => submit()}
      onSuccess={onClose}
      onError={() => {}}
      renderFields={() => (
        <>
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            }}
          >
            <TextField
              select
              label="From"
              value={form.from_account ?? 0}
              onChange={(e) =>
                update({ from_account: Number(e.target.value) as any })
              }
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
              label="To"
              value={form.to_account ?? 0}
              onChange={(e) =>
                update({ to_account: Number(e.target.value) as any })
              }
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
          </Box>
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
          <TextField
            label="Comment"
            value={form.comment ?? ""}
            onChange={(e) => update({ comment: e.target.value })}
          />
        </>
      )}
    />
  );
}
