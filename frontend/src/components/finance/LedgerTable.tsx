import { useMemo, useState } from "react";
import {
  Box,
  Button,
  IconButton,
  Snackbar,
  Alert,
  TextField,
  Typography,
} from "@mui/material";
import AddCircleOutlineIcon from "@mui/icons-material/AddCircleOutline";
import RefreshIcon from "@mui/icons-material/Refresh";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { useLedger } from "../../hooks/useFinance";
import { LedgerFormDialog } from "./LedgerFormDialog";
import { PostingPreview } from "./PostingPreview";

type Props = {
  account: { id: number; name: string };
};

export function LedgerTable({ account }: Props) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState<any | null>(null);
  const { rows, loading, reload } = useLedger({ account: account.id, search });
  const [toast, setToast] = useState<{
    severity: "success" | "error";
    msg: string;
  } | null>(null);

  const columns: GridColDef<any>[] = useMemo(
    () => [
      { field: "date", headerName: "Date", width: 120 },
      {
        field: "counterparty",
        headerName: "Counterparty",
        minWidth: 180,
        flex: 1,
      },
      {
        field: "comment",
        headerName: "Comment",
        minWidth: 220,
        flex: 1,
      },
      {
        field: "category",
        headerName: "Category",
        width: 140,
        renderCell: (p: GridRenderCellParams<any>) =>
          (typeof p.row.category === "object"
            ? p.row.category?.acc_category
            : p.row.category) ?? "—",
      },
      {
        field: "amount",
        headerName: "Amount",
        width: 140,
        align: "right",
        headerAlign: "right",
        renderCell: (p: GridRenderCellParams<any>) => {
          const val = Number(p.row.amount);
          const formatted = isNaN(val) ? p.row.amount : val.toLocaleString();
          return (
            <span
              style={{
                fontWeight: 600,
                color: val < 0 ? "#b00020" : "#1b5e20",
              }}
            >
              {formatted}
            </span>
          );
        },
      },
      {
        field: "posting",
        headerName: "Posting",
        minWidth: 220,
        flex: 1,
        sortable: false,
        filterable: false,
        renderCell: (p) => <PostingPreview entry={p.row} />,
      },
    ],
    []
  );

  return (
    <>
      <Box sx={{ display: "flex", gap: 1, alignItems: "center", mb: 1 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          {account.name}
        </Typography>
        <TextField
          size="small"
          label="Search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <IconButton title="Reload" onClick={() => reload()}>
          <RefreshIcon />
        </IconButton>
        <Button
          variant="contained"
          startIcon={<AddCircleOutlineIcon />}
          onClick={() => {
            setEdit(null);
            setOpen(true);
          }}
        >
          New transaction
        </Button>
      </Box>

      <div style={{ width: "100%" }}>
        <DataGrid
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          loading={loading}
          disableRowSelectionOnClick
          density="compact"
          autoHeight
          sx={{
            borderRadius: 1,
            "& .MuiDataGrid-columnHeaders": {
              background: "#f7f7f7",
              fontWeight: 600,
            },
            "& .MuiDataGrid-row:hover": {
              backgroundColor: "rgba(21, 101, 192, 0.08)",
              cursor: "pointer",
            },
            "& .MuiDataGrid-virtualScrollerRenderZone": {
              "& .MuiDataGrid-row:nth-of-type(2n)": {
                backgroundColor: "#fcfcfc",
              },
            },
          }}
          onRowClick={(p) => {
            setEdit(p.row);
            setOpen(true);
          }}
          pageSizeOptions={[25, 50]}
        />
      </div>

      <LedgerFormDialog
        open={open}
        mode={edit ? "edit" : "create"}
        account={account}
        initial={edit}
        onClose={() => setOpen(false)}
        onSuccess={() => {
          setOpen(false);
          reload();
          setToast({ severity: "success", msg: edit ? "Updated" : "Created" });
        }}
        onError={(msg) => setToast({ severity: "error", msg })}
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
    </>
  );
}
