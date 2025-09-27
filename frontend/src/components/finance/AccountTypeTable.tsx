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
  IconButton,
} from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { financeApi, AccountType, AccountTypeWrite } from "../../api/finance";
import { EntityFormDialog } from "../EntityFormDialog";

type Row = AccountType & { id: string | number };

const SECTION_CHOICES: AccountType["section"][] = ["REVENUE", "EXPENSE", "LFB"];

export function AccountTypeTable() {
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
      const r = await financeApi.listAccountTypes();
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
      { field: "acc_category", headerName: "Category", flex: 1, minWidth: 220 },
      { field: "section", headerName: "Section", width: 180 },
      {
        field: "is_active",
        headerName: "Active",
        width: 120,
        renderCell: (params: GridRenderCellParams<Row, Row["is_active"]>) =>
          params.row.is_active ? "Yes" : "No",
        type: "boolean",
        sortable: true,
      },
      {
        field: "actions",
        headerName: "",
        width: 80,
        sortable: false,
        filterable: false,
        renderCell: (params) => (
          <IconButton
            size="small"
            onClick={async (e) => {
              e.stopPropagation();
              if (!confirm(`Delete ${params.row.acc_category}?`)) return;
              try {
                await financeApi.deleteAccountType(params.row.id);
                setToast({ severity: "success", msg: "Deleted" });
                load();
              } catch (err: any) {
                setToast({
                  severity: "error",
                  msg: err?.response?.data?.detail ?? "Delete failed",
                });
              }
            }}
          >
            <DeleteIcon fontSize="small" />
          </IconButton>
        ),
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
        <Typography variant="h6">Account Types</Typography>
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

      <AccountTypeForm
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

function AccountTypeForm({
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

  const empty = (): AccountTypeWrite => ({
    code: "",
    acc_category: "",
    section: "REVENUE",
    is_active: true,
  });

  const mapInitial = (r: Row): AccountTypeWrite => ({
    code: (r as any).code ?? "",
    acc_category: r.acc_category,
    section: r.section,
    is_active: r.is_active,
  });

  const onSubmit = async (payload: AccountTypeWrite) => {
    if (!payload.acc_category || !payload.section) {
      throw new Error("Category and Section are required.");
    }
    if (mode === "create") {
      await financeApi.createAccountType(payload);
    } else {
      await financeApi.patchAccountType((initial as Row).id, payload);
    }
  };

  return (
    <EntityFormDialog<AccountTypeWrite, Row>
      title={mode === "create" ? "Create Account Type" : "Edit Account Type"}
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
            label="Code"
            value={form.code ?? ""}
            onChange={(e) => update({ code: e.target.value })}
            helperText="Slug; leave blank to auto-generate"
          />
          <TextField
            label="Category"
            value={form.acc_category ?? ""}
            onChange={(e) => update({ acc_category: e.target.value })}
            required
          />
          <TextField
            select
            label="Section"
            value={form.section ?? ""}
            onChange={(e) => update({ section: e.target.value as any })}
            required
          >
            {SECTION_CHOICES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
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
