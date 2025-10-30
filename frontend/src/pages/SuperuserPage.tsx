import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Paper,
  Typography,
  Snackbar,
  Alert,
  Tabs,
  Tab,
  TextField,
  MenuItem,
  Divider,
} from "@mui/material";
import { DataGrid, GridColDef } from "@mui/x-data-grid";

import { api } from "../lib/apiClient";
import {
  INSTITUTES_ENDPOINT,
  USERS_ENDPOINT,
  INSTITUTE_LOGO_ENDPOINT,
} from "../lib/endpoints";

import type { components } from "../api/__generated__/vims-types";

// Shared building blocks you already have
import { EntityFormDialog } from "../components/EntityFormDialog";
import { PhotoBox } from "../components/PhotoBox";

/* ================== OpenAPI Types ================== */
type InstituteRead = components["schemas"]["InstituteRead"];
type InstituteWrite = components["schemas"]["InstituteWrite"] | any; // if not generated yet
type UserLite = components["schemas"]["AccountAdminList"];

/* ================== Helpers ================== */
type Page<T> = {
  results: T[];
  count?: number;
  next?: string | null;
  previous?: string | null;
};

function asList<T>(resp: any): T[] {
  return Array.isArray(resp?.data)
    ? (resp.data as T[])
    : (resp?.data?.results as T[]) ?? [];
}

