import { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  MenuItem,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  LinearProgress,
  Tooltip,
  FormControlLabel,
  Checkbox,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";
import UploadFileIcon from "@mui/icons-material/UploadFile";

import { api } from "../lib/apiClient";
import type { components } from "../api/__generated__/vims-types";

// Shared building blocks you already have
import { EntityFormDialog } from "../components/EntityFormDialog";
import { PhotoBox } from "../components/PhotoBox";
import { useChoices } from "../hooks/useChoices";
import { useAuth } from "../auth/AuthContext";
import {
  STUDENTS_ENDPOINT,
  STUDENT_PHOTO_ENDPOINT,
  STUDENT_CUSTODIANS_ENDPOINT,
  STUDENT_STATUS_ENDPOINT,
  STUDENT_IMPORT_XLSX_ENDPOINT,
  STUDENT_IMPORT_TEMPLATE_ENDPOINT,
  TERMS_ENDPOINT,
  COURSE_CLASSES_COLLECTION_ENDPOINT,
} from "../lib/endpoints";

/* ================== OpenAPI Types (adjust if names differ) ================== */
type StudentRead = components["schemas"]["StudentRead"];
type StudentWrite = components["schemas"]["StudentWrite"];
type CustodianRead = components["schemas"]["StudentCustodian"] | any; // fallback any if not generated
type CustodianWrite = components["schemas"]["StudentCustodian"] | any;
type StudentStatusRead = components["schemas"]["StudentStatus"] | any;
type StudentStatusWrite = components["schemas"]["StudentStatus"] | any;
type AcademicTermRead = components["schemas"]["AcademicTerm"] | any;
type CourseClassRead = components["schemas"]["CourseClassRead"] | any;

type Row = {
  spin: string;
  given_name: string;
  family_name: string;
  current_status?: string | null;
  current_course_class_name?: string | null;
};
type Page<T> = {
  results: T[];
  count?: number;
  next?: string | null;
  previous?: string | null;
};

/* ================== DataGrid Columns ================== */
const columns: GridColDef<Row>[] = [
  { field: "spin", headerName: "SPIN", width: 160 },
  { field: "given_name", headerName: "Given name", flex: 1, minWidth: 140 },
  { field: "family_name", headerName: "Family name", flex: 1, minWidth: 140 },
  {
    field: "current_course_class_name",
    headerName: "Course Class",
    flex: 1,
    minWidth: 180,
    valueGetter: (_value, row: any) => row.current_course_class_name || "",
  },
  {
    field: "current_status",
    headerName: "Status",
    width: 140,
    valueGetter: (_value, row: any) => row.current_status || "",
  },
];

/* =============================================================================
   PAGE
============================================================================= */
export default function StudentsPage() {
  const { user, hasFunctionCode } = useAuth();
  const [list, setList] = useState<StudentRead[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [openImport, setOpenImport] = useState(false);

  // single dialog for create/edit
  const [openForm, setOpenForm] = useState(false);
  const [initial, setInitial] = useState<StudentRead | undefined>(undefined);
  const [toast, setToast] = useState<{
    severity: "success" | "error";
    msg: string;
  } | null>(null);

  // Move students state
  const [openMoveDialog, setOpenMoveDialog] = useState(false);
  const [currentTerm, setCurrentTerm] = useState<AcademicTermRead | null>(null);
  const [movingStudents, setMovingStudents] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<StudentRead[] | Page<StudentRead>>(
        STUDENTS_ENDPOINT,
        {
          params: { page_size: 50 },
        }
      );
      const listData = Array.isArray(r.data) ? r.data : r.data.results ?? [];
      setList(listData);
      setRows(
        listData.map((s: any) => ({
          spin: s.spin,
          given_name: s.first_name,
          family_name: s.last_name,
          current_status: s.current_status,
          current_course_class_name: s.current_course_class_name,
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    loadCurrentTerm();
  }, []);

  async function loadCurrentTerm() {
    try {
      const today = new Date().toISOString().split("T")[0];
      const r = await api.get<Page<AcademicTermRead>>(TERMS_ENDPOINT);
      const terms = Array.isArray(r.data) ? r.data : r.data.results ?? [];

      // Find current term (today falls within term dates)
      let current = terms.find((t: any) => {
        return t.start_date <= today && t.end_date >= today;
      });

      // If no current term, find the most recently ended term (for move students window)
      if (!current) {
        const endedTerms = terms
          .filter((t: any) => t.end_date < today)
          .sort((a: any, b: any) => new Date(b.end_date).getTime() - new Date(a.end_date).getTime());

        if (endedTerms.length > 0) {
          current = endedTerms[0];
        }
      }

      setCurrentTerm(current || null);
    } catch (err) {
      console.error("Failed to load current term:", err);
    }
  }

  function openCreate() {
    setInitial(undefined);
    setOpenForm(true);
  }

  function openEditBySpin(spin: string) {
    const s = list.find((x) => x.spin === spin);
    if (s) {
      setInitial(s);
      setOpenForm(true);
    }
  }

  async function handleMoveStudents() {
    if (!currentTerm?.id) return;

    setMovingStudents(true);
    try {
      const response = await api.post(
        `${TERMS_ENDPOINT}${currentTerm.id}/move-students/`
      );

      setOpenMoveDialog(false);
      setToast({
        severity: "success",
        msg: response.data.message || `Moved ${response.data.students_moved} students successfully.`,
      });
      load(); // Refresh student list
    } catch (err: any) {
      const errorMsg = err?.response?.data?.error || err?.message || "Failed to move students.";
      setToast({ severity: "error", msg: errorMsg });
    } finally {
      setMovingStudents(false);
    }
  }

  // Check if user can move students (director or registrar)
  const canMoveStudents =
    user?.role === "institute_admin" ||
    hasFunctionCode("director") ||
    hasFunctionCode("registrar");

  // Check if within 1 week after term end
  const canExecuteMove = useMemo(() => {
    if (!currentTerm?.end_date) return false;

    const today = new Date();
    const endDate = new Date(currentTerm.end_date);
    const oneWeekAfter = new Date(endDate);
    oneWeekAfter.setDate(oneWeekAfter.getDate() + 7);

    return today >= endDate && today <= oneWeekAfter;
  }, [currentTerm]);

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
        <Box>
          <Typography variant="h6">Students</Typography>
          {user?.institute?.name && (
            <Typography variant="caption" sx={{ color: "text.secondary" }}>
              {user.institute.name}
            </Typography>
          )}
        </Box>
        <Box sx={{ display: "flex", gap: 1 }}>
          {canMoveStudents && canExecuteMove && (
            <Button
              variant="outlined"
              color="primary"
              startIcon={<AddIcon />}
              onClick={() => setOpenMoveDialog(true)}
              sx={{ mr: 1 }}
            >
              Move Students to Next Class
            </Button>
          )}
          <Button
            variant="outlined"
            startIcon={<UploadFileIcon />}
            onClick={() => setOpenImport(true)}
          >
            Import XLSX
          </Button>
          <Button variant="contained" onClick={openCreate}>
            Create Student
          </Button>
        </Box>
      </Box>

      <div style={{ height: 600, width: "100%" }}>
        <DataGrid<Row>
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.spin}
          pageSizeOptions={[25, 50, 100]}
          onRowClick={(params) => openEditBySpin((params.row as Row).spin)}
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

      <StudentsForm
        open={openForm}
        initial={initial}
        onClose={() => setOpenForm(false)}
        onCreated={() => {
          setOpenForm(false);
          load();
          setToast({ severity: "success", msg: "Student created" });
        }}
        onUpdated={() => {
          setOpenForm(false);
          load();
          setToast({ severity: "success", msg: "Student updated" });
        }}
        onError={(m) => setToast({ severity: "error", msg: m })}
      />

      <ImportStudentsDialog
        open={openImport}
        onClose={() => setOpenImport(false)}
        onImported={(summary) => {
          setOpenImport(false);
          load(); // refresh grid
          setToast({
            severity: summary.created > 0 ? "success" : "info",
            msg:
              summary.created > 0
                ? `Imported ${summary.created} students`
                : "Validation completed (no records created)",
          });
        }}
        onError={(m) => setToast({ severity: "error", msg: m })}
      />

      {/* Move Students Confirmation Dialog */}
      <Dialog
        open={openMoveDialog}
        onClose={() => !movingStudents && setOpenMoveDialog(false)}
      >
        <DialogTitle>Move Students to Next Class</DialogTitle>
        <DialogContent>
          <Typography variant="body1" sx={{ mb: 2 }}>
            This will automatically progress all active students to the next class level for the upcoming term.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1, fontWeight: 600 }}>
            Important:
          </Typography>
          <Box sx={{ pl: 2 }}>
            <Typography variant="body2" color="text.secondary">
              • This action can only be performed ONCE per term
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Only students below the maximum class level will be moved
            </Typography>
            <Typography variant="body2" color="text.secondary">
              • Students will be automatically enrolled in the next class
            </Typography>
          </Box>
          {currentTerm && (
            <Typography variant="body2" sx={{ mt: 2 }}>
              Current term: {currentTerm.name}
            </Typography>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() => setOpenMoveDialog(false)}
            disabled={movingStudents}
          >
            Cancel
          </Button>
          <Button
            onClick={handleMoveStudents}
            variant="contained"
            color="primary"
            disabled={movingStudents}
          >
            {movingStudents ? "Moving..." : "Move Students"}
          </Button>
        </DialogActions>
      </Dialog>

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

/* =============================================================================
   DETAIL FORM WITH TABS
============================================================================= */
function StudentsForm({
  open,
  initial,
  onClose,
  onCreated,
  onUpdated,
  onError,
}: {
  open: boolean;
  initial?: StudentRead;
  onClose: () => void;
  onCreated: () => void;
  onUpdated: () => void;
  onError: (msg: string) => void;
}) {
  const mode: "create" | "edit" = initial ? "edit" : "create";
  const choices = useChoices(STUDENTS_ENDPOINT, ["gender", "marital_status"]);

  const [tab, setTab] = useState(0);
  useEffect(() => {
    // reset to General on open/change
    if (open) setTab(0);
  }, [open, initial?.id]);

  // local photo state for immediate refresh after upload
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    setPhotoUrl(initial?.photo_url ? `${initial.photo_url}` : undefined);
  }, [initial]);

  const empty = (): StudentWrite => ({
    first_name: "",
    last_name: "",
    date_of_birth: "",
    gender: null,
    marital_status: null,
    phone_number: "",
    email: "",
    nationality: "",
    national_id: "",
    previous_institute: "",
    grade_acquired: "",
    district: "",
    county: "",
    sub_county_division: "",
    parish: "",
    cell_village: "",
    entry_date: "",
    exit_date: "",
    comments: "",
    bank_name: "",
    bank_account_number: "",
  });

  const mapRead = (s: StudentRead): StudentWrite => ({
    first_name: s.first_name,
    last_name: s.last_name,
    date_of_birth: s.date_of_birth,
    gender: s.gender ?? null,
    marital_status: s.marital_status ?? null,
    phone_number: s.phone_number ?? "",
    email: s.email ?? "",
    nationality: s.nationality ?? "",
    national_id: s.national_id ?? "",
    previous_institute: s.previous_institute ?? "",
    grade_acquired: s.grade_acquired ?? "",
    district: s.district ?? "",
    county: s.county ?? "",
    sub_county_division: s.sub_county_division ?? "",
    parish: s.parish ?? "",
    cell_village: s.cell_village ?? "",
    entry_date: s.entry_date ?? "",
    exit_date: s.exit_date ?? "",
    comments: s.comments ?? "",
    bank_name: (s as any).bank_name ?? "",
    bank_account_number: (s as any).bank_account_number ?? "",
  });

  function toNullPatch<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const out: Partial<T> = {};
    (Object.keys(obj) as (keyof T)[]).forEach((k) => {
      const v = obj[k];
      if (v === undefined) return; // omit undefined
      out[k] = (v === "" ? null : v) as any; // "" -> null for ALL fields
    });
    return out;
  }

  const onSubmit = async (payload: StudentWrite) => {
    if (mode === "create") {
      const createBody = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== "" && v !== undefined)
      ) as Partial<StudentWrite>;
      await api.post(STUDENTS_ENDPOINT, createBody);
    } else {
      const patchBody = toNullPatch(payload);
      await api.patch(`${STUDENTS_ENDPOINT}${initial!.id}/`, patchBody);
    }
  };

  const dialogTitle = mode === "create" ? "Create Student" : "Edit Student";
  const dialogSubtitle =
    mode === "edit" && initial
      ? [
          `SPIN: ${initial.spin ?? ""}`,
          `Name: ${initial.first_name ?? ""} ${initial.last_name ?? ""}`.trim(),
        ]
      : undefined;

  return (
    <EntityFormDialog<StudentWrite, StudentRead>
      title={dialogTitle}
      subtitle={dialogSubtitle}
      open={open}
      mode={mode}
      initial={initial}
      emptyFactory={empty}
      mapInitialToWrite={mapRead}
      onClose={onClose}
      onSubmit={onSubmit}
      onSuccess={mode === "create" ? onCreated : onUpdated}
      onError={onError}
      sidebarSlot={
        <PhotoBox
          mode={mode}
          entityId={initial?.id}
          src={photoUrl}
          initialsText={`${initial?.first_name ?? ""} ${
            initial?.last_name ?? ""
          }`}
          buildUploadUrl={(id) => STUDENT_PHOTO_ENDPOINT(id)}
          onUploaded={(u) => setPhotoUrl(u)}
          onBlocked={() =>
            onError("Please create/save the student first, then add a photo.")
          }
        />
      }
      renderFields={(form, setForm) => (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
            <Tab label="General" />
            <Tab label="Custodians" disabled={mode === "create"} />
            <Tab label="Status" disabled={mode === "create"} />
          </Tabs>

          {tab === 0 && (
            <StudentGeneralTab
              form={form}
              setForm={setForm}
              choices={choices}
            />
          )}

          {tab === 1 && initial && (
            <StudentCustodiansTab
              studentId={initial.id as number}
              onError={onError}
            />
          )}

          {tab === 2 && initial && (
            <StudentStatusTab
              studentId={initial.id as number}
              onError={onError}
            />
          )}
        </>
      )}
    />
  );
}

