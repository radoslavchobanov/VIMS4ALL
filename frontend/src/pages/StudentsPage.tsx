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

// Shared, reusable building blocks
import { EntityFormDialog } from "../components/EntityFormDialog";
import { PhotoBox } from "../components/PhotoBox";
import { useChoices } from "../hooks/useChoices";

/* ================== OpenAPI Types ================== */
type StudentRead = components["schemas"]["StudentRead"];
type StudentWrite = components["schemas"]["StudentWrite"];

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

/* ================== Page ================== */
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
        "/api/students/",
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

/* ================== Students Form ================== */

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
  const choices = useChoices("/api/students/", ["gender", "marital_status"]);

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
      // For create you can still skip empty strings entirely if you want:
      const createBody = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== "" && v !== undefined)
      ) as Partial<StudentWrite>;
      await api.post("/api/students/", createBody);
    } else {
      const patchBody = toNullPatch(payload); // <-- key change
      await api.patch(`/api/students/${initial!.id}/`, patchBody);
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
          buildUploadUrl={(id) => `/api/students/${id}/photo/`} // <- your action endpoint
          onUploaded={(u) => setPhotoUrl(u)}
          onBlocked={() =>
            onError("Please create/save the student first, then add a photo.")
          }
        />
      }
      renderFields={(form, setForm) => (
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
              {(choices.gender ?? []).map((c) => (
                <MenuItem key={String(c.value)} value={c.value as any}>
                  {c.display_name}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              select
              label="Marital status"
              value={form.marital_status ?? ""}
              onChange={(e) =>
                setForm({ marital_status: e.target.value as any })
              }
            >
              <MenuItem value="">{/* empty */}</MenuItem>
              {(choices.marital_status ?? []).map((c) => (
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
      )}
    />
  );
}
