// src/pages/TermsPage.tsx
import { useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Paper,
  Snackbar,
  Tab,
  Tabs,
  TextField,
  Typography,
  IconButton,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import AddIcon from "@mui/icons-material/Add";
import EditIcon from "@mui/icons-material/Edit";
import DeleteIcon from "@mui/icons-material/Delete";
import GroupIcon from "@mui/icons-material/Group";
import PersonAddAlt1Icon from "@mui/icons-material/PersonAddAlt1";

import { api } from "../lib/apiClient";
import { EntityFormDialog } from "../components/EntityFormDialog";

import {
  TERMS_ENDPOINT, // e.g. "/api/terms/"
  COURSES_ENDPOINT, // e.g. "/api/courses/"
  COURSE_CLASSES_COLLECTION_ENDPOINT, // e.g. "/api/course-classes/"
  COURSE_INSTRUCTORS_ENDPOINT,
  COURSE_INSTRUCTORS_BY_CLASS_ENDPOINT,
  COURSE_ELIGIBLE_INSTRUCTORS_ENDPOINT,
  COURSE_CLASSES_COLLECTION_BY_TERM_ENDPOINT,
} from "../lib/endpoints";

import type { components } from "../api/__generated__/vims-types";

type Page<T> = {
  results: T[];
  count?: number;
  next?: string | null;
  previous?: string | null;
};

// OpenAPI-backed types (adjust if your generator uses different names)
type AcademicTerm = components["schemas"]["AcademicTerm"] | any;
type AcademicTermWrite = {
  name: string;
  start_date: string; // YYYY-MM-DD
  end_date: string; // YYYY-MM-DD
  is_closed?: boolean;
};

type Course =
  | components["schemas"]["Course"]
  | {
      id: number | string;
      name: string;
      abbr_name: string;
      classes_total: number;
      course_fee: string;
    };

type CourseClass =
  | components["schemas"]["CourseClassRead"]
  | {
      id: number | string;
      course: number | string;
      term: number | string;
      name?: string | null;
      class_number: number;
    };

type CourseClassCreate =
  | components["schemas"]["CourseClassWrite"]
  | {
      course: number | string;
      term: number | string;
      class_number: number;
      name?: string | null;
    };

type CourseInstructor =
  | components["schemas"]["CourseInstructor"]
  | {
      id: number | string;
      course_class: number | string;
      instructor: number | string;
    };

type Employee =
  | components["schemas"]["EmployeeRead"]
  | {
      id: number | string;
      first_name: string;
      last_name: string;
    };

type EligibleInstructor = { id: number; name: string };

const courseClassUrl = (id: string | number) =>
  `${COURSE_CLASSES_COLLECTION_ENDPOINT}${id}/`;

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

  // MAIN GRID — no action buttons; single click opens modal
  const columns: GridColDef<AcademicTerm>[] = useMemo(
    () => [
      { field: "name", headerName: "Name", flex: 1, minWidth: 180 },
      { field: "start_date", headerName: "Start", width: 140 },
      { field: "end_date", headerName: "End", width: 140 },
      {
        field: "is_closed",
        headerName: "Closed",
        width: 110,
        valueGetter: (_v, r) => (r.is_closed ? "Yes" : "No"),
      },
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
          onRowClick={(p) => openEdit(p.row)} // single click opens modal
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

/* ----------------------------------------------------------------------------
   TERM FORM with TABS (General, Courses)
---------------------------------------------------------------------------- */
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

  // Tabs — mirror your StudentsPage behavior
  const [tab, setTab] = useState(0);
  useEffect(() => {
    if (open) setTab(0);
  }, [open, initial?.id]);

  const empty = (): AcademicTermWrite => ({
    name: "",
    start_date: "",
    end_date: "",
    is_closed: false,
  });

  const mapRead = (t: AcademicTerm): AcademicTermWrite => ({
    name: t.name ?? "",
    start_date: t.start_date ?? "",
    end_date: t.end_date ?? "",
    is_closed: !!t.is_closed,
  });

  const onSubmit = async (payload: AcademicTermWrite) => {
    if (mode === "create") {
      await api.post(TERMS_ENDPOINT, payload);
    } else {
      await api.patch(`${TERMS_ENDPOINT}${initial!.id}/`, payload);
    }
  };

  return (
    <EntityFormDialog<AcademicTermWrite, AcademicTerm>
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
            <Tab label="Courses" disabled={mode === "create"} />
          </Tabs>

          {tab === 0 && <TermGeneralTab form={form} setForm={setForm} />}

          {tab === 1 && initial && (
            <TermCoursesTab termId={initial.id as number} onError={onError} />
          )}
        </>
      )}
    />
  );
}

