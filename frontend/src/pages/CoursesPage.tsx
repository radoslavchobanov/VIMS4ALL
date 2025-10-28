import { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  MenuItem,
  IconButton,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import EditIcon from "@mui/icons-material/Edit";
import GroupIcon from "@mui/icons-material/Group";
import DeleteIcon from "@mui/icons-material/Delete";

import { api } from "../lib/apiClient";
import type { components } from "../api/__generated__/vims-types";
import { EntityFormDialog } from "../components/EntityFormDialog";
import {
  COURSE_CLASSES_COLLECTION_ENDPOINT, // e.g. "/api/course-classes/"
  COURSE_INSTRUCTORS_ENDPOINT, // e.g. "/api/course-instructors/"
  COURSE_INSTRUCTORS_BY_CLASS_ENDPOINT, // e.g. (id)=> `/api/course-instructors/?course_class=${id}`
  COURSES_ENDPOINT, // e.g. "/api/courses/"
} from "../lib/endpoints";

/* ================== Types ================== */
type Course =
  | components["schemas"]["Course"]
  | {
      id: number;
      name: string;
      abbr_name: string;
      classes_total: number;
      created_at?: string;
      updated_at?: string;
    };

type CourseWrite = Pick<Course, "name" | "abbr_name" | "classes_total">;

type CourseClass =
  | components["schemas"]["CourseClassRead"]
  | {
      id: number;
      course: number;
      index: number; // 1..N
      name: string; // "${Course.name}-${index}"
      fee_amount?: string | null;
      certificate_type?: string | null;
      credits?: number | null;
      hours_per_term?: number | null;
      start_date?: string | null;
      end_date?: string | null;
      updated_at?: string;
    };

type CourseClassPatch = Partial<
  Pick<
    CourseClass,
    | "fee_amount"
    | "certificate_type"
    | "credits"
    | "hours_per_term"
    | "start_date"
    | "end_date"
  >
>;

type CourseInstructor =
  | components["schemas"]["CourseInstructor"]
  | {
      id: number | string;
      course_class: number;
      instructor: number | string;
      instructor_name?: string;
    };

/* ================== Helpers ================== */
function normalizeCreate<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(obj) as (keyof T)[]).forEach((k) => {
    const v = obj[k];
    if (v !== "" && v !== undefined) out[k] = v as any;
  });
  return out;
}
function toNullPatch<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(obj) as (keyof T)[]).forEach((k) => {
    const v = obj[k];
    if (v === undefined) return;
    out[k] = (v === "" ? null : v) as any;
  });
  return out;
}

/* ================== Grid (Courses) ================== */
type Row = { id: number; abbr_name: string; name: string; classes: number };

const columns: GridColDef<Row>[] = [
  { field: "abbr_name", headerName: "Abbr", width: 140 },
  { field: "name", headerName: "Course name", flex: 1, minWidth: 220 },
  { field: "classes", headerName: "# Classes", width: 130 },
];