/* =============================================================================
   PAGE
============================================================================= */
export default function SuperuserPage() {
  const [tab, setTab] = useState(0);
  return (
    <Box>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Superuser
      </Typography>
      <Paper variant="outlined">
        <Tabs value={tab} onChange={(_, v) => setTab(v)}>
          <Tab label="Institutes" />
          <Tab label="Users" />
        </Tabs>
      </Paper>
      <Box sx={{ mt: 2 }}>
        {tab === 0 && <InstitutesPanel />}
        {tab === 1 && <UsersPanel />}
      </Box>
    </Box>
  );
}
/* =============================================================================
   INSTITUTES (list + create/edit dialog in the same style as Students)
============================================================================= */
function InstitutesPanel() {
  const [list, setList] = useState<InstituteRead[]>([]);
  const [loading, setLoading] = useState(false);
  const [openForm, setOpenForm] = useState(false);
  const [initial, setInitial] = useState<InstituteRead | undefined>(undefined);
  const [toast, setToast] = useState<{
    severity: "success" | "error";
    msg: string;
  } | null>(null);

  const columns = useMemo<GridColDef<InstituteRead>[]>(
    () => [
      { field: "id", headerName: "ID", width: 100 },
      { field: "name", headerName: "Name", flex: 1, minWidth: 200 },
      { field: "short_name", headerName: "Short", width: 120 },
      { field: "district", headerName: "District", width: 160 },
      { field: "county", headerName: "County", width: 160 },
      { field: "business_year_start", headerName: "Year Start", width: 140 },
      { field: "business_year_end", headerName: "Year End", width: 140 },
    ],
    []
  );

  async function load() {
    setLoading(true);
    try {
      const r = await api.get<InstituteRead[] | Page<InstituteRead>>(
        INSTITUTES_ENDPOINT,
        {
          params: { page_size: 100 },
        }
      );
      setList(asList<InstituteRead>(r));
    } catch (e: any) {
      setToast({
        severity: "error",
        msg: e?.response?.data?.detail ?? "Failed to load institutes",
      });
      setList([]);
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
  function openEdit(id: number | string) {
    const found = list.find((x) => String(x.id) === String(id));
    if (found) {
      setInitial(found);
      setOpenForm(true);
    }
  }

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="h6">Institutes</Typography>
          <Button variant="contained" onClick={openCreate}>
            Create Institute
          </Button>
        </Box>
        <div style={{ height: 520, width: "100%" }}>
          <DataGrid
            rows={list}
            columns={columns}
            getRowId={(r) => String(r.id)}
            loading={loading}
            pageSizeOptions={[25, 50, 100]}
            onRowClick={(p) => openEdit(p.row.id)}
            sx={{ "& .MuiDataGrid-row": { cursor: "pointer" } }}
          />
        </div>

        <InstituteForm
          open={openForm}
          initial={initial}
          onClose={() => setOpenForm(false)}
          onCreated={() => {
            setOpenForm(false);
            load();
            setToast({ severity: "success", msg: "Institute created" });
          }}
          onUpdated={() => {
            setOpenForm(false);
            load();
            setToast({ severity: "success", msg: "Institute updated" });
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
      </CardContent>
    </Card>
  );
}

/* -------------------- Institute Form (EntityFormDialog + tabs) -------------------- */
function InstituteForm({
  open,
  initial,
  onClose,
  onCreated,
  onUpdated,
  onError,
}: {
  open: boolean;
  initial?: InstituteRead;
  onClose: () => void;
  onCreated: () => void;
  onUpdated: () => void;
  onError: (msg: string) => void;
}) {
  const mode: "create" | "edit" = initial ? "edit" : "create";
  const [tab, setTab] = useState(0);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (open) setTab(0);
  }, [open, initial?.id]);

  useEffect(() => {
    setLogoUrl(initial?.logo_url ? `${initial.logo_url}` : undefined);
  }, [initial]);

  // empty payload factory
  const empty = (): InstituteWrite => ({
    name: "",
    short_name: "",
    business_year_start: "",
    business_year_end: "",
    post_office_box: "",
    phone: "",
    email: "",
    district: "",
    county: "",
    sub_county: "",
    parish: "",
    cell_village: "",
    registration_no: "",
    inst_nssf_no: "",
    inst_paye_no: "",
    taxflag: 0 as any,
    directions_and_comments: "",
  });

  // map read -> write
  const mapRead = (i: InstituteRead): InstituteWrite => ({
    name: i.name ?? "",
    short_name: i.short_name ?? "",
    business_year_start: i.business_year_start ?? "",
    business_year_end: i.business_year_end ?? "",
    post_office_box: i.post_office_box ?? "",
    phone: i.phone ?? "",
    email: i.email ?? "",
    district: i.district ?? "",
    county: i.county ?? "",
    sub_county: i.sub_county ?? "",
    parish: i.parish ?? "",
    cell_village: i.cell_village ?? "",
    registration_no: i.registration_no ?? "",
    inst_nssf_no: i.inst_nssf_no ?? "",
    inst_paye_no: i.inst_paye_no ?? "",
    taxflag: (i as any).taxflag ?? 0,
    directions_and_comments: i.directions_and_comments ?? "",
  });

  // normalize "" -> null for PATCH only
  function toNullPatch<T extends Record<string, unknown>>(obj: T): Partial<T> {
    const out: Partial<T> = {};
    (Object.keys(obj) as (keyof T)[]).forEach((k) => {
      const v = obj[k];
      if (v === undefined) return;
      out[k] = (v === "" ? null : v) as any;
    });
    return out;
  }

  const onSubmit = async (payload: InstituteWrite) => {
    if (mode === "create") {
      // send only filled fields on create (keeps server validation clean)
      const body = Object.fromEntries(
        Object.entries(payload).filter(([, v]) => v !== "" && v !== undefined)
      ) as Partial<InstituteWrite>;
      await api.post(INSTITUTES_ENDPOINT, body);
    } else {
      const body = toNullPatch(payload);
      await api.patch(`${INSTITUTES_ENDPOINT}${initial!.id}/`, body);
    }
  };

  return (
    <EntityFormDialog<InstituteWrite, InstituteRead>
      title={mode === "create" ? "Create Institute" : "Edit Institute"}
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
          src={logoUrl}
          initialsText={(initial?.short_name || initial?.name || "I")
            .slice(0, 3)
            .toUpperCase()}
          buildUploadUrl={(id) => INSTITUTE_LOGO_ENDPOINT(id)}
          formFieldName="logo"
          onUploaded={(u) => setLogoUrl(u)}
          onBlocked={() =>
            onError("Please create/save the institute first, then add a logo.")
          }
        />
      }
      renderFields={(form, setForm) => (
        <>
          <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 1 }}>
            <Tab label="General" />
            <Tab label="Location" />
            <Tab label="Registration & Tax" />
            <Tab label="Contacts" />
            <Tab label="Notes" />
          </Tabs>

          {tab === 0 && <InstituteGeneralTab form={form} setForm={setForm} />}
          {tab === 1 && <InstituteLocationTab form={form} setForm={setForm} />}
          {tab === 2 && (
            <InstituteRegistrationTab form={form} setForm={setForm} />
          )}
          {tab === 3 && <InstituteContactsTab form={form} setForm={setForm} />}
          {tab === 4 && (
            <TextField
              label="Directions and comments"
              multiline
              minRows={3}
              value={form.directions_and_comments ?? ""}
              onChange={(e) =>
                setForm({ directions_and_comments: e.target.value })
              }
            />
          )}
        </>
      )}
    />
  );
}

/* -------------------- Institute tabs -------------------- */