function TermGeneralTab({
  form,
  setForm,
}: {
  form: AcademicTermWrite;
  setForm: (patch: Partial<AcademicTermWrite>) => void;
}) {
  return (
    <>
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
          onChange={(e) => setForm({ name: e.target.value })}
          required
        />
        <TextField
          select
          label="Closed"
          value={form.is_closed ? "1" : "0"}
          onChange={(e) => setForm({ is_closed: e.target.value === "1" })}
        >
          <MenuItem value="0">No</MenuItem>
          <MenuItem value="1">Yes</MenuItem>
        </TextField>
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
  );
}

/* ----------------------------------------------------------------------------
   COURSES TAB — manage CourseClass for the given term
   (pattern like StudentCustodiansTab: grid + Add; edit/delete inside tab)
---------------------------------------------------------------------------- */
function TermCoursesTab({
  termId,
  onError,
}: {
  termId: number;
  onError: (msg: string) => void;
}) {
  const [courses, setCourses] = useState<Course[]>([]);
  const [rows, setRows] = useState<CourseClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [openInstructorMgr, setOpenInstructorMgr] = useState(false);
  const [manageClassId, setManageClassId] = useState<number | null>(null);

  const loadCourses = async () => {
    const r = await api.get<Course[] | Page<Course>>(COURSES_ENDPOINT, {
      params: { page_size: 500 },
    });
    const list = Array.isArray(r.data) ? r.data : r.data.results ?? [];
    setCourses(list);
  };

  const loadClasses = async () => {
    setLoading(true);
    try {
      const r = await api.get<CourseClass[] | Page<CourseClass>>(
        COURSE_CLASSES_COLLECTION_BY_TERM_ENDPOINT(termId),
        { params: { page_size: 500 } } // pagination still supported
      );
      const list = Array.isArray(r.data) ? r.data : r.data.results ?? [];
      setRows(list);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
    loadClasses();
  }, [termId]);

  const [edit, setEdit] = useState<CourseClass | null>(null);
  const [openEditor, setOpenEditor] = useState(false);

  const cols: GridColDef<CourseClass>[] = useMemo(
    () => [
      {
        field: "course",
        headerName: "Course",
        flex: 1,
        minWidth: 200,
        valueGetter: (_v, r) => {
          const c = courses.find((x) => String(x.id) === String(r.course));
          return c ? `${c.name} (${c.abbr_name})` : r.course;
        },
      },
      { field: "class_number", headerName: "Class #", width: 120 },
      { field: "name", headerName: "Label", flex: 1, minWidth: 180 },
      {
        field: "actions",
        headerName: "",
        width: 110,
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
                  await api.delete(courseClassUrl(p.row.id));
                  await loadClasses();
                } catch (e: any) {
                  onError(e?.message ?? "Delete failed");
                }
              }}
            >
              <DeleteIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => {
                setManageClassId(p.row.id as number);
                setOpenInstructorMgr(true);
              }}
              title="Manage instructors"
            >
              <GroupIcon fontSize="small" />
            </IconButton>
          </Box>
        ),
      },
    ],
    [courses]
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
          Add course
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

      <CourseClassEditorDialog
        open={openEditor}
        termId={termId}
        courses={courses}
        initial={edit}
        onClose={() => setOpenEditor(false)}
        onSaved={async () => {
          setOpenEditor(false);
          await loadClasses();
        }}
        onError={onError}
      />

      {openInstructorMgr && manageClassId != null && (
        <InstructorsManagerDialog
          open={openInstructorMgr}
          courseClassId={manageClassId}
          onClose={() => setOpenInstructorMgr(false)}
          onChanged={async () => {}}
        />
      )}
    </Box>
  );
}

