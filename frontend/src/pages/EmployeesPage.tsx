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
  Tabs,
  Tab,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
} from "@mui/material";
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
} from "@mui/icons-material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";
import { api } from "../lib/apiClient";
import type { components } from "../api/__generated__/vims-types";

import { EntityFormDialog } from "../components/EntityFormDialog";
import { PhotoBox } from "../components/PhotoBox";
import { useChoices } from "../hooks/useChoices";
import {
  EMPLOYEES_ENDPOINT,
  EMPLOYEE_PHOTO_ENDPOINT,
  EMPLOYEE_DEPENDENTS_ENDPOINT,
  EMPLOYEE_CAREERS_ENDPOINT,
  EMPLOYEE_FUNCTIONS_ENDPOINT,
} from "../lib/endpoints";

/* ================== OpenAPI Types ================== */
type EmployeeRead = components["schemas"]["EmployeeRead"];
type EmployeeWrite = components["schemas"]["EmployeeWrite"];

type Page<T> = {
  results: T[];
  count?: number;
  next?: string | null;
  previous?: string | null;
};

/* ================== Field map (string literals; use `as any` when indexing) ================== */
const F = {
  id: "id",
  epin: "epin",
  first_name: "first_name",
  last_name: "last_name",
  date_of_birth: "date_of_birth",
  gender: "gender",
  family_state: "family_state",
  phone_number: "phone_number",
  email: "email",
  national_id: "national_id",
  nssf_id: "nssf_id",
  paye_id: "paye_id",
  nationality: "nationality",
  district: "district",
  country: "country",
  sub_country: "sub_country",
  parish: "parish",
  cell_village: "cell_village",
  previous_employer: "previous_employer",
  entry_date: "entry_date",
  exit_date: "exit_date",
  comments: "comments",
  // not in OpenAPI yet but supported by UI/back-end endpoint
  photo_url: "photo_url",
} as const;

/* ================== DataGrid ================== */
type Row = { epin: string; given_name: string; family_name: string };

const columns: GridColDef<Row>[] = [
  { field: "epin", headerName: "EPIN", width: 160 },
  { field: "given_name", headerName: "Given name", flex: 1, minWidth: 140 },
  { field: "family_name", headerName: "Family name", flex: 1, minWidth: 140 },
];

const today = () => new Date().toISOString().slice(0, 10); // YYYY-MM-DD

function confirmAction(msg: string) {
  return window.confirm(msg);
}