function InstituteGeneralTab({
  form,
  setForm,
}: {
  form: InstituteWrite;
  setForm: (patch: Partial<InstituteWrite>) => void;
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
          label="Short name"
          value={form.short_name ?? ""}
          onChange={(e) => setForm({ short_name: e.target.value })}
        />
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          mt: 1,
        }}
      >
        <TextField
          label="Business year start"
          type="date"
          value={form.business_year_start ?? ""}
          onChange={(e) => {
            const start = e.target.value;
            // optional convenience: auto-suggest end = start + 1y - 1d
            let end = form.business_year_end ?? "";
            if (start) {
              const d = new Date(start);
              if (!Number.isNaN(d.getTime())) {
                const y = new Date(d);
                y.setFullYear(y.getFullYear() + 1);
                y.setDate(y.getDate() - 1);
                end = y.toISOString().slice(0, 10);
              }
            }
            setForm({ business_year_start: start, business_year_end: end });
          }}
          InputLabelProps={{ shrink: true }}
        />
        <TextField
          label="Business year end"
          type="date"
          value={form.business_year_end ?? ""}
          onChange={(e) => setForm({ business_year_end: e.target.value })}
          InputLabelProps={{ shrink: true }}
        />
      </Box>
    </>
  );
}

function InstituteLocationTab({
  form,
  setForm,
}: {
  form: InstituteWrite;
  setForm: (patch: Partial<InstituteWrite>) => void;
}) {
  return (
    <>
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
          mt: 1,
        }}
      >
        <TextField
          label="Sub county"
          value={form.sub_county ?? ""}
          onChange={(e) => setForm({ sub_county: e.target.value })}
        />
        <TextField
          label="Parish"
          value={form.parish ?? ""}
          onChange={(e) => setForm({ parish: e.target.value })}
        />
      </Box>
      <TextField
        sx={{ mt: 1 }}
        label="Cell / Village"
        value={form.cell_village ?? ""}
        onChange={(e) => setForm({ cell_village: e.target.value })}
      />
    </>
  );
}

function InstituteRegistrationTab({
  form,
  setForm,
}: {
  form: InstituteWrite;
  setForm: (patch: Partial<InstituteWrite>) => void;
}) {
  return (
    <>
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
        }}
      >
        <TextField
          label="Registration No."
          value={form.registration_no ?? ""}
          onChange={(e) => setForm({ registration_no: e.target.value })}
        />
        <TextField
          select
          label="Tax flag"
          value={form.taxflag ?? 0}
          onChange={(e) => setForm({ taxflag: Number(e.target.value) })}
          helperText="0 or 1 (legacy compatible)"
        >
          <MenuItem value={0}>0</MenuItem>
          <MenuItem value={1}>1</MenuItem>
        </TextField>
      </Box>

      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          mt: 1,
        }}
      >
        <TextField
          label="Inst. NSSF Nr."
          value={form.inst_nssf_no ?? ""}
          onChange={(e) => setForm({ inst_nssf_no: e.target.value })}
        />
        <TextField
          label="Inst. PAYE Nr."
          value={form.inst_paye_no ?? ""}
          onChange={(e) => setForm({ inst_paye_no: e.target.value })}
        />
      </Box>
    </>
  );
}

function InstituteContactsTab({
  form,
  setForm,
}: {
  form: InstituteWrite;
  setForm: (patch: Partial<InstituteWrite>) => void;
}) {
  return (
    <>
      <TextField
        label="P.O. Box"
        value={form.post_office_box ?? ""}
        onChange={(e) => setForm({ post_office_box: e.target.value })}
      />
      <Box
        sx={{
          display: "grid",
          gap: 2,
          gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
          mt: 1,
        }}
      >
        <TextField
          label="Phone(s)"
          value={form.phone ?? ""}
          onChange={(e) => setForm({ phone: e.target.value })}
          helperText="Comma-separated (e.g. 075...,039...)"
        />
        <TextField
          label="Email"
          type="email"
          value={form.email ?? ""}
          onChange={(e) => setForm({ email: e.target.value })}
        />
      </Box>
      <Divider sx={{ my: 1.5 }} />
      <Typography variant="body2" color="text.secondary">
        Upload the institute logo from the sidebar once the record is saved.
      </Typography>
    </>
  );
}

/* =============================================================================
   USERS (unchanged list + create dialog from your version)
============================================================================= */

function UsersPanel() {
  const [rows, setRows] = useState<UserLite[]>([]);
  const [institutes, setInstitutes] = useState<InstituteRead[]>([]);
  const [open, setOpen] = useState(false);
  const [toast, setToast] = useState<{
    severity: "success" | "error";
    msg: string;
  } | null>(null);

  const columns = useMemo<GridColDef<UserLite>[]>(
    () => [
      { field: "id", headerName: "ID", width: 120 },
      { field: "username", headerName: "Username", flex: 1 },
      { field: "email", headerName: "Email", flex: 1 },
      { field: "institute_name", headerName: "Institute", width: 180 },
    ],
    []
  );

  async function load() {
    try {
      const [u, i] = await Promise.all([
        api.get(USERS_ENDPOINT),
        api.get(INSTITUTES_ENDPOINT),
      ]);
      setRows(asList<UserLite>(u));
      setInstitutes(asList<InstituteRead>(i));
    } catch (e: any) {
      setToast({
        severity: "error",
        msg: e?.response?.data?.detail ?? "Failed to load users/institutes",
      });
      setRows([]);
      setInstitutes([]);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="h6">Users</Typography>
          <Button variant="contained" onClick={() => setOpen(true)}>
            Create User
          </Button>
        </Box>

        <div style={{ height: 520, width: "100%" }}>
          <DataGrid
            rows={rows}
            columns={columns}
            getRowId={(r) => String(r.id)}
            disableRowSelectionOnClick
          />
        </div>

        <CreateUserDialog
          open={open}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            load();
            setToast({ severity: "success", msg: "User created" });
          }}
          onError={(msg) => setToast({ severity: "error", msg })}
          institutes={institutes}
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
      </CardContent>
    </Card>
  );
}

