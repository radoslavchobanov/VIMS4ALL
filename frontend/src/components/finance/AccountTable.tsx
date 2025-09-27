import { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Box,
  Button,
  Typography,
  TextField,
  MenuItem,
  Snackbar,
  Alert,
} from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import {
  financeApi,
  FinanceAccount,
  FinanceAccountWrite,
} from "../../api/finance";
import { EntityFormDialog } from "../EntityFormDialog";

type Row = FinanceAccount;
const KIND_CHOICES: NonNullable<FinanceAccount["kind"]>[] = ["CASHBOX", "BANK"];

export function AccountTable() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [initial, setInitial] = useState<Row | null>(null);
  const [toast, setToast] = useState<{
    severity: "success" | "error";
    msg: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await financeApi.listAccounts();
      setRows(r.data as Row[]);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const columns: GridColDef<Row>[] = useMemo(
    () => [
      { field: "name", headerName: "Name", flex: 1, minWidth: 220 },
      { field: "kind", headerName: "Kind", width: 140 },
      { field: "currency", headerName: "Currency", width: 120 },
      {
        field: "is_active",
        headerName: "Active",
        width: 120,
        renderCell: (params: GridRenderCellParams<Row, Row["is_active"]>) =>
          params.row.is_active ? "Yes" : "No",
        // (optional) keep data type for sorting/filtering
        type: "boolean",
        sortable: true,
      },
      {
        field: "balance",
        headerName: "Balance",
        width: 140,
        renderCell: (p) => {
          const val = Number(p.row.balance ?? 0);
          const fmt = isNaN(val) ? p.row.balance : val.toLocaleString();
          return (
            <span
              style={{
                fontWeight: 600,
                color: val < 0 ? "#b00020" : "#1b5e20",
              }}
            >
              {fmt}
            </span>
          );
        },
      },
    ],
    []
  );

  return (
    <Paper sx={{ p: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
        }}
      >
        <Typography variant="h6">Accounts</Typography>
        <Button
          variant="contained"
          onClick={() => {
            setInitial(null);
            setOpen(true);
          }}
        >
          Create
        </Button>
      </Box>

      <div style={{ height: 520, width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          loading={loading}
          pageSizeOptions={[25, 50]}
          onRowClick={(p) => {
            setInitial(p.row as Row);
            setOpen(true);
          }}
          sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
        />
      </div>

      <AccountForm
        open={open}
        initial={initial ?? undefined}
        onClose={() => setOpen(false)}
        onCreated={() => {
          setOpen(false);
          load();
          setToast({ severity: "success", msg: "Created" });
        }}
        onUpdated={() => {
          setOpen(false);
          load();
          setToast({ severity: "success", msg: "Updated" });
        }}
        onError={(m) => setToast({ severity: "error", msg: m })}
      />

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

function AccountForm({
  open,
  initial,
  onClose,
  onCreated,
  onUpdated,
  onError,
}: {
  open: boolean;
  initial?: Row;
  onClose: () => void;
  onCreated: () => void;
  onUpdated: () => void;
  onError: (msg: string) => void;
}) {
  const mode: "create" | "edit" = initial ? "edit" : "create";

  const empty = (): FinanceAccountWrite => ({
    kind: "CASHBOX",
    name: "",
    currency: "UGX",
    is_active: true,
  });

  const mapInitial = (r: Row): FinanceAccountWrite => ({
    kind: r.kind,
    name: r.name,
    currency: r.currency,
    is_active: r.is_active,
  });

  const onSubmit = async (payload: FinanceAccountWrite) => {
    if (!payload.kind || !payload.name)
      throw new Error("Kind and Name are required.");
    if (mode === "create") {
      await financeApi.createAccount(payload);
    } else {
      await financeApi.patchAccount((initial as Row).id, payload);
    }
  };

  return (
    <EntityFormDialog<FinanceAccountWrite, Row>
      title={mode === "create" ? "Create Account" : "Edit Account"}
      open={open}
      mode={mode}
      initial={initial}
      emptyFactory={empty}
      mapInitialToWrite={mapInitial}
      onClose={onClose}
      onSubmit={onSubmit}
      onSuccess={mode === "create" ? onCreated : onUpdated}
      onError={onError}
      renderFields={(form, update) => (
        <>
          <TextField
            select
            label="Kind"
            value={form.kind ?? ""}
            onChange={(e) => update({ kind: e.target.value as any })}
            required
          >
            {KIND_CHOICES.map((k) => (
              <MenuItem key={k} value={k}>
                {k}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Name"
            value={form.name ?? ""}
            onChange={(e) => update({ name: e.target.value })}
            required
          />
          <TextField
            label="Currency"
            value={form.currency ?? ""}
            onChange={(e) => update({ currency: e.target.value || "UGX" })}
          />
          <TextField
            select
            label="Active"
            value={form.is_active ? "true" : "false"}
            onChange={(e) => update({ is_active: e.target.value === "true" })}
          >
            <MenuItem value="true">Yes</MenuItem>
            <MenuItem value="false">No</MenuItem>
          </TextField>
        </>
      )}
    />
  );
}