/* ================== Helpers ================== */
// CREATE: skip "" and undefined
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
export default function EmployeesPage() {
  const [list, setList] = useState<EmployeeRead[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const [openForm, setOpenForm] = useState(false);
  const [initial, setInitial] = useState<EmployeeRead | undefined>(undefined);
  const [toast, setToast] = useState<{
    severity: "success" | "error";
    msg: string;
  } | null>(null);

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<EmployeeRead[] | Page<EmployeeRead>>(
        EMPLOYEES_ENDPOINT,
        { params: { page_size: 50 } }
      );
      const listData = Array.isArray(r.data) ? r.data : r.data.results ?? [];
      setList(listData);
      setRows(
        listData.map((e) => ({
          epin: (e as any)[F.epin] as string,
          given_name: (e as any)[F.first_name] as string,
          family_name: (e as any)[F.last_name] as string,
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

  function openEditByEPIN(epin: string) {
    const emp = list.find((x) => (x as any)[F.epin] === epin);
    if (emp) {
      setInitial(emp);
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
        <Typography variant="h6">Employees</Typography>
        <Button variant="contained" onClick={openCreate}>
          Create Employee
        </Button>
      </Box>

      <div style={{ height: 600, width: "100%" }}>
        <DataGrid<Row>
          rows={rows}
          columns={columns}
          loading={loading}
          getRowId={(r) => r.epin}
          pageSizeOptions={[25, 50, 100]}
          onRowClick={(params) => openEditByEPIN((params.row as Row).epin)}
          sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
        />
      </div>

      <EmployeesForm
        open={openForm}
        initial={initial}
        onClose={() => setOpenForm(false)}
        onCreated={() => {
          setOpenForm(false);
          load();
          setToast({ severity: "success", msg: "Employee created" });
        }}
        onUpdated={() => {
          setOpenForm(false);
          load();
          setToast({ severity: "success", msg: "Employee updated" });
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

/* ================== Employees Form ================== */
function EmployeesForm({
  open,
  initial,
  onClose,
  onCreated,
  onUpdated,
  onError,
}: {
  open: boolean;
  initial?: EmployeeRead;
  onClose: () => void;
  onCreated: () => void;
  onUpdated: () => void;
  onError: (msg: string) => void;
}) {
  const mode: "create" | "edit" = initial ? "edit" : "create";
  const choices = useChoices(EMPLOYEES_ENDPOINT, ["gender", "family_state"]);

  const [tab, setTab] = useState(0);
  useEffect(() => {
    if (open) setTab(0);
  }, [open, (initial as any)?.id]);

  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    const any = (initial as any) ?? {};
    setPhotoUrl(any.photo_url ? String(any.photo_url) : undefined);
  }, [initial]);

  const empty = (): EmployeeWrite =>
    ({
      first_name: "",
      last_name: "",
      date_of_birth: "",
      gender: null,
      family_state: null,
      phone_number: "",
      email: "",
      national_id: "",
      nssf_id: "",
      paye_id: "",
      nationality: "",
      district: "",
      country: "",
      sub_country: "",
      parish: "",
      cell_village: "",
      previous_employer: "",
      entry_date: "",
      exit_date: "",
      comments: "",
    } as unknown as EmployeeWrite);

  const mapRead = (e: EmployeeRead): EmployeeWrite => {
    const any = e as any;
    return {
      first_name: any.first_name ?? "",
      last_name: any.last_name ?? "",
      date_of_birth: any.date_of_birth ?? "",
      gender: any.gender ?? null,
      family_state: any.family_state ?? null,
      phone_number: any.phone_number ?? "",
      email: any.email ?? "",
      national_id: any.national_id ?? "",
      nssf_id: any.nssf_id ?? "",
      paye_id: any.paye_id ?? "",
      nationality: any.nationality ?? "",
      district: any.district ?? "",
      country: any.country ?? "",
      sub_country: any.sub_country ?? "",
      parish: any.parish ?? "",
      cell_village: any.cell_village ?? "",
      previous_employer: any.previous_employer ?? "",
      entry_date: any.entry_date ?? "",
      exit_date: any.exit_date ?? "",
      comments: any.comments ?? "",
    } as EmployeeWrite;
  };

  // helpers already used on your Students page
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

  const onSubmit = async (payload: EmployeeWrite) => {
    if (mode === "create") {
      await api.post(EMPLOYEES_ENDPOINT, normalizeCreate(payload));
    } else {
      const id = (initial as any).id;
      await api.patch(`${EMPLOYEES_ENDPOINT}${id}/`, toNullPatch(payload));
    }
  };

  return (
    <EntityFormDialog<EmployeeWrite, EmployeeRead>
      title={mode === "create" ? "Create Employee" : "Edit Employee"}
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
          entityId={(initial as any)?.id}
          src={photoUrl}
          initialsText={`${(initial as any)?.first_name ?? ""} ${
            (initial as any)?.last_name ?? ""
          }`}
          buildUploadUrl={(id) => EMPLOYEE_PHOTO_ENDPOINT(id)}
          onUploaded={(u) => setPhotoUrl(u)}
          onBlocked={() =>
            onError("Please create/save the employee first, then add a photo.")
          }
        />
      }
      renderFields={(form, setForm) => (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
            <Tab label="General" />
            <Tab label="Dependents" disabled={mode === "create"} />
            <Tab label="Career" disabled={mode === "create"} />
          </Tabs>

          {tab === 0 && (
            <EmployeeGeneralTab
              form={form}
              setForm={setForm}
              choices={choices}
            />
          )}

          {tab === 1 && initial && (
            <EmployeeDependentsTab
              employeeId={(initial as any).id}
              onError={onError}
            />
          )}

          {tab === 2 && initial && (
            <EmployeeCareerTab
              employeeId={(initial as any).id}
              onError={onError}
            />
          )}
        </>
      )}
    />
  );
}
function EmployeeGeneralTab({
  form,
  setForm,
  choices,
}: {
  form: EmployeeWrite;
  setForm: (patch: Partial<EmployeeWrite>) => void;
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
          value={(form as any).first_name ?? ""}
          onChange={(e) => setForm({ first_name: e.target.value } as any)}
          required
        />
        <TextField
          label="Family name"
          value={(form as any).last_name ?? ""}
          onChange={(e) => setForm({ last_name: e.target.value } as any)}
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
          value={(form as any).date_of_birth ?? ""}
          onChange={(e) => setForm({ date_of_birth: e.target.value } as any)}
          InputLabelProps={{ shrink: true }}
          required
        />
        <TextField
          label="Entry date"
          type="date"
          value={(form as any).entry_date ?? ""}
          onChange={(e) => setForm({ entry_date: e.target.value } as any)}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Exit date"
          type="date"
          value={(form as any).exit_date ?? ""}
          onChange={(e) => setForm({ exit_date: e.target.value } as any)}
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
          value={(form as any).gender ?? ""}
          onChange={(e) => setForm({ gender: e.target.value as any } as any)}
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
          label="Family state"
          value={(form as any).family_state ?? ""}
          onChange={(e) =>
            setForm({ family_state: e.target.value as any } as any)
          }
        >
          <MenuItem value="">{/* empty */}</MenuItem>
          {(choices.family_state ?? []).map((c: any) => (
            <MenuItem key={String(c.value)} value={c.value as any}>
              {c.display_name}
            </MenuItem>
          ))}
        </TextField>
      </Box>

      {/* Contacts / IDs */}
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        <TextField
          label="Phone"
          value={(form as any).phone_number ?? ""}
          onChange={(e) => setForm({ phone_number: e.target.value } as any)}
        />
        <TextField
          label="Email"
          type="email"
          value={(form as any).email ?? ""}
          onChange={(e) => setForm({ email: e.target.value } as any)}
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
          label="National ID"
          value={(form as any).national_id ?? ""}
          onChange={(e) => setForm({ national_id: e.target.value } as any)}
        />
        <TextField
          label="Nationality"
          value={(form as any).nationality ?? ""}
          onChange={(e) => setForm({ nationality: e.target.value } as any)}
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
          label="NSSF ID"
          value={(form as any).nssf_id ?? ""}
          onChange={(e) => setForm({ nssf_id: e.target.value } as any)}
        />
        <TextField
          label="PAYE ID"
          value={(form as any).paye_id ?? ""}
          onChange={(e) => setForm({ paye_id: e.target.value } as any)}
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
          label="Country"
          value={(form as any).country ?? ""}
          onChange={(e) => setForm({ country: e.target.value } as any)}
        />
        <TextField
          label="District"
          value={(form as any).district ?? ""}
          onChange={(e) => setForm({ district: e.target.value } as any)}
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
          label="Sub-country"
          value={(form as any).sub_country ?? ""}
          onChange={(e) => setForm({ sub_country: e.target.value } as any)}
        />
        <TextField
          label="Parish"
          value={(form as any).parish ?? ""}
          onChange={(e) => setForm({ parish: e.target.value } as any)}
        />
      </Box>
      <TextField
        label="Cell/Village"
        value={(form as any).cell_village ?? ""}
        onChange={(e) => setForm({ cell_village: e.target.value } as any)}
      />

      {/* Employment history */}
      <TextField
        label="Previous employer"
        value={(form as any).previous_employer ?? ""}
        onChange={(e) => setForm({ previous_employer: e.target.value } as any)}
      />

      {/* Comments */}
      <TextField
        label="Comments"
        multiline
        minRows={3}
        value={(form as any).comments ?? ""}
        onChange={(e) => setForm({ comments: e.target.value } as any)}
      />
    </>
  );
}

function EmployeeDependentsTab({
  employeeId,
  onError,
}: {
  employeeId: number | string;
  onError: (msg: string) => void;
}) {
  type Dep = {
    id: number | string;
    employee: number | string;
    name: string;
    relation: string;
    gender: "male" | "female" | "other" | null;
    phone_number_1: string | null;
    phone_number_2: string | null;
    address: string | null;
    comments: string | null;
  };

  const [rows, setRows] = useState<Dep[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const r = await api.get(EMPLOYEE_DEPENDENTS_ENDPOINT, {
        params: { employee: employeeId, page_size: 200 },
      });
      setRows(Array.isArray(r.data) ? r.data : r.data.results ?? []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [employeeId]);

  const [edit, setEdit] = useState<Dep | null>(null);
  const [openEditor, setOpenEditor] = useState(false);

  const cols: GridColDef<Dep>[] = [
    { field: "name", headerName: "Name", flex: 1, minWidth: 160 },
    { field: "relation", headerName: "Relation", width: 140 },
    { field: "gender", headerName: "Gender", width: 120 },
    { field: "phone_number_1", headerName: "Phone 1", width: 140 },
    { field: "phone_number_2", headerName: "Phone 2", width: 140 },
    { field: "address", headerName: "Address", flex: 1, minWidth: 160 },
    {
      field: "actions",
      headerName: "",
      width: 110,
      sortable: false,
      filterable: false,
      renderCell: (p) => (
        <Box sx={{ display: "flex", gap: 1 }}>
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
              if (!window.confirm("Delete this dependent?")) return;
              try {
                await api.delete(
                  `${EMPLOYEE_DEPENDENTS_ENDPOINT}${employeeId}/`
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
  ];

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
          Add dependent
        </Button>
      </Box>

      <DataGrid<Dep>
        autoHeight
        rows={rows}
        getRowId={(r) => r.id}
        columns={cols}
        loading={loading}
        disableRowSelectionOnClick
      />

      <EmployeeDependentEditorDialog
        open={openEditor}
        employeeId={employeeId}
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

function EmployeeDependentEditorDialog({
  open,
  employeeId,
  initial,
  onClose,
  onSaved,
  onError,
}: {
  open: boolean;
  employeeId: number | string;
  initial: any | null;
  onClose: () => void;
  onSaved: () => void;
  onError: (m: string) => void;
}) {
  const mode: "create" | "edit" = initial ? "edit" : "create";
  const [form, setForm] = useState<any>({
    name: "",
    relation: "",
    gender: null,
    phone_number_1: "",
    phone_number_2: "",
    address: "",
    comments: "",
  });

  useEffect(() => {
    if (initial) {
      setForm({
        name: initial.name ?? "",
        relation: initial.relation ?? "",
        gender: initial.gender ?? null,
        phone_number_1: initial.phone_number_1 ?? "",
        phone_number_2: initial.phone_number_2 ?? "",
        address: initial.address ?? "",
        comments: initial.comments ?? "",
      });
    } else {
      setForm({
        name: "",
        relation: "",
        gender: null,
        phone_number_1: "",
        phone_number_2: "",
        address: "",
        comments: "",
      });
    }
  }, [initial]);

  const save = async () => {
    try {
      if (mode === "create") {
        await api.post(EMPLOYEE_DEPENDENTS_ENDPOINT, {
          ...form,
          employee: employeeId,
        });
      } else {
        await api.patch(`${EMPLOYEE_DEPENDENTS_ENDPOINT}${initial.id}/`, form);
      }
      onSaved();
    } catch (e: any) {
      onError(e?.message ?? "Save failed");
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {mode === "create" ? "Add Dependent" : "Edit Dependent"}
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
            label="Name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            required
          />
          <TextField
            label="Relation"
            value={form.relation}
            onChange={(e) => setForm({ ...form, relation: e.target.value })}
            required
          />
          <TextField
            select
            label="Gender"
            value={form.gender ?? ""}
            onChange={(e) =>
              setForm({ ...form, gender: e.target.value || null })
            }
          >
            <MenuItem value="">{/* empty */}</MenuItem>
            <MenuItem value="male">Male</MenuItem>
            <MenuItem value="female">Female</MenuItem>
            <MenuItem value="other">Other/Unspecified</MenuItem>
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
            label="Address"
            value={form.address ?? ""}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
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
function EmployeeCareerTab({
  employeeId,
  onError,
}: {
  employeeId: number | string;
  onError: (m: string) => void;
}) {
  type Career = {
    id: number | string;
    employee: number | string;
    function: number | string;
    start_date: string;
    end_date: string | null;
    net_salary_due: string | null;
    notes: string;
  };
  type EmpFunction = { id: number | string; name: string };

  const [rows, setRows] = useState<Career[]>([]);
  const [funcs, setFuncs] = useState<EmpFunction[]>([]);
  const [loading, setLoading] = useState(false);

  const [openEdit, setOpenEdit] = useState(false);
  const [editing, setEditing] = useState<Career | null>(null);

  const empId = String(employeeId);
  const today = () => new Date().toISOString().slice(0, 10);

  const load = async () => {
    setLoading(true);
    try {
      const [rc, rf] = await Promise.all([
        api.get(EMPLOYEE_CAREERS_ENDPOINT, {
          params: { employee: empId, page_size: 200 },
        }),
        api.get(EMPLOYEE_FUNCTIONS_ENDPOINT),
      ]);
      setRows((Array.isArray(rc.data) ? rc.data : rc.data.results) ?? []);
      setFuncs((Array.isArray(rf.data) ? rf.data : rf.data.results) ?? []);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    load();
  }, [empId]);

  const openCurrent = () => rows.find((r) => !r.end_date);

  async function endCurrent() {
    const cur = openCurrent();
    if (!cur) return;
    if (!window.confirm("End current assignment?")) return;
    await api.patch(`${EMPLOYEE_CAREERS_ENDPOINT}${employeeId}/`);
    await load();
  }

  function openCreate() {
    setEditing({
      id: "" as any,
      employee: empId,
      function: "" as any,
      start_date: today(),
      end_date: null,
      net_salary_due: null,
      notes: "",
    });
    setOpenEdit(true);
  }
  function openEditRow(row: Career) {
    setEditing({ ...row });
    setOpenEdit(true);
  }

  async function saveEdit() {
    if (!editing) return;
    const payload = {
      employee: editing.employee,
      function: editing.function,
      start_date: editing.start_date,
      end_date: editing.end_date,
      net_salary_due: editing.net_salary_due,
      notes: editing.notes,
    };
    if (editing.id) {
      await api.patch(`${EMPLOYEE_CAREERS_ENDPOINT}${editing.id}/`, payload);
    } else {
      await api.post(EMPLOYEE_CAREERS_ENDPOINT, {
        ...payload,
        employee: empId,
      });
    }
    setOpenEdit(false);
    await load();
  }

  const cols: GridColDef<Career>[] = [
    { field: "start_date", headerName: "Start", width: 120 },
    { field: "end_date", headerName: "End", width: 120 },
    {
      field: "function",
      headerName: "Function",
      flex: 1,
      minWidth: 160,
      valueGetter: (_value, row) => {
        const f = funcs.find((x) => String(x.id) === String(row.function));
        return f?.name ?? row.function;
      },
    },
    { field: "net_salary_due", headerName: "Net salary due", width: 140 },
    { field: "notes", headerName: "Notes", flex: 1, minWidth: 160 },
    {
      field: "actions",
      headerName: "",
      width: 80,
      sortable: false,
      filterable: false,
      renderCell: (p) => (
        <IconButton onClick={() => openEditRow(p.row)} size="small">
          <EditIcon fontSize="small" />
        </IconButton>
      ),
    },
  ];

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: "flex", gap: 1, mb: 1, justifyContent: "flex-end" }}>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={openCreate}
          disabled={!!openCurrent()}
        >
          New assignment
        </Button>
        {/* <Button
          variant="outlined"
          onClick={endCurrent}
          disabled={!openCurrent()}
        >
          End current
        </Button> */}
      </Box>

      <DataGrid<Career>
        autoHeight
        rows={rows}
        getRowId={(r) => r.id}
        columns={cols}
        loading={loading}
        disableRowSelectionOnClick
      />

      <Dialog
        open={openEdit}
        onClose={() => setOpenEdit(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {editing?.id ? "Edit assignment" : "New assignment"}
        </DialogTitle>
        <DialogContent dividers>
          <Box sx={{ display: "grid", gap: 2, mt: 1 }}>
            <TextField
              select
              label="Function"
              value={editing?.function ?? ""}
              onChange={(e) =>
                setEditing((s) => (s ? { ...s, function: e.target.value } : s))
              }
              required
            >
              <MenuItem value="">{/* empty */}</MenuItem>
              {funcs.map((f) => (
                <MenuItem key={String(f.id)} value={f.id}>
                  {f.name}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Start date"
              type="date"
              value={editing?.start_date ?? ""}
              onChange={(e) =>
                setEditing((s) =>
                  s ? { ...s, start_date: e.target.value } : s
                )
              }
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              label="End date"
              type="date"
              value={editing?.end_date ?? ""}
              onChange={(e) =>
                setEditing((s) =>
                  s ? { ...s, end_date: e.target.value || null } : s
                )
              }
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Net salary due"
              type="number"
              value={editing?.net_salary_due ?? ""}
              onChange={(e) =>
                setEditing((s) =>
                  s ? { ...s, net_salary_due: e.target.value || null } : s
                )
              }
            />
            <TextField
              label="Notes"
              multiline
              minRows={2}
              value={editing?.notes ?? ""}
              onChange={(e) =>
                setEditing((s) => (s ? { ...s, notes: e.target.value } : s))
              }
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenEdit(false)}>Cancel</Button>
          <Button variant="contained" onClick={saveEdit}>
            Save
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
