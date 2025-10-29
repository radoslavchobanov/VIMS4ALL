import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Paper,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
  MenuItem,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

import { api } from "../lib/apiClient";
import { EntityFormDialog } from "../components/EntityFormDialog";
import { TERMS_ENDPOINT } from "../lib/endpoints";
import type { components } from "../api/__generated__/vims-types";

type Page<T> = {
  results: T[];
  count?: number;
  next?: string | null;
  previous?: string | null;
};

type AcademicTerm = components["schemas"]["AcademicTerm"] | any;
type AcademicTermWrite = {
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
};

export default function TermsPage() {
  const [rows, setRows] = useState<AcademicTerm[]>([]);
  const [loading, setLoading] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [initial, setInitial] = useState<AcademicTerm | undefined>(undefined);

  const [toast, setToast] = useState<{
    severity: "success" | "error";
    msg: string;
  } | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get<AcademicTerm[] | Page<AcademicTerm>>(
        TERMS_ENDPOINT,
        { params: { page_size: 200 } }
      );
      const list = Array.isArray(r.data) ? r.data : r.data.results ?? [];
      setRows(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const columns: GridColDef<AcademicTerm>[] = useMemo(
    () => [
      { field: "name", headerName: "Name", flex: 1, minWidth: 180 },
      { field: "start_date", headerName: "Start", width: 140 },
      { field: "end_date", headerName: "End", width: 140 },
    ],
    []
  );

  const openCreate = () => {
    setInitial(undefined);
    setOpenForm(true);
  };
  const openEdit = (term: AcademicTerm) => {
    setInitial(term);
    setOpenForm(true);
  };

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
        <Typography variant="h6">Terms</Typography>
        <Button variant="contained" onClick={openCreate}>
          Create term
        </Button>
      </Box>

      <div style={{ height: 600, width: "100%" }}>
        <DataGrid<AcademicTerm>
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          loading={loading}
          onRowClick={(p) => openEdit(p.row)}
          pageSizeOptions={[25, 50, 100]}
          sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
        />
      </div>

      <TermForm
        open={openForm}
        initial={initial}
        onClose={() => setOpenForm(false)}
        onCreated={async () => {
          setOpenForm(false);
          await load();
          setToast({ severity: "success", msg: "Term created" });
        }}
        onUpdated={async () => {
          setOpenForm(false);
          await load();
          setToast({ severity: "success", msg: "Term updated" });
        }}
        onError={(m) => setToast({ severity: "error", msg: m })}
      />

      {toast ? (
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
      ) : null}
    </Paper>
  );
}

/* ------------------------ FORM ------------------------ */
function TermForm({
  open,
  initial,
  onClose,
  onCreated,
  onUpdated,
  onError,
}: {
  open: boolean;
  initial?: AcademicTerm;
  onClose: () => void;
  onCreated: () => void;
  onUpdated: () => void;
  onError: (msg: string) => void;
}) {
  const mode: "create" | "edit" = initial ? "edit" : "create";
  const [tab, setTab] = useState(0);

  // NEW: local state for server-generated name
  const [suggestedName, setSuggestedName] = useState<string>("");

  useEffect(() => {
    if (open) setTab(0);
    // reset suggestion whenever the dialog opens for a new create
    if (open && !initial) setSuggestedName("");
  }, [open, initial?.id]);

  const empty = (): AcademicTermWrite => ({
    name: suggestedName || "", // seed with suggestedName (may be "")
    start_date: "",
    end_date: "",
  });

  const mapRead = (t: AcademicTerm): AcademicTermWrite => ({
    name: t.name ?? "",
    start_date: t.start_date ?? "",
    end_date: t.end_date ?? "",
  });

  // When opening the dialog in CREATE mode, fetch the next name preview
  useEffect(() => {
    const run = async () => {
      if (open && !initial && !suggestedName) {
        try {
          const r = await api.get<{
            name: string;
            year: number;
            ordinal: number;
          }>(`${TERMS_ENDPOINT}next-name/`);
          setSuggestedName(r.data.name); // <-- store only; form will be re-seeded on remount via key+emptyFactory
        } catch {
          // ignore; backend still generates on POST
        }
      }
    };
    run();
  }, [open, initial, suggestedName]);

  const onSubmit = async (payload: AcademicTermWrite) => {
    const { start_date, end_date } = payload;
    if (mode === "create")
      await api.post(TERMS_ENDPOINT, { start_date, end_date });
    else
      await api.patch(`${TERMS_ENDPOINT}${initial!.id}/`, {
        start_date,
        end_date,
      });
  };

  return (
    <EntityFormDialog<AcademicTermWrite, AcademicTerm>
      key={`term-form-${mode}-${initial?.id ?? "new"}-${suggestedName}`} // <-- forces form re-init when name arrives
      title={mode === "create" ? "Create Term" : "Edit Term"}
      open={open}
      mode={mode}
      initial={initial}
      emptyFactory={empty}
      mapInitialToWrite={mapRead}
      onClose={onClose}
      onSubmit={onSubmit}
      onSuccess={mode === "create" ? onCreated : onUpdated}
      onError={onError}
      renderFields={(form, setForm) => (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
            <Tab label="General" />
          </Tabs>

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
            }}
          >
            <TextField
              label="Name"
              value={form.name}
              InputProps={{ readOnly: true }}
              helperText={
                mode === "create"
                  ? suggestedName
                    ? "Generated automatically"
                    : "Generating…"
                  : "Generated automatically"
              }
              required
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
              label="Start date"
              type="date"
              value={form.start_date}
              onChange={(e) => setForm({ start_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              label="End date"
              type="date"
              value={form.end_date}
              onChange={(e) => setForm({ end_date: e.target.value })}
              InputLabelProps={{ shrink: true }}
              required
            />
          </Box>
        </>
      )}
    />
  );
}
