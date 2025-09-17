import { useEffect, useMemo, useState } from "react";
import {
  Box,
  Button,
  Card,
  CardContent,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  TextField,
  MenuItem,
  Paper,
  Typography,
  Snackbar,
  Alert,
  Divider,
} from "@mui/material";
import { Grid } from "@mui/material";
import { DataGrid, GridColDef, GridRenderCellParams } from "@mui/x-data-grid";
import { api } from "../lib/apiClient";
import { INSTITUTES_ENDPOINT, USERS_ENDPOINT } from "../lib/endpoints";

import type { components } from "../api/__generated__/vims-types";
type Institute = components["schemas"]["InstituteRead"];
type UserLite = components["schemas"]["AccountAdminList"];

const rolesOptions = [
  { value: "superuser", label: "Superuser" },
  { value: "institute_admin", label: "Institute admin" },
];

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

/* -------------------- Institutes -------------------- */

function InstitutesPanel() {
  const [rows, setRows] = useState<Institute[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{
    severity: "success" | "error";
    msg: string;
  } | null>(null);

  const columns = useMemo<GridColDef<Institute>[]>(
    () => [
      { field: "id", headerName: "ID", width: 120 },
      { field: "name", headerName: "Name", flex: 1 },
      { field: "business_year_start", headerName: "Year Start", width: 150 },
      { field: "business_year_end", headerName: "Year End", width: 150 },
    ],
    []
  );

  async function load() {
    setLoading(true);
    try {
      const r = await api.get(INSTITUTES_ENDPOINT);
      const data = r.data?.results ?? r.data;
      setRows(Array.isArray(data) ? data : []);
    } catch (e: any) {
      setToast({
        severity: "error",
        msg: e?.response?.data?.detail ?? "Failed to load institutes",
      });
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <Card>
      <CardContent>
        <Box sx={{ display: "flex", justifyContent: "space-between", mb: 2 }}>
          <Typography variant="h6">Institutes</Typography>
          <Button variant="contained" onClick={() => setOpen(true)}>
            Create Institute
          </Button>
        </Box>
        <div style={{ height: 520, width: "100%" }}>
          <DataGrid
            rows={rows}
            columns={columns}
            getRowId={(r) => String(r.id)}
            disableRowSelectionOnClick
            loading={loading}
            pageSizeOptions={[25, 50, 100]}
          />
        </div>
        <CreateInstituteDialog
          open={open}
          onClose={() => setOpen(false)}
          onCreated={() => {
            setOpen(false);
            load();
            setToast({ severity: "success", msg: "Institute created" });
          }}
          onError={(msg) => setToast({ severity: "error", msg })}
          setLoading={setLoading}
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

function CreateInstituteDialog({
  open,
  onClose,
  onCreated,
  onError,
  setLoading,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  onError: (m: string) => void;
  setLoading: (b: boolean) => void;
}) {
  const todayISO = new Date().toISOString().slice(0, 10);
  const [name, setName] = useState("");
  const [start, setStart] = useState(todayISO);
  const [end, setEnd] = useState(calcYearEnd(todayISO)); // auto-fill
  const [submitting, setSubmitting] = useState(false);

  function calcYearEnd(s: string): string {
    // e.g., start 2025-04-15 -> end 2026-04-14 (one year minus one day)
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return todayISO;
    const y = new Date(d);
    y.setFullYear(y.getFullYear() + 1);
    y.setDate(y.getDate() - 1);
    return y.toISOString().slice(0, 10);
  }

  function onStartChange(val: string) {
    setStart(val);
    setEnd(calcYearEnd(val));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setLoading(true);
    try {
      await api.post(INSTITUTES_ENDPOINT, {
        name: name.trim(),
        business_year_start: start,
        business_year_end: end,
      });
      setName("");
      setStart(todayISO);
      setEnd(calcYearEnd(todayISO));
      onCreated();
    } catch (err: any) {
      onError(err?.response?.data?.detail ?? "Failed to create institute");
    } finally {
      setSubmitting(false);
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Create Institute</DialogTitle>
      <Box component="form" onSubmit={submit}>
        <DialogContent sx={{ display: "grid", gap: 2 }}>
          <TextField
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2,
            }}
          >
            <TextField
              label="Business Year Start"
              type="date"
              value={start}
              onChange={(e) => onStartChange(e.target.value)}
              InputLabelProps={{ shrink: true }}
              required
            />
            <TextField
              label="Business Year End"
              type="date"
              value={end}
              onChange={(e) => setEnd(e.target.value)}
              InputLabelProps={{ shrink: true }}
              required
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button type="submit" variant="contained" disabled={submitting}>
            Create
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}

/* -------------------- Users -------------------- */

function UsersPanel() {
  const [rows, setRows] = useState<UserLite[]>([]);
  const [institutes, setInstitutes] = useState<Institute[]>([]);
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
      { field: "institute_name", headerName: "Institute", width: 160 },
    ],
    []
  );

  async function load() {
    try {
      const [u, i] = await Promise.all([
        api.get(USERS_ENDPOINT),
        api.get(INSTITUTES_ENDPOINT),
      ]);
      setRows(u.data?.results ?? u.data ?? []);
      setInstitutes(i.data?.results ?? i.data ?? []);
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
  institutes: Institute[];
}) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // replaced "role" with explicit flags expected by backend
  const [makeInstituteAdmin, setMakeInstituteAdmin] = useState<boolean>(true);
  const [isActive, setIsActive] = useState<boolean>(true);
  const [isStaff, setIsStaff] = useState<boolean>(false);

  const [instituteId, setInstituteId] = useState<string>("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    // build payload according to AccountAdminCreateRequest
    const payload: components["schemas"]["AccountAdminCreateRequest"] = {
      username: username.trim(),
      email: email.trim() || undefined,
      password,
      first_name: undefined,
      last_name: undefined,
      institute_id: makeInstituteAdmin
        ? instituteId
          ? Number(instituteId)
          : null
        : null,
      make_institute_admin: makeInstituteAdmin,
      is_active: isActive,
      is_staff: isStaff,
    };

    try {
      await api.post(USERS_ENDPOINT, payload);
      // reset only on successful submit
      setUsername("");
      setEmail("");
      setPassword("");
      setMakeInstituteAdmin(true);
      setIsActive(true);
      setIsStaff(false);
      setInstituteId("");
      onCreated();
    } catch (err: any) {
      // try to surface server-side validation detail
      const msg =
        err?.response?.data?.detail ||
        (typeof err?.response?.data === "string"
          ? err.response.data
          : "Failed to create user");
      onError(msg);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm">
      <DialogTitle>Create User</DialogTitle>
      <Box component="form" onSubmit={submit}>
        <DialogContent sx={{ display: "grid", gap: 2 }}>
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
              gap: 2,
            }}
          >
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
            <TextField
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Box>

          <TextField
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {/* Flags that map 1:1 to serializer fields */}
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
              value={makeInstituteAdmin ? "true" : "false"}
              onChange={(e) => setMakeInstituteAdmin(e.target.value === "true")}
              helperText="Adds the user to the 'institute_admin' group."
            >
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </TextField>

            <TextField
              select
              label="Active"
              value={isActive ? "true" : "false"}
              onChange={(e) => setIsActive(e.target.value === "true")}
            >
              <MenuItem value="true">Active</MenuItem>
              <MenuItem value="false">Inactive</MenuItem>
            </TextField>

            <TextField
              select
              label="Staff"
              value={isStaff ? "true" : "false"}
              onChange={(e) => setIsStaff(e.target.value === "true")}
              helperText="Allows login to Django admin."
            >
              <MenuItem value="true">Yes</MenuItem>
              <MenuItem value="false">No</MenuItem>
            </TextField>
          </Box>

          {/* Institute is required only if make_institute_admin === true */}
          {makeInstituteAdmin && (
            <TextField
              select
              label="Institute"
              value={instituteId}
              onChange={(e) => setInstituteId(e.target.value)}
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
            If <strong>Make Institute Admin</strong> is set to <em>Yes</em>, an
            institute must be selected (server validation enforces this).
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="contained">
            Create
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
}
