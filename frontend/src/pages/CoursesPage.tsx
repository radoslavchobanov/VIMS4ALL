import { useEffect, useState } from "react";
import {
  Paper,
  Typography,
  Box,
  Button,
  TextField,
  MenuItem,
  Snackbar,
  Alert,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

import { api } from "../lib/apiClient";
import type { components } from "../api/__generated__/vims-types";
import { EntityFormDialog } from "../components/EntityFormDialog";
import { useChoices } from "../hooks/useChoices";

/* ================== Types ================== */
type Course = components["schemas"]["Course"];
type CourseRead = Course;
type CourseWrite = Omit<Course, "id" | "created_at">;

type Page<T> = {
  results: T[];
  count?: number;
  next?: string | null;
  previous?: string | null;
};

/* ================== Constants / mapping ================== */
const F = {
  id: "id",
  name: "name",
  abbr_name: "abbr_name",
  classes_total: "classes_total",
  course_fee: "course_fee",
  certificate_type: "certificate_type",
  credits: "credits",
  hours_per_term: "hours_per_term",
  valid_from: "valid_from",
  valid_until: "valid_until",
  outcomes_text: "outcomes_text",
  prior_knowledge_text: "prior_knowledge_text",
  required_skills_text: "required_skills_text",
  weekly_lessons_text: "weekly_lessons_text",
} as const;

/* ================== Grid ================== */
type Row = { id: number; abbr_name: string; name: string; fee: string };

const columns: GridColDef<Row>[] = [
  { field: "abbr_name", headerName: "Abbr", width: 140 },
  { field: "name", headerName: "Course name", flex: 1, minWidth: 220 },
  { field: "fee", headerName: "Fee", width: 140 },
];

/* ================== Helpers ================== */
// CREATE: skip "" and undefined (backend will use defaults/nulls)
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

// PATCH: convert "" → null, drop only undefined (so clears work)
function toNullPatch<T extends Record<string, unknown>>(obj: T): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(obj) as (keyof T)[]).forEach((k) => {
    const v = obj[k];
    if (v === undefined) return;
    out[k] = (v === "" ? null : v) as any;
  });
  return out;
}

