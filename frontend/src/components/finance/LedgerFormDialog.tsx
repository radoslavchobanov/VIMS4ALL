import { useEffect, useMemo, useState } from "react";
import { TextField, MenuItem, Box } from "@mui/material";
import { EntityFormDialog } from "../EntityFormDialog";
import { financeApi, LedgerEntryWrite } from "../../api/finance";
import { financeMut } from "../../hooks/useFinance";

type Props = {
  open: boolean;
  mode: "create" | "edit";
  account: { id: number; name: string };
  initial?: any;
  onClose: () => void;
  onSuccess: () => void;
  onError: (msg: string) => void;
};

export function LedgerFormDialog({
  open,
  mode,
  account,
  initial,
  onClose,
  onSuccess,
  onError,
}: Props) {
  const empty = useMemo<() => LedgerEntryWrite>(
    () => () => ({
      account: account.id,
      date: new Date().toISOString().slice(0, 10),
      amount: "" as any,
      category: "" as any,
      counterparty: "",
      comment: "",
    }),
    [account.id]
  );

  const mapInitial = (i: any): LedgerEntryWrite => ({
    account: i.account ?? account.id,
    date: i.date,
    amount: String(i.amount ?? ""),
    category:
      (typeof i.category === "object" ? i.category?.id : i.category) ?? "",
    counterparty: i.counterparty ?? "",
    comment: i.comment ?? "",
  });

  const [cats, setCats] = useState<any[]>([]);
  const [form, setForm] = useState<LedgerEntryWrite>(empty());
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (initial) setForm(mapInitial(initial));
    else setForm(empty());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, initial]);

  useEffect(() => {
    const val = parseFloat(String(form.amount));
    if (!isNaN(val) && val !== 0) {
      financeApi.categoriesForAmount(val).then((r) => setCats(r.data));
    } else {
      setCats([]);
    }
  }, [form.amount]);

  const update = (patch: Partial<LedgerEntryWrite>) =>
    setForm((prev) => ({ ...prev, ...patch }));

  async function submitLocal() {
    // Validate local state (not the dialog’s internal payload)
    if (!form.amount || Number(form.amount) === 0) {
      throw new Error("Amount must be non-zero.");
    }
    if (!form.category || typeof form.category !== "number") {
      throw new Error("Please choose a category.");
    }
    if (!form.date) {
      throw new Error("Date is required.");
    }

    if (mode === "create") {
      await financeMut.createLedger(form);
    } else {
      await financeMut.patchLedger((initial as any).id, form);
    }
  }

  const get = <K extends keyof LedgerEntryWrite>(k: K) =>
    (form[k] ?? "") as any;

  return (
    <EntityFormDialog<LedgerEntryWrite, any>
      title={mode === "create" ? "New transaction" : "Edit transaction"}
      open={open}
      mode={mode}
      initial={initial}
      emptyFactory={empty}
      mapInitialToWrite={mapInitial}
      onClose={() => {
        if (!submitting) onClose();
      }}
      /** IMPORTANT: ignore payload and submit our local `form` */
      onSubmit={async () => {
        try {
          setSubmitting(true);
          await submitLocal();
          onSuccess();
        } catch (e: any) {
          onError(e?.response?.data?.detail ?? e?.message ?? "Save failed");
          throw e;
        } finally {
          setSubmitting(false);
        }
      }}
      onSuccess={onSuccess}
      onError={onError}
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
              label="Date"
              type="date"
              value={get("date")}
              onChange={(e) => update({ date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField label="Account" value={account.name} disabled />
          </Box>
          <TextField
            label="Amount"
            type="number"
            value={get("amount")}
            onChange={(e) => update({ amount: e.target.value as any })}
            required
          />
          <TextField
            select
            label="Category"
            value={get("category")}
            onChange={(e) =>
              update({ category: Number(e.target.value) as any })
            }
            disabled={!cats.length}
            required
          >
            <MenuItem value="" disabled>
              Select…
            </MenuItem>
            {cats.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.acc_category}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Counterparty"
            value={get("counterparty")}
            onChange={(e) => update({ counterparty: e.target.value })}
          />
          <TextField
            label="Comment"
            value={get("comment")}
            onChange={(e) => update({ comment: e.target.value })}
          />
        </>
      )}
    />
  );
}