/* ================== Page ================== */
export default function CoursesPage() {
  const [list, setList] = useState<Course[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [initial, setInitial] = useState<Course | undefined>(undefined);
  const [toast, setToast] = useState<{
    severity: "success" | "error";
    msg: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<Course[] | { results: Course[] }>(
        COURSES_ENDPOINT,
        { params: { page_size: 200 } }
      );
      const listData = Array.isArray(r.data) ? r.data : r.data.results ?? [];
      setList(listData);
      setRows(
        listData.map((c) => ({
          id: c.id as number,
          abbr_name: c.abbr_name,
          name: c.name,
          classes: c.classes_total,
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
  function openEditById(id: number) {
    const c = list.find((x) => Number(x.id) === id);
    if (c) {
      setInitial(c);
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
        <Typography variant="h6">Courses</Typography>
        <Button variant="contained" onClick={openCreate}>
          Create Course
        </Button>
      </Box>

      <div style={{ height: 600, width: "100%" }}>
        <DataGrid<Row>
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.id}
          pageSizeOptions={[25, 50, 100]}
          onRowClick={(params) => openEditById((params.row as Row).id)}
          sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
        />
      </div>

      <CoursesForm
        open={openForm}
        initial={initial}
        onClose={() => setOpenForm(false)}
        onCreated={() => {
          setOpenForm(false);
          load();
          setToast({ severity: "success", msg: "Course created" });
        }}
        onUpdated={() => {
          setOpenForm(false);
          load();
          setToast({ severity: "success", msg: "Course updated" });
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

/* ================== Form (with Classes tab on edit) ================== */
function CoursesForm({
  open,
  initial,
  onClose,
  onCreated,
  onUpdated,
  onError,
}: {
  open: boolean;
  initial?: Course;
  onClose: () => void;
  onCreated: () => void;
  onUpdated: () => void;
  onError: (msg: string) => void;
}) {
  const mode: "create" | "edit" = initial ? "edit" : "create";
  const [tab, setTab] = useState(0);
  useEffect(() => {
    if (open) setTab(0);
  }, [open, initial?.id]);

  const empty = (): CourseWrite => ({
    name: "",
    abbr_name: "",
    classes_total: 1,
  });

  const mapRead = (c: Course): CourseWrite => ({
    name: c.name ?? "",
    abbr_name: c.abbr_name ?? "",
    classes_total: c.classes_total ?? 1,
  });

  const onSubmit = async (payload: CourseWrite) => {
    if (mode === "create") {
      await api.post(COURSES_ENDPOINT, normalizeCreate(payload));
    } else {
      await api.patch(
        `${COURSES_ENDPOINT}${initial!.id}/`,
        toNullPatch(payload)
      );
    }
  };

  const get = <K extends keyof CourseWrite>(form: CourseWrite, key: K) =>
    ((form as any)[key] ?? "") as string | number;

  return (
    <EntityFormDialog<CourseWrite, Course>
      title={mode === "create" ? "Create Course" : "Edit Course"}
      open={open}
      mode={mode}
      initial={initial}
      emptyFactory={empty}
      mapInitialToWrite={mapRead}
      onClose={onClose}
      onSubmit={onSubmit}
      onSuccess={mode === "create" ? onCreated : onUpdated}
      onError={onError}
      maxWidth="1"
      renderFields={(form, update) => (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
            <Tab label="General" />
            <Tab label="Course Classes" disabled={mode === "create"} />
          </Tabs>

          {/* General */}
          {tab === 0 && (
            <>
              <Box
                sx={{
                  display: "grid",
                  gap: 2,
                  gridTemplateColumns: { xs: "1fr", md: "2fr 1fr 1fr" },
                }}
              >
                <TextField
                  label="Course name"
                  value={get(form, "name")}
                  onChange={(e) => update({ name: e.target.value } as any)}
                  required
                />
                <TextField
                  label="Abbreviation"
                  value={get(form, "abbr_name")}
                  onChange={(e) => update({ abbr_name: e.target.value } as any)}
                  required
                />
                <TextField
                  label="Classes total"
                  type="number"
                  inputProps={{ min: 1 }}
                  value={get(form, "classes_total")}
                  onChange={(e) =>
                    update({
                      classes_total:
                        e.target.value === ""
                          ? ("" as any)
                          : Number(e.target.value),
                    } as any)
                  }
                  required
                />
              </Box>
              <Typography variant="caption" sx={{ display: "block", mt: 1 }}>
                When you save, class rows{" "}
                <b>{(initial?.name ?? form.name) || "Course"}-1..N</b> are kept
                in sync automatically.
              </Typography>
            </>
          )}

          {/* Course Classes tab (edit per-class details) */}
          {tab === 1 && initial && (
            <CourseClassesTab
              courseId={initial.id as number}
              onError={onError}
            />
          )}
        </>
      )}
    />
  );
}

/* ================== Classes Tab ================== */
function CourseClassesTab({
  courseId,
  onError,
}: {
  courseId: number;
  onError: (msg: string) => void;
}) {
  const [rows, setRows] = useState<CourseClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [edit, setEdit] = useState<CourseClass | null>(null);

  const [instructorsOpen, setInstructorsOpen] = useState(false);
  const [manageClassId, setManageClassId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get<CourseClass[]>(
        `${COURSES_ENDPOINT}${courseId}/classes/`,
        { params: { page_size: 500 } }
      );
      setRows(Array.isArray(r.data) ? r.data : (r.data as any).results ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [courseId]);

  const cols: GridColDef<CourseClass>[] = useMemo(
    () => [
      { field: "index", headerName: "#", width: 20 },
      { field: "name", headerName: "Class name", flex: 1, minWidth: 150 },
      {
        field: "fee_amount",
        headerName: "Fee",
        width: 100,
        valueGetter: (_v, r) => r.fee_amount ?? "",
      },
      {
        field: "certificate_type",
        headerName: "Certificate",
        width: 120,
        valueGetter: (_v, r) => r.certificate_type ?? "",
      },
      {
        field: "credits",
        headerName: "Credits",
        width: 120,
        valueGetter: (_v, r) => r.credits ?? "",
      },
      {
        field: "hours_per_term",
        headerName: "Hours/term",
        width: 130,
        valueGetter: (_v, r) => r.hours_per_term ?? "",
      },
      {
        field: "start_date",
        headerName: "Start",
        width: 130,
        valueGetter: (_v, r) => r.start_date ?? "",
      },
      {
        field: "end_date",
        headerName: "End",
        width: 130,
        valueGetter: (_v, r) => r.end_date ?? "",
      },
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
                setEditorOpen(true);
              }}
            >
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                setManageClassId(p.row.id as number);
                setInstructorsOpen(true);
              }}
              title="Manage instructors"
            >
              <GroupIcon fontSize="small" />
            </IconButton>
          </Box>
        ),
      },
    ],
    []
  );

  return (
    <>
      <div style={{ width: "100%" }}>
        <DataGrid
          autoHeight
          rows={rows}
          getRowId={(r) => r.id}
          columns={cols}
          loading={loading}
          disableRowSelectionOnClick
          onRowClick={(p) => {
            setEdit(p.row);
            setEditorOpen(true);
          }}
          sx={{
            "& .MuiDataGrid-row": { cursor: "pointer" },
          }}
        />
      </div>

      {editorOpen && edit && (
        <CourseClassEditorDialog
          open={editorOpen}
          initial={edit}
          onClose={() => setEditorOpen(false)}
          onSaved={async () => {
            setEditorOpen(false);
            await load();
          }}
          onError={onError}
        />
      )}

      {instructorsOpen && manageClassId != null && (
        <InstructorsManagerDialog
          open={instructorsOpen}
          courseClassId={manageClassId}
          onClose={() => setInstructorsOpen(false)}
          onChanged={async () => {
            /* refresh if you show instructor counts */
          }}
        />
      )}
    </>
  );
}

/* ================== Class Editor Dialog (PATCH /course-classes/{id}/) ================== */
function CourseClassEditorDialog({
  open,
  initial,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  initial: CourseClass;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const [form, setForm] = useState<CourseClassPatch>({
    fee_amount: initial.fee_amount ?? "",
    certificate_type: initial.certificate_type ?? "",
    credits: initial.credits ?? null,
    hours_per_term: initial.hours_per_term ?? null,
    start_date: initial.start_date ?? null,
    end_date: initial.end_date ?? null,
  });

  useEffect(() => {
    if (open) {
      setForm({
        fee_amount: initial.fee_amount ?? "",
        certificate_type: initial.certificate_type ?? "",
        credits: initial.credits ?? null,
        hours_per_term: initial.hours_per_term ?? null,
        start_date: initial.start_date ?? null,
        end_date: initial.end_date ?? null,
      });
    }
  }, [open, initial.id]);

  const save = async () => {
    try {
      const body = toNullPatch(form);
      await api.patch(
        `${COURSE_CLASSES_COLLECTION_ENDPOINT}${initial.id}/`,
        body
      );
      onSaved();
    } catch (e: any) {
      onError(e?.message ?? "Save failed");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>Edit {initial.name}</DialogTitle>
      <DialogContent sx={{ pt: 2 }}>
        <Box
          sx={{
            display: "grid",
            gap: 2,
            gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          }}
        >
          <TextField
            label="Fee"
            value={(form.fee_amount ?? "") as string}
            onChange={(e) =>
              setForm((f) => ({ ...f, fee_amount: e.target.value }))
            }
          />
          <TextField
            label="Certificate type"
            value={(form.certificate_type ?? "") as string}
            onChange={(e) =>
              setForm((f) => ({ ...f, certificate_type: e.target.value }))
            }
          />
          <TextField
            label="Credits"
            type="number"
            value={(form.credits ?? "") as number | string}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                credits: e.target.value === "" ? null : Number(e.target.value),
              }))
            }
            inputProps={{ min: 0 }}
          />
          <TextField
            label="Hours per term"
            type="number"
            value={(form.hours_per_term ?? "") as number | string}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                hours_per_term:
                  e.target.value === "" ? null : Number(e.target.value),
              }))
            }
            inputProps={{ min: 0 }}
          />
          <TextField
            label="Start date"
            type="date"
            value={form.start_date ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, start_date: e.target.value || null }))
            }
            InputLabelProps={{ shrink: true }}
          />
          <TextField
            label="End date"
            type="date"
            value={form.end_date ?? ""}
            onChange={(e) =>
              setForm((f) => ({ ...f, end_date: e.target.value || null }))
            }
            InputLabelProps={{ shrink: true }}
          />
        </Box>
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

