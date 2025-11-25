import { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Box,
  Typography,
  TextField,
  Button,
  Snackbar,
  Alert,
  CircularProgress,
  Tabs,
  Tab,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { Edit, Save, Close, Delete } from "@mui/icons-material";

import { api } from "../lib/apiClient";
import {
  INSTITUTE_ENDPOINT,
  INSTITUTE_LOGO_UPLOAD_ENDPOINT,
} from "../lib/endpoints";
import { useAuth } from "../auth/AuthContext";
import { PhotoBox } from "../components/PhotoBox";
import { EntityFormDialog } from "../components/EntityFormDialog";

/* ---------------- Types ---------------- */
type Institute = Record<string, any> & {
  id: number;
  logo_url?: string;
  name?: string;
  abbr_name?: string;
};

type EmpFunction = {
  id: number;
  name: string;
  scope: "global" | "institute";
};

type EmpFunctionWrite = {
  name: string;
};

/* -------------- Constants / helpers -------------- */
const EXCLUDE_KEYS = new Set([
  "id",
  "logo_url",
  "created_at",
  "updated_at",
  "logo_key",
  "taxflag", // Remove tax flag field
]);

const LABELS: Record<string, string> = {
  name: "Name",
  short_name: "Short Name",
  abbr_name: "Abbreviation",
  business_year_start: "Business Year Start",
  business_year_end: "Business Year End",
  email: "Email",
  phone: "Phone",
  phone_number: "Phone",
  website: "Website",
  address: "Address",
  post_office_box: "P.O. Box",
  district: "District",
  county: "County",
  sub_county: "Sub-county",
  sub_county_division: "Sub-county / Division",
  parish: "Parish",
  cell_village: "Cell / Village",
  registration_no: "Registration No.",
  inst_nssf_no: "Inst. NSSF Nr.",
  inst_paye_no: "Inst. PAYE Nr.",
  directions_and_comments: "Directions and Comments",
};

const FIELD_ORDER = [
  "name",
  "short_name",
  "abbr_name",
  "business_year_start",
  "business_year_end",
  "post_office_box",
  "phone",
  "phone_number",
  "email",
  "website",
  "address",
  "district",
  "county",
  "sub_county",
  "sub_county_division",
  "parish",
  "cell_village",
  "registration_no",
  "inst_nssf_no",
  "inst_paye_no",
  "directions_and_comments",
];

function toTitle(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function inputTypeFor(
  key: string,
  value: any
): React.InputHTMLAttributes<any>["type"] {
  const k = key.toLowerCase();
  if (k.includes("email")) return "email";
  if (k.includes("website") || k.includes("url")) return "url";
  if (k.endsWith("_date") || k === "start_date" || k === "end_date")
    return "date";
  if (typeof value === "number") return "number";
  return "text";
}

function normalizeForPatch(obj: Record<string, any>) {
  const out: Record<string, any> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (EXCLUDE_KEYS.has(k)) return;
    out[k] = v === "" ? null : v;
  });
  return out;
}