/* ================== Page ================== */
export default function CoursesPage() {
  const [list, setList] = useState<CourseRead[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [initial, setInitial] = useState<CourseRead | undefined>(undefined);
  const [toast, setToast] = useState<{
    severity: "success" | "error";
    msg: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<CourseRead[] | Page<CourseRead>>(
        "/api/courses/",
        {
          params: { page_size: 50 },
        }
      );
      const listData = Array.isArray(r.data) ? r.data : r.data.results ?? [];
      setList(listData);
      setRows(
        listData.map((c) => ({
          id: c.id,
          abbr_name: c.abbr_name,
          name: c.name,
          fee: c.course_fee,
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
    const c = list.find((x) => x.id === id);
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

/* ================== Form ================== */
function CoursesForm({
  open,
  initial,
  onClose,
  onCreated,
  onUpdated,
  onError,
}: {
  open: boolean;
  initial?: CourseRead;
  onClose: () => void;
  onCreated: () => void;
  onUpdated: () => void;
  onError: (msg: string) => void;
}) {
  const mode: "create" | "edit" = initial ? "edit" : "create";

  // OPTIONS choices for enums
  const choices = useChoices("/api/courses/", ["certificate_type"]);

  // Empty form factory (numbers as null so inputs can show "")
  const empty = (): CourseWrite =>
    ({
      [F.name]: "",
      [F.abbr_name]: "",
      [F.classes_total]: null,
      [F.course_fee]: "",
      [F.certificate_type]: undefined, // or null if your API allows null
      [F.credits]: null,
      [F.hours_per_term]: null,
      [F.valid_from]: null,
      [F.valid_until]: null,
      [F.outcomes_text]: "",
      [F.prior_knowledge_text]: "",
      [F.required_skills_text]: "",
      [F.weekly_lessons_text]: "",
    } as unknown as CourseWrite);

  const mapRead = (c: CourseRead): CourseWrite =>
    ({
      [F.name]: c.name ?? "",
      [F.abbr_name]: c.abbr_name ?? "",
      [F.classes_total]: c.classes_total ?? null,
      [F.course_fee]: c.course_fee ?? "",
      [F.certificate_type]: c.certificate_type as any,
      [F.credits]: c.credits ?? null,
      [F.hours_per_term]: c.hours_per_term ?? null,
      [F.valid_from]: c.valid_from ?? null,
      [F.valid_until]: c.valid_until ?? null,
      [F.outcomes_text]: c.outcomes_text ?? "",
      [F.prior_knowledge_text]: c.prior_knowledge_text ?? "",
      [F.required_skills_text]: c.required_skills_text ?? "",
      [F.weekly_lessons_text]: c.weekly_lessons_text ?? "",
    } as unknown as CourseWrite);

  const onSubmit = async (payload: CourseWrite) => {
    if (mode === "create") {
      await api.post("/api/courses/", normalizeCreate(payload));
    } else {
      await api.patch(
        `/api/courses/${(initial as CourseRead).id}/`,
        toNullPatch(payload)
      );
    }
  };

  // Handy getter so TextField can use "" when value is null/undefined
  const get = <K extends keyof CourseWrite>(form: CourseWrite, key: K) =>
    ((form as any)[key] ?? "") as string | number;

  // render
  return (
    <EntityFormDialog<CourseWrite, CourseRead>
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
      renderFields={(form, update) => (
        <>
          {/* Names */}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "2fr 1fr" },
            }}
          >
            <TextField
              label="Course name"
              value={get(form, F.name)}
              onChange={(e) => update({ [F.name]: e.target.value } as any)}
              required
            />
            <TextField
              label="Abbreviation"
              value={get(form, F.abbr_name)}
              onChange={(e) => update({ [F.abbr_name]: e.target.value } as any)}
              required
            />
          </Box>

          {/* Fee / Classes */}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
            }}
          >
            <TextField
              label="Course fee"
              type="text" // decimal as string to avoid locale/rounding issues
              value={get(form, F.course_fee)}
              onChange={(e) =>
                update({ [F.course_fee]: e.target.value } as any)
              }
              required
            />
            <TextField
              label="Classes total"
              type="number"
              value={get(form, F.classes_total)}
              onChange={(e) =>
                update({
                  [F.classes_total]:
                    e.target.value === "" ? null : Number(e.target.value),
                } as any)
              }
              inputProps={{ min: 0 }}
              required
            />
            <TextField
              select
              label="Certificate type"
              value={get(form, F.certificate_type)}
              onChange={(e) =>
                update({ [F.certificate_type]: e.target.value || null } as any)
              }
            >
              <MenuItem value="">{/* empty */}</MenuItem>
              {(choices.certificate_type ?? []).map((c) => (
                <MenuItem key={String(c.value)} value={c.value as any}>
                  {c.display_name}
                </MenuItem>
              ))}
            </TextField>
          </Box>

          {/* Credits / Hours */}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            }}
          >
            <TextField
              label="Credits"
              type="number"
              value={get(form, F.credits)}
              onChange={(e) =>
                update({
                  [F.credits]:
                    e.target.value === "" ? null : Number(e.target.value),
                } as any)
              }
              inputProps={{ min: 0 }}
            />
            <TextField
              label="Hours per term"
              type="number"
              value={get(form, F.hours_per_term)}
              onChange={(e) =>
                update({
                  [F.hours_per_term]:
                    e.target.value === "" ? null : Number(e.target.value),
                } as any)
              }
              inputProps={{ min: 0 }}
            />
          </Box>

          {/* Validity */}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            }}
          >
            <TextField
              label="Valid from"
              type="date"
              value={(form as any)[F.valid_from] ?? ""}
              onChange={(e) =>
                update({ [F.valid_from]: e.target.value || null } as any)
              }
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Valid until"
              type="date"
              value={(form as any)[F.valid_until] ?? ""}
              onChange={(e) =>
                update({ [F.valid_until]: e.target.value || null } as any)
              }
              InputLabelProps={{ shrink: true }}
            />
          </Box>

          {/* Rich text blocks */}
          <TextField
            label="Learning outcomes"
            multiline
            minRows={3}
            value={get(form, F.outcomes_text)}
            onChange={(e) =>
              update({ [F.outcomes_text]: e.target.value } as any)
            }
          />
          <TextField
            label="Prior knowledge"
            multiline
            minRows={3}
            value={get(form, F.prior_knowledge_text)}
            onChange={(e) =>
              update({ [F.prior_knowledge_text]: e.target.value } as any)
            }
          />
          <TextField
            label="Required skills"
            multiline
            minRows={3}
            value={get(form, F.required_skills_text)}
            onChange={(e) =>
              update({ [F.required_skills_text]: e.target.value } as any)
            }
          />
          <TextField
            label="Weekly lessons and their duration"
            multiline
            minRows={3}
            value={get(form, F.weekly_lessons_text)}
            onChange={(e) =>
              update({ [F.weekly_lessons_text]: e.target.value } as any)
            }
          />
        </>
      )}
    />
  );
}