function CreateUserDialog({
  open,
  onClose,
  onCreated,
  onError,
  institutes,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onError: (m: string) => void;
  institutes: InstituteRead[];
}) {
  type UserCreateForm = {
    username: string;
    email?: string;
    password: string;
    make_institute_admin: boolean;
    is_active: boolean;
    is_staff: boolean;
    institute_id?: string; // keep as string in UI; convert to number/null on submit
  };

  const empty = (): UserCreateForm => ({
    username: "",
    email: "",
    password: "",
    make_institute_admin: true,
    is_active: true,
    is_staff: false,
    institute_id: "",
  });

  const onSubmit = async (form: UserCreateForm) => {
    // UI → API payload mapping
    const payload: components["schemas"]["AccountAdminCreateRequest"] = {
      username: form.username.trim(),
      email: form.email?.trim() || undefined,
      password: form.password,
      first_name: undefined,
      last_name: undefined,
      make_institute_admin: form.make_institute_admin,
      is_active: form.is_active,
      is_staff: form.is_staff,
      institute_id: form.make_institute_admin
        ? form.institute_id
          ? Number(form.institute_id)
          : null
        : null,
    };

    // simple guard when admin selected but no institute chosen
    if (
      payload.make_institute_admin &&
      (payload.institute_id === null || Number.isNaN(payload.institute_id))
    ) {
      throw new Error("Please select an institute for institute admins.");
    }

    await api.post(USERS_ENDPOINT, payload);
  };

  return (
    <EntityFormDialog<UserCreateForm, never>
      title="Create User"
      open={open}
      mode="create"
      initial={undefined}
      emptyFactory={empty}
      mapInitialToWrite={(x) => x as any} // unused for create
      onClose={onClose}
      onSubmit={onSubmit}
      onSuccess={onCreated}
      onError={(msg) =>
        onError(typeof msg === "string" ? msg : "Failed to create user")
      }
      // IMPORTANT: render **fields only** (no <form>, no action buttons)
      renderFields={(form, setForm) => (
        <Box sx={{ display: "grid", gap: 2 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2,
            }}
          >
            <TextField
              label="Username"
              value={form.username}
              onChange={(e) => setForm({ username: e.target.value })}
              required
            />
            <TextField
              label="Email"
              type="email"
              value={form.email ?? ""}
              onChange={(e) => setForm({ email: e.target.value })}
            />
          </Box>

          <TextField
            label="Password"
            type="password"
            value={form.password}
            onChange={(e) => setForm({ password: e.target.value })}
            required
          />

          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr 1fr" },
              gap: 2,
            }}
          >
            <TextField
              select
              label="Make Institute Admin"
              value={form.make_institute_admin ? "true" : "false"}
              onChange={(e) =>
                setForm({ make_institute_admin: e.target.value === "true" })
              }
              helperText="Adds the user to the 'institute_admin' group."
            >
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </TextField>

            {/* <TextField
              select
              label="Active"
              value={form.is_active ? "true" : "false"}
              onChange={(e) =>
                setForm({ is_active: e.target.value === "true" })
              }
            >
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Inactive</MenuItem>
            </TextField> */}

            {/* <TextField
              select
              label="Staff"
              value={form.is_staff ? "true" : "false"}
              onChange={(e) => setForm({ is_staff: e.target.value === "true" })}
              helperText="Allows login to Django admin."
            >
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </TextField> */}
          </Box>

          {form.make_institute_admin && (
            <TextField
              select
              label="Institute"
              value={form.institute_id ?? ""}
              onChange={(e) => setForm({ institute_id: e.target.value })}
              required
            >
              {institutes.map((i) => (
                <MenuItem key={String(i.id)} value={String(i.id)}>
                  {i.name}
                </MenuItem>
              ))}
            </TextField>
          )}

          <Divider />
          <Typography variant="body2" color="text.secondary">
            If <strong>Make Institute Admin</strong> is <em>Yes</em>, an
            institute must be selected.
          </Typography>
        </Box>
      )}
    />
  );
}
