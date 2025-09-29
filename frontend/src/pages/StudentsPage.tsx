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
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import DeleteIcon from "@mui/icons-material/Delete";
import EditIcon from "@mui/icons-material/Edit";
import AddIcon from "@mui/icons-material/Add";

import { api } from "../lib/apiClient";
import type { components } from "../api/__generated__/vims-types";

// Shared building blocks you already have
import { EntityFormDialog } from "../components/EntityFormDialog";
import { PhotoBox } from "../components/PhotoBox";
import { useChoices } from "../hooks/useChoices";
import {
  STUDENTS_ENDPOINT,
  STUDENT_PHOTO_ENDPOINT,
  STUDENT_CUSTODIANS_ENDPOINT,
  STUDENT_STATUS_ENDPOINT,
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

type Row = { spin: string; given_name: string; family_name: string };
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
];

/* =============================================================================
   PAGE
============================================================================= */
export default function StudentsPage() {
  const [list, setList] = useState<StudentRead[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  // single dialog for create/edit
  const [openForm, setOpenForm] = useState(false);
  const [initial, setInitial] = useState<StudentRead | undefined>(undefined);
  const [toast, setToast] = useState<{
    severity: "success" | "error";
    msg: string;
  } | null>(null);

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
        listData.map((s) => ({
          spin: s.spin,
          given_name: s.first_name,
          family_name: s.last_name,
        }))
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

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
        <Typography variant="h6">Students</Typography>
        <Button variant="contained" onClick={openCreate}>
          Create Student
        </Button>
      </Box>

      <div style={{ height: 600, width: "100%" }}>
        <DataGrid<Row>
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.spin}
          pageSizeOptions={[25, 50, 100]}
          onRowClick={(params) => openEditBySpin((params.row as Row).spin)}
          sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
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

  return (
    <EntityFormDialog<StudentWrite, StudentRead>
      title={mode === "create" ? "Create Student" : "Edit Student"}
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
      { field: "first_name", headerName: "First name", flex: 1, minWidth: 120 },
      { field: "last_name", headerName: "Last name", flex: 1, minWidth: 120 },
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
            label="First name"
            value={form.first_name}
            onChange={(e) => setForm({ ...form, first_name: e.target.value })}
            required
          />
          <TextField
            label="Last name"
            value={form.last_name}
            onChange={(e) => setForm({ ...form, last_name: e.target.value })}
            required
          />
          <TextField
            select
            label="Relation"
            value={form.relation ?? ""}
            onChange={(e) => setForm({ ...form, relation: e.target.value })}
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
          >
            <MenuItem value="">{/* empty */}</MenuItem>
            <MenuItem value="male">Male</MenuItem>
            <MenuItem value="female">Female</MenuItem>
            <MenuItem value="other">Other / Unspecified</MenuItem>
          </TextField>

          <TextField
            label="Phone 1"
            value={form.phone_number_1 ?? ""}
            onChange={(e) =>
              setForm({ ...form, phone_number_1: e.target.value })
            }
          />
          <TextField
            label="Phone 2"
            value={form.phone_number_2 ?? ""}
            onChange={(e) =>
              setForm({ ...form, phone_number_2: e.target.value })
            }
          />
          <TextField
            label="Place of work"
            value={form.place_of_work ?? ""}
            onChange={(e) =>
              setForm({ ...form, place_of_work: e.target.value })
            }
          />
          <TextField
            label="Nationality"
            value={form.nationality ?? ""}
            onChange={(e) => setForm({ ...form, nationality: e.target.value })}
          />
          <TextField
            label="Country"
            value={form.country ?? ""}
            onChange={(e) => setForm({ ...form, country: e.target.value })}
          />
          <TextField
            label="Sub country"
            value={form.sub_country ?? ""}
            onChange={(e) => setForm({ ...form, sub_country: e.target.value })}
          />
          <TextField
            label="Parish"
            value={form.parish ?? ""}
            onChange={(e) => setForm({ ...form, parish: e.target.value })}
          />
          <TextField
            label="Cell"
            value={form.cell ?? ""}
            onChange={(e) => setForm({ ...form, cell: e.target.value })}
          />
        </Box>
        <TextField
          sx={{ mt: 2 }}
          label="Comments"
          multiline
          minRows={3}
          value={form.comments ?? ""}
          onChange={(e) => setForm({ ...form, comments: e.target.value })}
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

  const [terms, setTerms] = useState<AcademicTermRead[]>([]);
  const [classes, setClasses] = useState<CourseClassRead[]>([]);
  const [allowed, setAllowed] = useState<string[] | null>(null);
  const [allowedLoading, setAllowedLoading] = useState(false);

  const fetchAllowedNext = async () => {
    setAllowedLoading(true);
    try {
      const r = await api.get<string[]>(
        `${STUDENTS_ENDPOINT}${studentId}/statuses/allowed-next/`,
        { params: { t: Date.now() } } // cache-buster just in case
      );
      setAllowed(r.data ?? null);
    } catch {
      setAllowed(null);
    } finally {
      setAllowedLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(STUDENT_STATUS_ENDPOINT, {
        params: { student: studentId, page_size: 200 },
      });
      const data = Array.isArray(r.data) ? r.data : r.data.results ?? [];
      setRows(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    (async () => {
      await load();
      await fetchAllowedNext();
    })();
  }, [studentId]);

  useEffect(() => {
    if (rows.length) fetchAllowedNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows[0]?.id, rows[0]?.status]);

  useEffect(() => {
    // Load supporting lists; adjust endpoints if different
    api.get(TERMS_ENDPOINT, { params: { page_size: 200 } }).then((r) => {
      const data = Array.isArray(r.data) ? r.data : r.data.results ?? [];
      setTerms(data);
    });
    api
      .get(COURSE_CLASSES_COLLECTION_ENDPOINT, { params: { page_size: 200 } })
      .then((r) => {
        const data = Array.isArray(r.data) ? r.data : r.data.results ?? [];
        setClasses(data);
      });
    // Allowed next statuses (optional; if not available, fallback to a static list)
    api
      .get(`${STUDENTS_ENDPOINT}${studentId}/statuses/allowed-next/`)
      .then((r) => setAllowed(r.data as string[]))
      .catch(() => setAllowed(null));
  }, [studentId]);
  const cols: GridColDef<StudentStatusRead>[] = [
    { field: "status", headerName: "Status", flex: 1, minWidth: 140 },

    {
      field: "term_name",
      headerName: "Term",
      flex: 1,
      minWidth: 120,
      valueGetter: (_value, row) =>
        row.term?.name ?? (row as any).term_name ?? "",
    },

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

  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<StudentStatusWrite>({
    status: "" as any,
    term: null,
    course_class: null,
    note: "",
    effective_at: new Date().toISOString().slice(0, 16), // yyyy-MM-ddTHH:mm
  });

  const statusOptions = allowed ?? [
    // fallback; keep in sync with backend if you don’t have the allowed-next endpoint
    "enquire",
    "accepted",
    "no_show",
    "active",
    "retake",
    "failed",
    "graduate",
    "drop_out",
    "expelled",
    "not_accepted",
  ];

  const requiresTerm = form.status === "active" || form.status === "retake";

  const saveStatus = async () => {
    try {
      const payload: any = {
        status: form.status,
        note: form.note || "",
        effective_at: form.effective_at
          ? new Date(form.effective_at).toISOString()
          : undefined,
        term: requiresTerm ? form.term : form.term ?? null, // backend CheckConstraint protects this
        course_class: form.course_class ?? null,
      };
      await api.post(STUDENT_STATUS_ENDPOINT, {
        ...payload,
        student: studentId,
      });
      setAdding(false);
      setForm({
        status: "" as any,
        term: null,
        course_class: null,
        note: "",
        effective_at: new Date().toISOString().slice(0, 16),
      });

      await load();
      await fetchAllowedNext();
    } catch (e: any) {
      onError(e?.message ?? "Status change failed");
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
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
          }}
        >
          <TextField
            select
            label="Status"
            value={form.status ?? ""}
            onChange={(e) =>
              setForm({ ...form, status: e.target.value as any })
            }
            required
          >
            <MenuItem value="">{/* empty */}</MenuItem>
            {statusOptions.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Term"
            value={form.term ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                term: e.target.value ? Number(e.target.value) : null,
              })
            }
            disabled={!requiresTerm}
            helperText={
              requiresTerm ? "Required for ACTIVE/RETAKE" : "Optional"
            }
          >
            <MenuItem value="">{/* empty */}</MenuItem>
            {terms.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>

          <TextField
            select
            label="Course class"
            value={form.course_class ?? ""}
            onChange={(e) =>
              setForm({
                ...form,
                course_class: e.target.value ? Number(e.target.value) : null,
              })
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
            label="Effective at"
            type="datetime-local"
            value={form.effective_at}
            onChange={(e) => setForm({ ...form, effective_at: e.target.value })}
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="Note"
            value={form.note ?? ""}
            onChange={(e) => setForm({ ...form, note: e.target.value })}
            multiline
            minRows={2}
          />

          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Button variant="contained" onClick={saveStatus}>
              Save status
            </Button>
            <Button onClick={() => setAdding(false)}>Cancel</Button>
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
      />
    </Box>
  );
}