function CourseClassEditorDialog({
  open,
  termId,
  courses,
  initial,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  termId: number;
  courses: Course[];
  initial: CourseClass | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const mode: "create" | "edit" = initial ? "edit" : "create";
  const [form, setForm] = useState<{
    course_id: number | string | "";
    class_number: number | "";
    name: string;
  }>({
    course_id: "",
    class_number: "",
    name: "",
  });

  useEffect(() => {
    if (initial) {
      setForm({
        course_id: initial.course ?? "",
        class_number: (initial.class_number as any) ?? "",
        name: initial.name ?? "",
      });
    } else {
      setForm({ course_id: "", class_number: "", name: "" });
    }
  }, [initial, open]);

  const save = async () => {
    try {
      if (!form.course_id) throw new Error("Course is required.");
      if (!form.class_number) throw new Error("Class number is required.");

      if (mode === "create") {
        const payload: CourseClassCreate = {
          course: form.course_id,
          term: termId,
          class_number: Number(form.class_number),
          name: form.name || undefined,
        };
        await api.post(COURSE_CLASSES_COLLECTION_ENDPOINT, payload);
      } else {
        const patchBody = {
          course: form.course_id,
          term: termId,
          class_number: Number(form.class_number),
          name: form.name || null,
        };
        await api.patch(courseClassUrl((initial as any).id), patchBody);
      }
      onSaved();
    } catch (e: any) {
      onError(e?.message ?? "Save failed");
    }
  };

  const selectedCourse = courses.find(
    (c) => String(c.id) === String(form.course_id)
  );
  const classesTotal = selectedCourse?.classes_total ?? undefined;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {mode === "create" ? "Add Course to Term" : "Edit Course in Term"}
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
            select
            label="Course"
            value={form.course_id}
            onChange={(e) =>
              setForm((f) => ({ ...f, course_id: e.target.value }))
            }
            required
          >
            <MenuItem value="">{/* empty */}</MenuItem>
            {courses.map((c) => (
              <MenuItem key={c.id} value={c.id}>
                {c.name} ({c.abbr_name})
              </MenuItem>
            ))}
          </TextField>

          <TextField
            label={`Class number${classesTotal ? ` (1..${classesTotal})` : ""}`}
            type="number"
            inputProps={{ min: 1 }}
            value={form.class_number}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                class_number: e.target.value ? Number(e.target.value) : "",
              }))
            }
            required
          />
        </Box>

        <TextField
          sx={{ mt: 2 }}
          label="Label (optional)"
          placeholder="e.g., Science – 10A"
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          fullWidth
        />

        {classesTotal ? (
          <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
            This course allows up to <b>{classesTotal}</b> classes per term.
          </Typography>
        ) : null}
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

function InstructorsManagerDialog({
  open,
  courseClassId,
  onClose,
  onChanged,
}: {
  open: boolean;
  courseClassId: number;
  onClose: () => void;
  onChanged: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<CourseInstructor[]>([]);
  const [employees, setEmployees] = useState<EligibleInstructor[]>([]);
  const [pick, setPick] = useState<string>(""); // store as string in UI

  const load = async () => {
    setLoading(true);
    try {
      const [ciRes, eligibleRes] = await Promise.all([
        api.get<CourseInstructor[] | Page<CourseInstructor>>(
          COURSE_INSTRUCTORS_BY_CLASS_ENDPOINT(courseClassId),
          { params: { page_size: 500 } }
        ),
        api.get<EligibleInstructor[]>(
          `${COURSE_INSTRUCTORS_ENDPOINT}eligible-instructors/`
        ),
      ]);
      const listCI = Array.isArray(ciRes.data)
        ? ciRes.data
        : ciRes.data.results ?? [];
      setRows(listCI);
      setEmployees(eligibleRes.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open, courseClassId]);

  const addInstructor = async () => {
    if (!pick) return;
    // Coerce to number if it looks numeric; otherwise send as-is
    const instructorId = /^\d+$/.test(pick) ? Number(pick) : pick;

    await api.post(COURSE_INSTRUCTORS_ENDPOINT, {
      course_class: courseClassId,
      instructor: instructorId,
    });
    setPick("");
    await load();
    onChanged();
  };

  const removeInstructor = async (rowId: number | string) => {
    await api.delete(`${COURSE_INSTRUCTORS_ENDPOINT}${rowId}/`);
    await load();
    onChanged();
  };

  const nameById = (id: number | string) => {
    const s = String(id);
    const e = employees.find((x) => String(x.id) === s);
    return e ? e.name : s;
  };

  const cols: GridColDef<CourseInstructor>[] = [
    {
      field: "instructor",
      headerName: "Instructor",
      flex: 1,
      minWidth: 240,
      valueGetter: (_v, r) => nameById((r as any).instructor),
    },
    {
      field: "actions",
      headerName: "",
      width: 100,
      sortable: false,
      renderCell: (p) => (
        <IconButton
          size="small"
          color="error"
          onClick={() => removeInstructor(p.row.id)}
          title="Remove"
        >
          <DeleteIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Instructors</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "1fr auto" },
            mb: 2,
          }}
        >
          <TextField
            select
            label="Add instructor"
            value={pick}
            onChange={(e) => setPick(e.target.value)}
          >
            <MenuItem value="" />
            {employees.map((e) => (
              <MenuItem key={e.id} value={String(e.id)}>
                {e.name}
              </MenuItem>
            ))}
          </TextField>
          <Button
            variant="outlined"
            startIcon={<PersonAddAlt1Icon />}
            onClick={addInstructor}
            disabled={!pick || loading}
          >
            Add
          </Button>
        </Box>

        <div style={{ width: "100%" }}>
          <DataGrid
            autoHeight
            rows={rows}
            getRowId={(r) => r.id}
            columns={cols}
            loading={loading}
            disableRowSelectionOnClick
          />
        </div>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