/* =============================================================================
   IMPORT STUDENTS — DIALOG
============================================================================= */
type ImportRowOutcome = {
  row_number: number;
  action: "validated" | "created" | "skipped" | "error";
  errors?: Record<string, any> | null;
  instance_id?: number | null;
};
type ImportSummary = {
  created: number;
  validated: number;
  skipped: number;
  errors: number;
  total_rows: number;
  commit: boolean;
  atomic: boolean;
};
type ImportResponse = {
  summary: ImportSummary;
  rows: ImportRowOutcome[];
  expected_columns: string[];
};

export function ImportStudentsDialog({
  open,
  onClose,
  onImported,
  onError,
}: {
  open: boolean;
  onClose: () => void;
  onImported: (summary: ImportSummary) => void;
  onError: (msg: string) => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState<"idle" | "validating" | "importing">(
    "idle"
  );
  const [result, setResult] = useState<ImportResponse | null>(null);
  const [dlBusy, setDlBusy] = useState(false);

  useEffect(() => {
    if (open) {
      setFile(null);
      setBusy(false);
      setPhase("idle");
      setResult(null);
    }
  }, [open]);

  const templateUrl = `${
    api.defaults.baseURL ?? ""
  }${STUDENT_IMPORT_TEMPLATE_ENDPOINT}`;

  function formatErrors(errs?: Record<string, any> | null): string {
    if (!errs) return "";
    try {
      const parts: string[] = [];
      Object.entries(errs).forEach(([k, v]) => {
        const val = Array.isArray(v)
          ? v.join(", ")
          : typeof v === "object"
          ? JSON.stringify(v)
          : String(v);
        parts.push(`${k}: ${val}`);
      });
      return parts.join(" | ");
    } catch {
      return JSON.stringify(errs);
    }
  }

  async function handleImport() {
    if (!file) {
      onError("Please choose an .xlsx file.");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      onError("Only .xlsx files are supported.");
      return;
    }

    setBusy(true);
    setPhase("validating");
    setResult(null);

    try {
      const buildForm = () => {
        const f = new FormData();
        f.append("file", file);
        return f;
      };

      // 1) DRY-RUN VALIDATION
      const validateRes = await api.post<ImportResponse>(
        STUDENT_IMPORT_XLSX_ENDPOINT,
        buildForm(),
        {
          params: { commit: 0 },
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const validation = validateRes.data;
      // Show validation result regardless
      setResult(validation);

      if (validation.summary.errors > 0) {
        // Stop here; user sees errors table
        setBusy(false);
        setPhase("idle");
        return;
      }

      // 2) IMPORT (row-by-row; no atomic toggle in this UX)
      setPhase("importing");
      const importRes = await api.post<ImportResponse>(
        STUDENT_IMPORT_XLSX_ENDPOINT,
        buildForm(),
        {
          params: { commit: 1 },
          headers: { "Content-Type": "multipart/form-data" },
        }
      );

      const imported = importRes.data;
      setResult(imported);
      setBusy(false);
      setPhase("idle");
      onImported(imported.summary);
    } catch (e: any) {
      setBusy(false);
      setPhase("idle");
      onError(e?.response?.data?.detail ?? e?.message ?? "Import failed");
    }
  }

  async function downloadTemplate() {
    try {
      setDlBusy(true);
      const res = await api.get(STUDENT_IMPORT_TEMPLATE_ENDPOINT, {
        responseType: "blob", // <-- important
      });

      // Try to use server-provided filename
      const dispo = res.headers["content-disposition"] ?? "";
      let filename = "students_import_template.xlsx";
      const m = /filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/.exec(dispo);
      if (m && m[1]) filename = m[1].replace(/['"]/g, "");

      const blob = new Blob([res.data], {
        type:
          res.headers["content-type"] ??
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e: any) {
      onError(e?.message ?? "Template download failed");
    } finally {
      setDlBusy(false);
    }
  }

  const hasResult = !!result;
  const isValidating = phase === "validating";
  const isImporting = phase === "importing";

  const cols: GridColDef<ImportRowOutcome>[] = [
    { field: "row_number", headerName: "Row", width: 90 },
    { field: "action", headerName: "Action", width: 120 },
    {
      field: "errors",
      headerName: "Errors",
      flex: 1,
      minWidth: 320,
      valueGetter: (_v, row) => formatErrors(row.errors),
    },
    {
      field: "instance_id",
      headerName: "Student ID",
      width: 120,
      valueGetter: (_v, row) => row.instance_id ?? "",
    },
  ];

  const summary = result?.summary;
  const summarySeverity = !summary
    ? "info"
    : summary.commit
    ? summary.errors > 0
      ? ("warning" as const)
      : ("success" as const)
    : summary.errors > 0
    ? ("warning" as const)
    : ("info" as const);

  return (
    <Dialog
      open={open}
      onClose={busy ? undefined : onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Import Students (.xlsx)</DialogTitle>
      <DialogContent dividers>
        <Box sx={{ display: "grid", gap: 2 }}>
          <Alert severity="info">
            Required columns: <code>first_name</code>, <code>last_name</code>,{" "}
            <code>date_of_birth</code> (YYYY-MM-DD). Optional columns are
            supported and ignored if missing.
          </Alert>

          <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
            <Button
              variant="text"
              onClick={downloadTemplate}
              startIcon={<UploadFileIcon />}
              disabled={dlBusy}
            >
              {dlBusy ? "Downloading..." : "Download template"}
            </Button>

            <Tooltip title=".xlsx only">
              <label>
                <input
                  type="file"
                  accept=".xlsx"
                  style={{ display: "none" }}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <Button variant="outlined" component="span">
                  {file ? file.name : "Students.xlsx"}
                </Button>
              </label>
            </Tooltip>
          </Box>

          {(isValidating || isImporting) && <LinearProgress />}

          {hasResult && (
            <>
              <Alert severity={summarySeverity as any}>
                <strong>Summary</strong>: created {summary!.created}, validated{" "}
                {summary!.validated}, skipped {summary!.skipped}, errors{" "}
                {summary!.errors}. Total rows: {summary!.total_rows}.{" "}
                {summary!.commit ? "Import mode." : "Validation result."}
                {isValidating &&
                  summary!.errors === 0 &&
                  " Validation passed — proceeding to import..."}
              </Alert>

              <div style={{ width: "100%" }}>
                <DataGrid<ImportRowOutcome>
                  autoHeight
                  rows={result!.rows}
                  getRowId={(r) => r.row_number}
                  columns={cols}
                  disableRowSelectionOnClick
                  initialState={{
                    pagination: { paginationModel: { page: 0, pageSize: 25 } },
                  }}
                  pageSizeOptions={[25, 50, 100]}
                  sx={{
                    "& .MuiDataGrid-row:hover": {
                      backgroundColor: "rgba(21, 101, 192, 0.08)",
                      cursor: "pointer",
                    },
                  }}
                />
              </div>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>
          Close
        </Button>
        <Button
          variant="contained"
          onClick={handleImport}
          disabled={busy || !file}
        >
          {isValidating
            ? "Validating..."
            : isImporting
            ? "Importing..."
            : "Import"}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* =============================================================================
   TAB 1 — GENERAL (your fields, just extracted)
============================================================================= */
function StudentGeneralTab({
  form,
  setForm,
  choices,
}: {
  form: StudentWrite;
  setForm: (patch: Partial<StudentWrite>) => void;
  choices: any;
}) {
  return (
    <>
      {/* Names */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        <TextField
          label="Given name"
          value={form.first_name}
          onChange={(e) => setForm({ first_name: e.target.value })}
          required
        />
        <TextField
          label="Family name"
          value={form.last_name}
          onChange={(e) => setForm({ last_name: e.target.value })}
          required
        />
      </Box>

      {/* Dates */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
        }}
      >
        <TextField
          label="Date of birth"
          type="date"
          value={form.date_of_birth}
          onChange={(e) => setForm({ date_of_birth: e.target.value })}
          InputLabelProps={{ shrink: true }}
          required
        />
        <TextField
          label="Entry date"
          type="date"
          value={form.entry_date ?? ""}
          onChange={(e) => setForm({ entry_date: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Exit date"
          type="date"
          value={form.exit_date ?? ""}
          onChange={(e) => setForm({ exit_date: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />
      </Box>

      {/* Enums */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        <TextField
          select
          label="Gender"
          value={form.gender ?? ""}
          onChange={(e) => setForm({ gender: e.target.value as any })}
        >
          <MenuItem value="">{/* empty */}</MenuItem>
          {(choices.gender ?? []).map((c: any) => (
            <MenuItem key={String(c.value)} value={c.value as any}>
              {c.display_name}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Marital status"
          value={form.marital_status ?? ""}
          onChange={(e) => setForm({ marital_status: e.target.value as any })}
        >
          <MenuItem value="">{/* empty */}</MenuItem>
          {(choices.marital_status ?? []).map((c: any) => (
            <MenuItem key={String(c.value)} value={c.value as any}>
              {c.display_name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* Contacts */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        <TextField
          label="Phone"
          value={form.phone_number ?? ""}
          onChange={(e) => setForm({ phone_number: e.target.value })}
        />
        <TextField
          label="Email"
          type="email"
          value={form.email ?? ""}
          onChange={(e) => setForm({ email: e.target.value })}
        />
      </Box>

      {/* Identity / nationality */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        <TextField
          label="Nationality"
          value={form.nationality ?? ""}
          onChange={(e) => setForm({ nationality: e.target.value })}
        />
        <TextField
          label="National ID"
          value={form.national_id ?? ""}
          onChange={(e) => setForm({ national_id: e.target.value })}
        />
      </Box>

      {/* Previous institute / grade */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        <TextField
          label="Previous institute"
          value={form.previous_institute ?? ""}
          onChange={(e) => setForm({ previous_institute: e.target.value })}
        />
        <TextField
          label="Grade acquired"
          value={form.grade_acquired ?? ""}
          onChange={(e) => setForm({ grade_acquired: e.target.value })}
        />
      </Box>

      {/* Address */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        <TextField
          label="District"
          value={form.district ?? ""}
          onChange={(e) => setForm({ district: e.target.value })}
        />
        <TextField
          label="County"
          value={form.county ?? ""}
          onChange={(e) => setForm({ county: e.target.value })}
        />
      </Box>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        <TextField
          label="Sub-county/Division"
          value={form.sub_county_division ?? ""}
          onChange={(e) => setForm({ sub_county_division: e.target.value })}
        />
        <TextField
          label="Parish"
          value={form.parish ?? ""}
          onChange={(e) => setForm({ parish: e.target.value })}
        />
      </Box>
      <TextField
        label="Cell/Village"
        value={form.cell_village ?? ""}
        onChange={(e) => setForm({ cell_village: e.target.value })}
      />

      {/* Comments */}
      <TextField
        label="Comments"
        multiline
        minRows={3}
        value={form.comments ?? ""}
        onChange={(e) => setForm({ comments: e.target.value })}
      />
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        <TextField
          label="Bank name"
          value={(form as any).bank_name ?? ""}
          onChange={(e) => setForm({ bank_name: e.target.value } as any)}
        />
        <TextField
          label="Bank account number"
          value={(form as any).bank_account_number ?? ""}
          onChange={(e) =>
            setForm({ bank_account_number: e.target.value } as any)
          }
        />
      </Box>
    </>
  );
}

/* =============================================================================
   TAB 2 — CUSTODIANS (inline CRUD)
   Endpoints assumed:
     GET    /api/students/:id/custodians/
     POST   /api/students/:id/custodians/
     PATCH  /api/students/:id/custodians/:cid/
     DELETE /api/students/:id/custodians/:cid/
============================================================================= */
function StudentCustodiansTab({
  studentId,
  onError,
}: {
  studentId: number;
  onError: (msg: string) => void;
}) {
  const [rows, setRows] = useState<CustodianRead[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(STUDENT_CUSTODIANS_ENDPOINT, {
        params: { student: studentId, page_size: 200 },
      });
      const data = Array.isArray(r.data) ? r.data : r.data.results ?? [];
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [studentId]);

  const [edit, setEdit] = useState<CustodianRead | null>(null);
  const [openEditor, setOpenEditor] = useState(false);

  const cols: GridColDef<CustodianRead>[] = useMemo(
    () => [
      { field: "first_name", headerName: "Given name", flex: 1, minWidth: 120 },
      { field: "last_name", headerName: "Family name", flex: 1, minWidth: 120 },
      { field: "relation", headerName: "Relation", flex: 1, minWidth: 120 },
      { field: "phone_number_1", headerName: "Phone", flex: 1, minWidth: 140 },
      {
        field: "actions",
        headerName: "",
        width: 100,
        sortable: false,
        renderCell: (p) => (
          <Box>
            <IconButton
              size="small"
              onClick={() => {
                setEdit(p.row);
                setOpenEditor(true);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              color="error"
              onClick={async () => {
                try {
                  await api.delete(
                    `${STUDENT_CUSTODIANS_ENDPOINT}${p.row.id}/`
                  );
                  await load();
                } catch (e: any) {
                  onError(e?.message ?? "Delete failed");
                }
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Box>
        ),
      },
    ],
    [studentId]
  );

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: "flex", justifyContent: "flex-end", mb: 1 }}>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => {
            setEdit(null);
            setOpenEditor(true);
          }}
        >
          Add custodian
        </Button>
      </Box>

      <DataGrid
        autoHeight
        rows={rows}
        getRowId={(r) => r.id}
        columns={cols}
        loading={loading}
        disableRowSelectionOnClick
        sx={{
          "& .MuiDataGrid-row:hover": {
            backgroundColor: "rgba(21, 101, 192, 0.08)",
            cursor: "pointer",
          },
        }}
      />

      <CustodianEditorDialog
        open={openEditor}
        studentId={studentId}
        initial={edit}
        onClose={() => setOpenEditor(false)}
        onSaved={async () => {
          setOpenEditor(false);
          await load();
        }}
        onError={onError}
      />
    </Box>
  );
}

function CustodianEditorDialog({
  open,
  studentId,
  initial,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  studentId: number;
  initial: CustodianRead | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const mode: "create" | "edit" = initial ? "edit" : "create";
  const [form, setForm] = useState<CustodianWrite>({
    first_name: "",
    last_name: "",
    relation: "parent",
    gender: null,
    phone_number_1: "",
    phone_number_2: "",
    place_of_work: "",
    nationality: "",
    country: "",
    sub_country: "",
    parish: "",
    cell: "",
    comments: "",
  });

  useEffect(() => {
    if (initial) {
      setForm({
        first_name: initial.first_name ?? "",
        last_name: initial.last_name ?? "",
        relation: initial.relation ?? "parent",
        gender: initial.gender ?? null,
        phone_number_1: initial.phone_number_1 ?? "",
        phone_number_2: initial.phone_number_2 ?? "",
        place_of_work: initial.place_of_work ?? "",
        nationality: initial.nationality ?? "",
        country: initial.country ?? "",
        sub_country: initial.sub_country ?? "",
        parish: initial.parish ?? "",
        cell: initial.cell ?? "",
        comments: initial.comments ?? "",
      });
    } else {
      setForm({ ...form, first_name: "", last_name: "" });
    }
  }, [initial]);

  const save = async () => {
    try {
      if (mode === "create") {
        await api.post(STUDENT_CUSTODIANS_ENDPOINT, {
          ...form,
          student: studentId,
        });
      } else {
        await api.patch(
          `${STUDENT_CUSTODIANS_ENDPOINT}${(initial as any).id}/`,
          form
        );
      }
      onSaved();
    } catch (e: any) {
      onError(e?.message ?? "Save failed");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {mode === "create" ? "Add Custodian" : "Edit Custodian"}
      </DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          }}
        >
          <TextField
            label="Given name"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            required
            fullWidth
            margin="dense"
          />
          <TextField
            label="Family name"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            required
            fullWidth
            margin="dense"
          />
          <TextField
            select
            label="Relation"
            value={form.relation ?? ""}
            onChange={(e) => setForm({ ...form, relation: e.target.value })}
            fullWidth
            margin="dense"
          >
            <MenuItem value="parent">Parent</MenuItem>
            <MenuItem value="guardian">Guardian</MenuItem>
            <MenuItem value="sponsor">Sponsor</MenuItem>
          </TextField>
          <TextField
            select
            label="Gender"
            value={form.gender ?? ""}
            onChange={(e) => setForm({ ...form, gender: e.target.value })}
            fullWidth
            margin="dense"
          >
            <MenuItem value="">{/* empty */}</MenuItem>
            <MenuItem value="male">Male</MenuItem>
            <MenuItem value="female">Female</MenuItem>
          </TextField>

          <TextField
            label="Phone 1"
            value={form.phone_number_1 ?? ""}
            onChange={(e) =>
              setForm({ ...form, phone_number_1: e.target.value })
            }
            fullWidth
            margin="dense"
          />
          <TextField
            label="Phone 2"
            value={form.phone_number_2 ?? ""}
            onChange={(e) =>
              setForm({ ...form, phone_number_2: e.target.value })
            }
            fullWidth
            margin="dense"
          />
          <TextField
            label="Place of work"
            value={form.place_of_work ?? ""}
            onChange={(e) =>
              setForm({ ...form, place_of_work: e.target.value })
            }
            fullWidth
            margin="dense"
          />
          <TextField
            label="Nationality"
            value={form.nationality ?? ""}
            onChange={(e) => setForm({ ...form, nationality: e.target.value })}
            fullWidth
            margin="dense"
          />
          <TextField
            label="Country"
            value={form.country ?? ""}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
            fullWidth
            margin="dense"
          />
          <TextField
            label="Sub country"
            value={form.sub_country ?? ""}
            onChange={(e) => setForm({ ...form, sub_country: e.target.value })}
            fullWidth
            margin="dense"
          />
          <TextField
            label="Parish"
            value={form.parish ?? ""}
            onChange={(e) => setForm({ ...form, parish: e.target.value })}
            fullWidth
            margin="dense"
          />
          <TextField
            label="Cell"
            value={form.cell ?? ""}
            onChange={(e) => setForm({ ...form, cell: e.target.value })}
            fullWidth
            margin="dense"
          />
        </Box>
        <TextField
          sx={{ mt: 2 }}
          label="Comments"
          multiline
          minRows={3}
          value={form.comments ?? ""}
          onChange={(e) => setForm({ ...form, comments: e.target.value })}
          fullWidth
          margin="dense"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={save}>
          Save
        </Button>
      </DialogActions>
    </Dialog>
  );
}

/* =============================================================================
   TAB 3 — STATUS (history + add form)
   Endpoints assumed:
     GET    /api/students/:id/statuses/
     POST   /api/students/:id/statuses/
     (optional helper) GET /api/students/:id/statuses/allowed-next/
     (supporting lists) GET /api/terms/ , GET /api/course-classes/
============================================================================= */
function StudentStatusTab({
  studentId,
  onError,
}: {
  studentId: number;
  onError: (msg: string) => void;
}) {
  const [rows, setRows] = useState<StudentStatusRead[]>([]);
  const [loading, setLoading] = useState(false);

  // removed terms
  const [classes, setClasses] = useState<CourseClassRead[]>([]);
  const [allowed, setAllowed] = useState<string[] | null>(null);
  const [allowedLoading, setAllowedLoading] = useState(false);

  // Terminal/final statuses that allow changing course class again
  const TERMINAL_STATUSES = [
    "not_accepted",
    "no_show",
    "drop_out",
    "expelled",
    "graduate",
    "failed",
  ];

  // Statuses that lock the course class (active and beyond, but not terminal)
  const LOCKING_STATUSES = ["active", "retake"];

  // add-status form (no term now)
  const [adding, setAdding] = useState(false);
  const [statusErrors, setStatusErrors] = useState<string[]>([]);
  const [form, setForm] = useState<{
    status: string;
    course_class: number | null;
    note: string;
    effective_at: string; // yyyy-MM-ddTHH:mm
  }>({
    status: "",
    course_class: null,
    note: "",
    effective_at: new Date().toISOString().slice(0, 16),
  });

  // Track locked course class (if student has active/retake status in a class)
  const [lockedCourseClass, setLockedCourseClass] = useState<number | null>(
    null
  );

  // ---- data loaders ----
  const loadRows = async () => {
    setLoading(true);
    try {
      const r = await api.get(STUDENT_STATUS_ENDPOINT, {
        params: { student: studentId, page_size: 200 },
      });
      const data = Array.isArray(r.data) ? r.data : r.data.results ?? [];
      setRows(data);

      // Determine if there's a locked course class
      // Course is locked if student has "active" or "retake" status
      // Course can be changed before "active" (enquire, accepted) and after terminal states
      const activeStatusesByClass = new Map<number, any>();
      data.forEach((status: any) => {
        if (status.is_active) {
          const classId =
            typeof status.course_class === "object"
              ? status.course_class.id
              : status.course_class;
          if (!activeStatusesByClass.has(classId)) {
            activeStatusesByClass.set(classId, status);
          }
        }
      });

      // Check if any active status is a locking status (active or retake)
      let locked: number | null = null;
      for (const [classId, status] of activeStatusesByClass.entries()) {
        if (LOCKING_STATUSES.includes(status.status)) {
          locked = classId;
          break;
        }
      }

      setLockedCourseClass(locked);
    } finally {
      setLoading(false);
    }
  };

  const loadClasses = async () => {
    const r = await api.get(COURSE_CLASSES_COLLECTION_ENDPOINT, {
      params: { page_size: 200 },
    });
    const data = Array.isArray(r.data) ? r.data : r.data.results ?? [];
    setClasses(data);
  };

  const fetchAllowedNext = async (courseClassId: number) => {
    setAllowedLoading(true);
    try {
      const r = await api.get<string[]>(
        `${STUDENTS_ENDPOINT}${studentId}/statuses/allowed-next/`,
        { params: { course_class: courseClassId, t: Date.now() } }
      );
      const list = r.data ?? [];
      setAllowed(list);
      // auto-select first allowed (usually "active")
      if (list.length && !form.status) {
        setForm((f) => ({ ...f, status: list[0] }));
      }
    } catch {
      // fall back to hard-coded progression list only if endpoint fails entirely
      setAllowed([
        "active",
        "retake",
        "failed",
        "graduate",
        "drop_out",
        "expelled",
      ]);
    } finally {
      setAllowedLoading(false);
    }
  };

  // initial load
  useEffect(() => {
    (async () => {
      await Promise.all([loadRows(), loadClasses()]);
      // don't fetch allowed yet; needs a course_class first
      setAllowed(null);
      setForm({
        status: "",
        course_class: null,
        note: "",
        effective_at: new Date().toISOString().slice(0, 16),
      });
    })();
  }, [studentId]);

  // When adding a new status and there's a locked course class, autofill it
  useEffect(() => {
    if (adding && lockedCourseClass && !form.course_class) {
      setForm((f) => ({ ...f, course_class: lockedCourseClass }));
      fetchAllowedNext(lockedCourseClass);
    }
  }, [adding, lockedCourseClass]);

  // when rows change, if a class is selected refresh allowed for that class
  useEffect(() => {
    if (form.course_class) fetchAllowedNext(form.course_class);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows.length]);

  // ---- grid columns ----
  const cols: GridColDef<StudentStatusRead>[] = [
    {
      field: "term",
      headerName: "Term",
      flex: 1,
      minWidth: 140,
      valueGetter: (_value, row) => (row as any).term ?? "",
    },
    { field: "status", headerName: "Status", flex: 1, minWidth: 140 },
    {
      field: "class_name",
      headerName: "Course class",
      flex: 1,
      minWidth: 160,
      valueGetter: (_value, row) =>
        row.course_class?.name ??
        (row as any).class_name ??
        (row as any).course_class ??
        "",
    },
    { field: "note", headerName: "Note", flex: 1, minWidth: 200 },
    {
      field: "effective_at",
      headerName: "Effective at",
      flex: 1,
      minWidth: 160,
    },
  ];

  // ---- actions ----
  const onChangeClass = async (val: string) => {
    const cc = val ? Number(val) : null;
    setForm((f) => ({ ...f, course_class: cc, status: "" })); // reset status on class change
    setAllowed(null);
    if (cc) await fetchAllowedNext(cc);
  };

  const canSave = !!form.course_class && !!form.status && !allowedLoading;

  // Helper to parse DRF errors
  const parseDrfErrors = (err: any): string[] => {
    const data = err?.response?.data;

    if (typeof data === "string") return [data];
    if (Array.isArray(data)) return data.map(String);

    if (data && typeof data === "object") {
      const errors: string[] = [];

      if (data.detail) {
        errors.push(String(data.detail));
      }

      for (const [field, value] of Object.entries(data)) {
        if (field === "detail") continue;

        const isGlobal = field === "__all__" || field === "non_field_errors";

        if (Array.isArray(value)) {
          value.forEach((msg: any) => {
            errors.push(isGlobal ? String(msg) : `${field}: ${String(msg)}`);
          });
        } else if (typeof value === "string") {
          errors.push(isGlobal ? value : `${field}: ${value}`);
        } else if (value && typeof value === "object") {
          for (const [nestedKey, nestedValue] of Object.entries(
            value as Record<string, any>
          )) {
            if (Array.isArray(nestedValue)) {
              nestedValue.forEach((msg: any) => {
                errors.push(`${field}.${nestedKey}: ${String(msg)}`);
              });
            } else {
              errors.push(`${field}.${nestedKey}: ${String(nestedValue)}`);
            }
          }
        }
      }

      return errors.length ? errors : ["Validation failed."];
    }

    return [err?.message ?? "Status change failed"];
  };

  const saveStatus = async () => {
    setStatusErrors([]); // Clear previous errors
    try {
      if (!form.course_class) {
        setStatusErrors(["Select a course class first."]);
        return;
      }
      if (!form.status) {
        setStatusErrors(["Select a status."]);
        return;
      }

      const payload = {
        student: studentId,
        status: form.status,
        course_class: form.course_class,
        note: form.note || "",
        effective_at: form.effective_at
          ? new Date(form.effective_at).toISOString()
          : undefined,
      };

      await api.post(STUDENT_STATUS_ENDPOINT, payload);

      setAdding(false);
      setStatusErrors([]);
      setForm({
        status: "",
        course_class: null,
        note: "",
        effective_at: new Date().toISOString().slice(0, 16),
      });

      await loadRows();
      // allowed will be re-fetched by the rows effect if a class remains selected
    } catch (e: any) {
      const errors = parseDrfErrors(e);
      setStatusErrors(errors);
      onError(errors.join("; "));
    }
  };

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
        <Typography variant="subtitle1">Status History</Typography>
        <Button
          variant="outlined"
          startIcon={<AddIcon />}
          onClick={() => setAdding((s) => !s)}
        >
          {adding ? "Cancel" : "Add status"}
        </Button>
      </Box>

      {adding && (
        <Box
          sx={{
            p: 2,
            border: "1px solid",
            borderColor: "divider",
            borderRadius: 1,
            mb: 2,
          }}
        >
          {/* Error Alert Box */}
          {statusErrors.length > 0 && (
            <Alert
              severity="error"
              variant="filled"
              onClose={() => setStatusErrors([])}
              sx={{
                mb: 2,
                "& .MuiAlert-message": {
                  width: "100%",
                },
              }}
            >
              <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
                Validation Error{statusErrors.length > 1 ? "s" : ""}
              </Typography>
              {statusErrors.length === 1 ? (
                <Typography variant="body2">{statusErrors[0]}</Typography>
              ) : (
                <Box component="ul" sx={{ margin: 0, paddingLeft: 2 }}>
                  {statusErrors.map((msg, idx) => (
                    <li key={idx}>
                      <Typography variant="body2">{msg}</Typography>
                    </li>
                  ))}
                </Box>
              )}
            </Alert>
          )}

          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
            }}
          >
            {/* Course class is selected first */}
            <TextField
              select
              label="Course class"
              value={form.course_class ?? ""}
              onChange={(e) => onChangeClass(e.target.value)}
              required
              disabled={!!lockedCourseClass}
              helperText={
                lockedCourseClass
                  ? "Course class locked after becoming active. Change only after final status."
                  : ""
              }
            >
              <MenuItem value="">{/* empty */}</MenuItem>
              {classes.map((c) => (
                <MenuItem key={c.id} value={c.id}>
                  {c.name ?? c.id}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label="Status"
              value={form.status}
              onChange={(e) => setForm({ ...form, status: e.target.value })}
              required
              disabled={!form.course_class || allowedLoading}
              helperText={
                !form.course_class
                  ? "Select a class to load allowed statuses"
                  : allowedLoading
                  ? "Loading allowed statuses..."
                  : ""
              }
            >
              <MenuItem value="">{/* empty */}</MenuItem>
              {(allowed ?? []).map((s) => (
                <MenuItem key={s} value={s}>
                  {s}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Effective at"
              type="datetime-local"
              value={form.effective_at}
              onChange={(e) =>
                setForm({ ...form, effective_at: e.target.value })
              }
              InputLabelProps={{ shrink: true }}
            />

            <TextField
              label="Note"
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              multiline
              minRows={2}
            />

            <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              <Button
                variant="contained"
                onClick={saveStatus}
                disabled={!canSave}
              >
                Save status
              </Button>
              <Button
                onClick={() => {
                  setAdding(false);
                  setStatusErrors([]);
                }}
              >
                Cancel
              </Button>
            </Box>
          </Box>
        </Box>
      )}

      <DataGrid<StudentStatusRead>
        autoHeight
        rows={rows}
        getRowId={(r) => r.id}
        columns={cols}
        loading={loading}
        disableRowSelectionOnClick
        sx={{
          "& .MuiDataGrid-row:hover": {
            backgroundColor: "rgba(21, 101, 192, 0.08)",
            cursor: "pointer",
          },
        }}
      />
    </Box>
  );
}