function shallowEqual(a: Record<string, any>, b: Record<string, any>) {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

/* ======================= Page ======================= */
export default function InstitutePage() {
  const { user } = useAuth();
  const instituteId: number | undefined = (user as any)?.institute_id;

  const [tab, setTab] = useState(0);

  /* -------- Institute details state -------- */
  const [data, setData] = useState<Institute | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  /* -------- Toasts -------- */
  const [toast, setToast] = useState<{
    severity: "success" | "error" | "info";
    msg: string;
  } | null>(null);

  /* -------- Form keys / dirty tracking -------- */
  const keys = useMemo(() => {
    if (!data) return [] as string[];
    const all = Object.keys(data).filter((k) => !EXCLUDE_KEYS.has(k));
    const ordered = FIELD_ORDER.filter((k) => all.includes(k));
    const leftovers = all
      .filter((k) => !FIELD_ORDER.includes(k))
      .sort((a, b) => a.localeCompare(b));
    return [...ordered, ...leftovers];
  }, [data]);

  const dirty = useMemo(() => {
    if (!data) return false;
    const baseline: Record<string, any> = {};
    keys.forEach((k) => (baseline[k] = data[k] ?? ""));
    return !shallowEqual(baseline, form);
  }, [data, form, keys]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!instituteId) return;
      setLoading(true);
      try {
        const r = await api.get<Institute>(
          `${INSTITUTE_ENDPOINT}${instituteId}/`
        );
        if (cancelled) return;
        setData(r.data);
        const initial: Record<string, any> = {};
        Object.entries(r.data).forEach(([k, v]) => {
          if (EXCLUDE_KEYS.has(k)) return;
          initial[k] = v ?? "";
        });
        setForm(initial);
      } catch (e: any) {
        if (!cancelled)
          setToast({ severity: "error", msg: e?.message ?? "Load failed" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [instituteId]);

  const save = async () => {
    if (!instituteId) return;
    try {
      setBusy(true);
      const body = normalizeForPatch(form);
      await api.patch(`${INSTITUTE_ENDPOINT}${instituteId}/`, body);
      const r = await api.get<Institute>(
        `${INSTITUTE_ENDPOINT}${instituteId}/`
      );
      setData(r.data);
      const refreshed: Record<string, any> = {};
      Object.entries(r.data).forEach(([k, v]) => {
        if (EXCLUDE_KEYS.has(k)) return;
        refreshed[k] = v ?? "";
      });
      setForm(refreshed);
      setToast({ severity: "success", msg: "Institute updated" });
    } catch (e: any) {
      setToast({ severity: "error", msg: e?.message ?? "Save failed" });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (!data) return;
    const baseline: Record<string, any> = {};
    Object.entries(data).forEach(([k, v]) => {
      if (EXCLUDE_KEYS.has(k)) return;
      baseline[k] = v ?? "";
    });
    setForm(baseline);
  };

  /* -------- Employee Functions state -------- */
  const [funcs, setFuncs] = useState<EmpFunction[]>([]);
  const [funcLoading, setFuncLoading] = useState(false);
  const [editRowId, setEditRowId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  // Create modal state
  const [openCreateFunc, setOpenCreateFunc] = useState(false);

  const loadFunctions = async () => {
    setFuncLoading(true);
    try {
      const r = await api.get<EmpFunction[]>("/api/employee-functions/");
      setFuncs(r.data);
    } catch (e: any) {
      setToast({
        severity: "error",
        msg: e?.response?.data?.detail ?? "Failed to load functions",
      });
    } finally {
      setFuncLoading(false);
    }
  };

  // Lazy-load functions on first open
  const [funcsLoaded, setFuncsLoaded] = useState(false);
  useEffect(() => {
    if (tab === 1 && !funcsLoaded) {
      loadFunctions().then(() => setFuncsLoaded(true));
    }
  }, [tab, funcsLoaded]);

  const startEdit = (row: EmpFunction) => {
    setEditRowId(row.id);
    setEditName(row.name);
  };

  const cancelEdit = () => {
    setEditRowId(null);
    setEditName("");
  };

  const saveEdit = async (id: number) => {
    try {
      await api.patch(`/api/employee-functions/${id}/`, { name: editName });
      cancelEdit();
      await loadFunctions();
      setToast({ severity: "success", msg: "Function updated" });
    } catch (e: any) {
      setToast({
        severity: "error",
        msg: e?.response?.data?.detail ?? "Update failed",
      });
    }
  };

  const deleteFunc = async (id: number) => {
    try {
      await api.delete(`/api/employee-functions/${id}/`);
      await loadFunctions();
      setToast({ severity: "success", msg: "Function deleted" });
    } catch (e: any) {
      setToast({
        severity: "error",
        msg: e?.response?.data?.detail ?? "Delete failed",
      });
    }
  };

  const funcCols: GridColDef<EmpFunction>[] = [
    { field: "id", headerName: "ID", width: 90 },
    {
      field: "name",
      headerName: "Function",
      flex: 1,
      minWidth: 220,
      renderCell: (params) => {
        const row = params.row;
        const editing = editRowId === row.id;
        if (editing) {
          return (
            <TextField
              size="small"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              fullWidth
            />
          );
        }
        return <span>{row.name}</span>;
      },
    },
    {
      field: "scope",
      headerName: "Scope",
      width: 130,
      valueGetter: (_v, r) => (r.scope === "global" ? "Default" : "Institute"),
    },
    {
      field: "actions",
      headerName: "",
      width: 200,
      sortable: false,
      filterable: false,
      renderCell: (params) => {
        const row = params.row;
        const isInstitute = row.scope === "institute";
        const editing = editRowId === row.id;

        if (!isInstitute) {
          return <em style={{ opacity: 0.6 }}>read-only</em>;
        }
        return editing ? (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              startIcon={<Save />}
              onClick={() => saveEdit(row.id)}
            >
              Save
            </Button>
            <Button size="small" startIcon={<Close />} onClick={cancelEdit}>
              Cancel
            </Button>
          </Box>
        ) : (
          <Box sx={{ display: "flex", gap: 1 }}>
            <Button
              size="small"
              startIcon={<Edit />}
              onClick={() => startEdit(row)}
            >
              Edit
            </Button>
            <Button
              size="small"
              color="error"
              startIcon={<Delete />}
              onClick={() => deleteFunc(row.id)}
            >
              Delete
            </Button>
          </Box>
        );
      },
    },
  ];

  if (!instituteId) {
    return (
      <Paper sx={{ p: 2 }}>
        <Alert severity="warning">
          Missing <code>user.institute_id</code> in AuthContext. Add it to the
          JWT/user payload so this page can load.
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box sx={{ mb: 2, display: "flex", alignItems: "center", gap: 2 }}>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Institute
        </Typography>
      </Box>

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Institute" />
        <Tab label="Employee Functions" />
      </Tabs>

      {/* ---------- Tab 0: Institute ---------- */}
      {tab === 0 && (
        <>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              mb: 1,
              gap: 1,
            }}
          >
            <Button onClick={reset} disabled={busy || !dirty}>
              Reset
            </Button>
            <Button
              variant="contained"
              onClick={save}
              disabled={busy || !dirty}
            >
              {busy ? "Saving…" : "Save"}
            </Button>
          </Box>

          {loading ? (
            <Box sx={{ display: "grid", placeItems: "center", minHeight: 200 }}>
              <CircularProgress />
            </Box>
          ) : (
            <Box
              sx={{
                display: "grid",
                gridTemplateColumns: { xs: "1fr", md: "280px 1fr" },
                gap: 3,
              }}
            >
              {/* Logo */}
              <PhotoBox
                mode="edit"
                entityId={data?.id}
                src={data?.logo_url}
                initialsText={data?.abbr_name ?? data?.name ?? "Institute"}
                buildUploadUrl={(id) => INSTITUTE_LOGO_UPLOAD_ENDPOINT(id!)}
                onUploaded={async () => {
                  const r = await api.get<Institute>(
                    `${INSTITUTE_ENDPOINT}${instituteId}/`
                  );
                  setData(r.data);
                }}
                onBlocked={() =>
                  setToast({ severity: "error", msg: "Not allowed" })
                }
              />

              {/* Dynamic fields */}
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
                }}
              >
                {keys.map((k) => {
                  // Special handling for business_year_start
                  if (k === "business_year_start") {
                    return (
                      <TextField
                        key={k}
                        label={LABELS[k] ?? toTitle(k)}
                        type="date"
                        value={form[k] ?? ""}
                        onChange={(e) => {
                          const start = e.target.value;
                          // Auto-calculate end date as start + 1 year - 1 day
                          let end = "";
                          if (start) {
                            const startDate = new Date(start + "T00:00:00");
                            if (!Number.isNaN(startDate.getTime())) {
                              const endDate = new Date(startDate);
                              endDate.setFullYear(endDate.getFullYear() + 1);
                              endDate.setDate(endDate.getDate() - 1);
                              end = endDate.toISOString().split("T")[0];
                            }
                          }
                          setForm((prev) => ({
                            ...prev,
                            business_year_start: start,
                            business_year_end: end,
                          }));
                        }}
                        InputLabelProps={{ shrink: true }}
                        required
                      />
                    );
                  }

                  // Special handling for business_year_end (read-only, auto-calculated)
                  if (k === "business_year_end") {
                    return (
                      <TextField
                        key={k}
                        label={LABELS[k] ?? toTitle(k)}
                        type="date"
                        value={form[k] ?? ""}
                        InputLabelProps={{ shrink: true }}
                        InputProps={{
                          readOnly: true,
                          sx: {
                            backgroundColor: "action.hover",
                            "& input": {
                              cursor: "default",
                            },
                          },
                        }}
                        helperText="Auto-calculated (start + 1 year - 1 day)"
                      />
                    );
                  }

                  // Special handling for multi-line fields
                  if (k === "directions_and_comments" || k === "address") {
                    return (
                      <TextField
                        key={k}
                        label={LABELS[k] ?? toTitle(k)}
                        type={inputTypeFor(k, form[k])}
                        value={form[k] ?? ""}
                        onChange={(e) =>
                          setForm((prev) => ({ ...prev, [k]: e.target.value }))
                        }
                        multiline
                        minRows={3}
                        sx={{ gridColumn: { xs: "1", md: "1 / -1" } }}
                      />
                    );
                  }

                  // Default rendering
                  return (
                    <TextField
                      key={k}
                      label={LABELS[k] ?? toTitle(k)}
                      type={inputTypeFor(k, form[k])}
                      value={form[k] ?? ""}
                      onChange={(e) =>
                        setForm((prev) => ({ ...prev, [k]: e.target.value }))
                      }
                      InputLabelProps={{
                        shrink:
                          inputTypeFor(k, form[k]) === "date"
                            ? true
                            : undefined,
                      }}
                    />
                  );
                })}
              </Box>
            </Box>
          )}
        </>
      )}

      {/* ---------- Tab 1: Employee Functions ---------- */}
      {tab === 1 && (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Typography variant="subtitle1">Employee Functions</Typography>
            <Button variant="contained" onClick={() => setOpenCreateFunc(true)}>
              Create
            </Button>
          </Box>

          <div style={{ height: 400, width: "100%" }}>
            <DataGrid
              rows={funcs}
              columns={funcCols}
              getRowId={(r) => r.id}
              loading={funcLoading}
              pageSizeOptions={[10, 25]}
              sx={{
                "& .MuiDataGrid-row:hover": {
                  backgroundColor: "rgba(21, 101, 192, 0.08)",
                  cursor: "pointer",
                },
              }}
            />
          </div>

          <Typography variant="caption" sx={{ opacity: 0.7 }}>
            Default functions are read-only. You can add, rename, or delete your
            institute’s custom functions.
          </Typography>
        </Box>
      )}

      {/* -------- Create Function Modal -------- */}
      <FunctionCreateDialog
        open={openCreateFunc}
        onClose={() => setOpenCreateFunc(false)}
        onCreated={async () => {
          setOpenCreateFunc(false);
          await loadFunctions();
          setToast({ severity: "success", msg: "Function created" });
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
    </Paper>
  );
}

/* ================= Function Create Dialog ================= */
function FunctionCreateDialog({
  open,
  onClose,
  onCreated,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  const mode: "create" = "create";

  const empty = (): EmpFunctionWrite => ({
    name: "",
  });

  const onSubmit = async (payload: EmpFunctionWrite) => {
    // backend infers institute from user; name is the only field
    await api.post("/api/employee-functions/", { name: payload.name });
  };

  return (
    <EntityFormDialog<EmpFunctionWrite, EmpFunction>
      title="Create Function"
      open={open}
      mode={mode}
      initial={undefined}
      emptyFactory={empty}
      mapInitialToWrite={(r) => ({ name: r?.name ?? "" })}
      onClose={onClose}
      onSubmit={onSubmit}
      onSuccess={onCreated}
      onError={onError}
      renderFields={(form, setForm) => (
        <Box sx={{ display: "grid", gap: 2 }}>
          <TextField
            autoFocus
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ name: e.target.value })}
            required
          />
        </Box>
      )}
    />
  );
}
