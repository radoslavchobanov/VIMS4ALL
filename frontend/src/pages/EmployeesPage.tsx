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
import { PhotoBox } from "../components/PhotoBox";
import { useChoices } from "../hooks/useChoices";

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
        "/api/employees/",
        {
          params: { page_size: 50 },
        }
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

  // Choices: gender, family_state
  const choices = useChoices("/api/employees/", ["gender", "family_state"]);

  // photo local state (schema may not expose photo_url yet — we read via `any`)
  const [photoUrl, setPhotoUrl] = useState<string | undefined>(undefined);
  useEffect(() => {
    const any = (initial as any) ?? {};
    setPhotoUrl(any[F.photo_url] ? String(any[F.photo_url]) : undefined);
  }, [initial]);

  const empty = (): EmployeeWrite =>
    ({
      [F.first_name]: "",
      [F.last_name]: "",
      [F.date_of_birth]: "",
      [F.gender]: null,
      [F.family_state]: null,
      [F.phone_number]: "",
      [F.email]: "",
      [F.national_id]: "",
      [F.nssf_id]: "",
      [F.paye_id]: "",
      [F.nationality]: "",
      [F.district]: "",
      [F.country]: "",
      [F.sub_country]: "",
      [F.parish]: "",
      [F.cell_village]: "",
      [F.previous_employer]: "",
      [F.entry_date]: "",
      [F.exit_date]: "",
      [F.comments]: "",
    } as unknown as EmployeeWrite);

  const mapRead = (e: EmployeeRead): EmployeeWrite => {
    const any = e as any;
    return {
      [F.first_name]: any[F.first_name] ?? "",
      [F.last_name]: any[F.last_name] ?? "",
      [F.date_of_birth]: any[F.date_of_birth] ?? "",
      [F.gender]: any[F.gender] ?? null,
      [F.family_state]: any[F.family_state] ?? null,
      [F.phone_number]: any[F.phone_number] ?? "",
      [F.email]: any[F.email] ?? "",
      [F.national_id]: any[F.national_id] ?? "",
      [F.nssf_id]: any[F.nssf_id] ?? "",
      [F.paye_id]: any[F.paye_id] ?? "",
      [F.nationality]: any[F.nationality] ?? "",
      [F.district]: any[F.district] ?? "",
      [F.country]: any[F.country] ?? "",
      [F.sub_country]: any[F.sub_country] ?? "",
      [F.parish]: any[F.parish] ?? "",
      [F.cell_village]: any[F.cell_village] ?? "",
      [F.previous_employer]: any[F.previous_employer] ?? "",
      [F.entry_date]: any[F.entry_date] ?? "",
      [F.exit_date]: any[F.exit_date] ?? "",
      [F.comments]: any[F.comments] ?? "",
    } as EmployeeWrite;
  };

  const onSubmit = async (payload: EmployeeWrite) => {
    if (mode === "create") {
      await api.post("/api/employees/", normalizeCreate(payload));
    } else {
      const id = (initial as any)[F.id];
      await api.patch(`/api/employees/${id}/`, toNullPatch(payload));
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
          entityId={(initial as any)?.[F.id]}
          src={photoUrl}
          initialsText={`${(initial as any)?.[F.first_name] ?? ""} ${
            (initial as any)?.[F.last_name] ?? ""
          }`}
          buildUploadUrl={(id) => `/api/employees/${id}/photo/`}
          onUploaded={(u) => setPhotoUrl(u)}
          onBlocked={() =>
            onError("Please create/save the employee first, then add a photo.")
          }
        />
      }
      renderFields={(form, update) => (
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
              value={(form as any)[F.first_name] ?? ""}
              onChange={(e) =>
                update({ [F.first_name]: e.target.value } as any)
              }
              required
            />
            <TextField
              label="Family name"
              value={(form as any)[F.last_name] ?? ""}
              onChange={(e) => update({ [F.last_name]: e.target.value } as any)}
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
              value={(form as any)[F.date_of_birth] ?? ""}
              onChange={(e) =>
                update({ [F.date_of_birth]: e.target.value } as any)
              }
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Entry date"
              type="date"
              value={(form as any)[F.entry_date] ?? ""}
              onChange={(e) =>
                update({ [F.entry_date]: e.target.value } as any)
              }
              InputLabelProps={{ shrink: true }}
            />
            <TextField
              label="Exit date"
              type="date"
              value={(form as any)[F.exit_date] ?? ""}
              onChange={(e) => update({ [F.exit_date]: e.target.value } as any)}
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
              value={(form as any)[F.gender] ?? ""}
              onChange={(e) =>
                update({ [F.gender]: e.target.value as any } as any)
              }
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
              label="Family state"
              value={(form as any)[F.family_state] ?? ""}
              onChange={(e) =>
                update({ [F.family_state]: e.target.value as any } as any)
              }
            >
              <MenuItem value="">{/* empty */}</MenuItem>
              {(choices.family_state ?? []).map((c) => (
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
              value={(form as any)[F.phone_number] ?? ""}
              onChange={(e) =>
                update({ [F.phone_number]: e.target.value } as any)
              }
            />
            <TextField
              label="Email"
              type="email"
              value={(form as any)[F.email] ?? ""}
              onChange={(e) => update({ [F.email]: e.target.value } as any)}
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
              value={(form as any)[F.national_id] ?? ""}
              onChange={(e) =>
                update({ [F.national_id]: e.target.value } as any)
              }
            />
            <TextField
              label="Nationality"
              value={(form as any)[F.nationality] ?? ""}
              onChange={(e) =>
                update({ [F.nationality]: e.target.value } as any)
              }
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
              value={(form as any)[F.nssf_id] ?? ""}
              onChange={(e) => update({ [F.nssf_id]: e.target.value } as any)}
            />
            <TextField
              label="PAYE ID"
              value={(form as any)[F.paye_id] ?? ""}
              onChange={(e) => update({ [F.paye_id]: e.target.value } as any)}
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
              value={(form as any)[F.country] ?? ""}
              onChange={(e) => update({ [F.country]: e.target.value } as any)}
            />
            <TextField
              label="District"
              value={(form as any)[F.district] ?? ""}
              onChange={(e) => update({ [F.district]: e.target.value } as any)}
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
              value={(form as any)[F.sub_country] ?? ""}
              onChange={(e) =>
                update({ [F.sub_country]: e.target.value } as any)
              }
            />
            <TextField
              label="Parish"
              value={(form as any)[F.parish] ?? ""}
              onChange={(e) => update({ [F.parish]: e.target.value } as any)}
            />
          </Box>
          <TextField
            label="Cell/Village"
            value={(form as any)[F.cell_village] ?? ""}
            onChange={(e) =>
              update({ [F.cell_village]: e.target.value } as any)
            }
          />

          {/* Employment history */}
          <TextField
            label="Previous employer"
            value={(form as any)[F.previous_employer] ?? ""}
            onChange={(e) =>
              update({ [F.previous_employer]: e.target.value } as any)
            }
          />

          {/* Comments */}
          <TextField
            label="Comments"
            multiline
            minRows={3}
            value={(form as any)[F.comments] ?? ""}
            onChange={(e) => update({ [F.comments]: e.target.value } as any)}
          />
        </>
      )}
    />
  );
}