/* ================== (Optional) Instructors Manager (still class-scoped, no term) ================== */
// If you want to expose it from the Classes tab, wire a button to open this dialog.
// This version expects an API endpoint listing eligible instructors.
// Remove if you manage instructors elsewhere.

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
  const [eligible, setEligible] = useState<{ id: number; name: string }[]>([]);
  const [pick, setPick] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const [ciRes, eligibleRes] = await Promise.all([
        api.get(COURSE_INSTRUCTORS_BY_CLASS_ENDPOINT(courseClassId), {
          params: { page_size: 500 },
        }),
        api.get(`${COURSE_INSTRUCTORS_ENDPOINT}eligible-instructors/`),
      ]);
      const listCI = Array.isArray(ciRes.data)
        ? ciRes.data
        : (ciRes.data as any).results ?? [];
      setRows(listCI);
      setEligible(eligibleRes.data ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) load();
  }, [open, courseClassId]);

  const add = async () => {
    if (!pick) return;
    await api.post(COURSE_INSTRUCTORS_ENDPOINT, {
      course_class: courseClassId,
      instructor: /^\d+$/.test(pick) ? Number(pick) : pick,
    });
    setPick("");
    await load();
    onChanged();
  };
  const remove = async (id: number | string) => {
    await api.delete(`${COURSE_INSTRUCTORS_ENDPOINT}${id}/`);
    await load();
    onChanged();
  };

  const cols: GridColDef<CourseInstructor>[] = [
    {
      field: "instructor_name",
      headerName: "Instructor",
      flex: 1,
      minWidth: 240,
      valueGetter: (_v, r) =>
        (r as any).instructor_name ?? (r as any).instructor,
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
          onClick={() => remove(p.row.id)}
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
            {eligible.map((e) => (
              <MenuItem key={e.id} value={String(e.id)}>
                {e.name}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="outlined" onClick={add} disabled={!pick || loading}>
            Add
          </Button>
        </Box>

        <div style={{ width: "100%" }}>
          <DataGrid
            autoHeight
            rows={rows ?? []}
            getRowId={(r) => (r as any).id}
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
