import { Fragment, useEffect, useMemo, useState } from "react";
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
import type { AxiosError } from "axios";
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
          sx={{
            fontSize: "16px",
            "& .MuiDataGrid-columnHeaders": {
              fontSize: "16px",
            },
            "& .MuiDataGrid-row:hover": {
              backgroundColor: "rgba(21, 101, 192, 0.08)",
              cursor: "pointer",
            },
          }}
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

  // NEW: top-of-form server error banner
  const [serverErrors, setServerErrors] = useState<string[]>([]);

  // Utility: flatten DRF ValidationError shapes into lines
  function parseDrfErrors(err: unknown): string[] {
    const ax = err as AxiosError<any>;
    const data = ax?.response?.data;

    if (typeof data === "string") return [data];
    if (Array.isArray(data)) return data.map(String);

    if (data && typeof data === "object") {
      const out: string[] = [];

      // DRF sometimes uses "detail" for top-level errors
      if (data.detail) out.push(String(data.detail));

      for (const [k, v] of Object.entries(data)) {
        if (k === "detail") continue;

        // treat "__all__" and "non_field_errors" as global messages (no prefix)
        const isGlobal = k === "__all__" || k === "non_field_errors";

        const pushVal = (msg: any) =>
          out.push(isGlobal ? String(msg) : `${k}: ${String(msg)}`);

        if (Array.isArray(v)) {
          v.forEach((msg: any) => pushVal(msg));
        } else if (typeof v === "string") {
          pushVal(v);
        } else if (v && typeof v === "object") {
          for (const [nk, nv] of Object.entries(v as Record<string, any>)) {
            if (Array.isArray(nv))
              (nv as any[]).forEach((m) =>
                out.push(`${k}.${nk}: ${String(m)}`)
              );
            else out.push(`${k}.${nk}: ${String(nv)}`);
          }
        }
      }

      return out.length ? out : ["Validation failed."];
    }

    return ["Unexpected error."];
  }

  // Reset state on open/target change
  useEffect(() => {
    if (open) {
      setTab(0);
      setServerErrors([]);
    }
    if (open && !initial) {
      setSuggestedName("");
      setStartDate("");
    }
  }, [open, initial?.id]);

  const empty = (): AcademicTermWrite => ({
    name: suggestedName || "",
    start_date: "",
    end_date: "",
  });

  const mapRead = (t: AcademicTerm): AcademicTermWrite => ({
    name: t.name ?? "",
    start_date: t.start_date ?? "",
    end_date: t.end_date ?? "",
  });

  // When opening the dialog in CREATE mode, fetch the next name preview
  // Also re-fetch when start_date changes (with debounce to avoid flashing during calendar navigation)
  const [startDate, setStartDate] = useState<string>("");

  useEffect(() => {
    // Debounce the API call to avoid triggering while user navigates calendar months
    const timeoutId = setTimeout(async () => {
      if (open && !initial) {
        try {
          const params = startDate ? { start_date: startDate } : {};
          const r = await api.get<{
            name: string;
            year: number;
            ordinal: number;
          }>(`${TERMS_ENDPOINT}next-name/`, { params });
          setSuggestedName(r.data.name);
        } catch {
          // ignore; backend still generates on POST
        }
      }
    }, 300); // 300ms debounce - only call API after user stops changing the date

    return () => clearTimeout(timeoutId);
  }, [open, initial, startDate]);

  // IMPORTANT: we catch here, populate banner, then rethrow so EntityFormDialog
  // can still run its error branch (spinner/disable reset etc.)
  const onSubmit = async (payload: AcademicTermWrite) => {
    setServerErrors([]); // clear previous
    const { start_date, end_date } = payload;
    try {
      if (mode === "create") {
        await api.post(TERMS_ENDPOINT, { start_date, end_date });
      } else {
        await api.patch(`${TERMS_ENDPOINT}${initial!.id}/`, {
          start_date,
          end_date,
        });
      }
    } catch (e) {
      const lines = parseDrfErrors(e);
      setServerErrors(lines);
      // Also notify parent toast with compact summary
      onError(lines.join(" "));
      throw e; // let EntityFormDialog know it failed
    }
  };

  return (
    <EntityFormDialog<AcademicTermWrite, AcademicTerm>
      key={`term-form-${mode}-${initial?.id ?? "new"}`}
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
        <Fragment>
          {/* Top-of-modal, centered error box */}
          {serverErrors.length > 0 && (
            <Box
              sx={{
                mb: 2,
                display: "flex",
                justifyContent: "center",
              }}
            >
              <Alert
                severity="error"
                variant="outlined"
                sx={{
                  width: "100%",
                  maxWidth: 640,
                  bgcolor: (t) => t.palette.error.light + "20", // light red background
                }}
              >
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {serverErrors.map((line, i) => (
                    <li key={i}>{line}</li>
                  ))}
                </ul>
              </Alert>
            </Box>
          )}

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
              value={mode === "create" ? suggestedName : form.name}
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
              onChange={(e) => {
                setServerErrors([]); // clear banner on edit
                setForm({ start_date: e.target.value });
                // Update startDate state to trigger next-name re-fetch in CREATE mode
                if (mode === "create") {
                  setStartDate(e.target.value);
                }
              }}
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              label="End date"
              type="date"
              value={form.end_date}
              onChange={(e) => {
                setServerErrors([]); // clear banner on edit
                setForm({ end_date: e.target.value });
              }}
              InputLabelProps={{ shrink: true }}
              required
            />
          </Box>
        </Fragment>
      )}
    />
  );
}
