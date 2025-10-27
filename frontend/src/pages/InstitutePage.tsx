import { useEffect, useMemo, useState } from "react";
import {
  Paper,
  Box,
  Typography,
  TextField,
  Button,
  Snackbar,
  Alert,
  CircularProgress,
} from "@mui/material";
import { api } from "../lib/apiClient";
import {
  INSTITUTE_ENDPOINT,
  INSTITUTE_LOGO_UPLOAD_ENDPOINT,
} from "../lib/endpoints";
import { useAuth } from "../auth/AuthContext";
import { PhotoBox } from "../components/PhotoBox";

type Institute = Record<string, any> & {
  id: number;
  logo_url?: string;
};

const EXCLUDE_KEYS = new Set([
  "id",
  "logo_url",
  "created_at",
  "updated_at",
  "logo_key",
]);

// Nice labels for known fields; unknown keys fall back to Title Case.
const LABELS: Record<string, string> = {
  name: "Name",
  abbr_name: "Abbreviation",
  email: "Email",
  phone_number: "Phone",
  website: "Website",
  address: "Address",
  district: "District",
  county: "County",
  sub_county_division: "Sub-county / Division",
  parish: "Parish",
  cell_village: "Cell / Village",
};

// Optional order for common fields; leftovers will appear after in alpha order.
const FIELD_ORDER = [
  "name",
  "abbr_name",
  "email",
  "phone_number",
  "website",
  "address",
  "district",
  "county",
  "sub_county_division",
  "parish",
  "cell_village",
];

function toTitle(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}

function inputTypeFor(
  key: string,
  value: any
): React.InputHTMLAttributes<any>["type"] {
  const k = key.toLowerCase();
  if (k.includes("email")) return "email";
  if (k.includes("website") || k.includes("url")) return "url";
  if (k.endsWith("_date") || k === "start_date" || k === "end_date")
    return "date";
  if (typeof value === "number") return "number";
  return "text";
}

function normalizeForPatch(obj: Record<string, any>) {
  const out: Record<string, any> = {};
  Object.entries(obj).forEach(([k, v]) => {
    if (EXCLUDE_KEYS.has(k)) return;
    out[k] = v === "" ? null : v;
  });
  return out;
}

function shallowEqual(a: Record<string, any>, b: Record<string, any>) {
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export default function InstitutePage() {
  const { user } = useAuth();
  const instituteId: number | undefined = (user as any)?.institute_id;
  const [data, setData] = useState<Institute | null>(null);
  const [form, setForm] = useState<Record<string, any>>({});
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    severity: "success" | "error" | "info";
    msg: string;
  } | null>(null);

  // Build ordered list of editable keys based on API payload
  const keys = useMemo(() => {
    if (!data) return [] as string[];
    const all = Object.keys(data).filter((k) => !EXCLUDE_KEYS.has(k));
    const ordered = FIELD_ORDER.filter((k) => all.includes(k));
    const leftovers = all
      .filter((k) => !FIELD_ORDER.includes(k))
      .sort((a, b) => a.localeCompare(b));
    return [...ordered, ...leftovers];
  }, [data]);

  const dirty = useMemo(() => {
    if (!data) return false;
    const baseline: Record<string, any> = {};
    keys.forEach((k) => (baseline[k] = data[k] ?? ""));
    return !shallowEqual(baseline, form);
  }, [data, form, keys]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      if (!instituteId) return;
      setLoading(true);
      try {
        const r = await api.get<Institute>(
          `${INSTITUTE_ENDPOINT}${instituteId}/`
        );
        if (cancelled) return;
        setData(r.data);
        // initialize form with string defaults to avoid uncontrolled warnings
        const initial: Record<string, any> = {};
        Object.entries(r.data).forEach(([k, v]) => {
          if (EXCLUDE_KEYS.has(k)) return;
          initial[k] = v ?? "";
        });
        setForm(initial);
      } catch (e: any) {
        if (!cancelled)
          setToast({ severity: "error", msg: e?.message ?? "Load failed" });
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [instituteId]);

  const save = async () => {
    if (!instituteId) return;
    try {
      setBusy(true);
      const body = normalizeForPatch(form);
      await api.patch(`${INSTITUTE_ENDPOINT}${instituteId}/`, body);
      const r = await api.get<Institute>(
        `${INSTITUTE_ENDPOINT}${instituteId}/`
      );
      setData(r.data);
      const refreshed: Record<string, any> = {};
      Object.entries(r.data).forEach(([k, v]) => {
        if (EXCLUDE_KEYS.has(k)) return;
        refreshed[k] = v ?? "";
      });
      setForm(refreshed);
      setToast({ severity: "success", msg: "Institute updated" });
    } catch (e: any) {
      setToast({ severity: "error", msg: e?.message ?? "Save failed" });
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    if (!data) return;
    const baseline: Record<string, any> = {};
    Object.entries(data).forEach(([k, v]) => {
      if (EXCLUDE_KEYS.has(k)) return;
      baseline[k] = v ?? "";
    });
    setForm(baseline);
  };

  if (!instituteId) {
    return (
      <Paper sx={{ p: 2 }}>
        <Alert severity="warning">
          Missing <code>user.institute_id</code> in AuthContext. Add it to the
          JWT/user payload so this page can load.
        </Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 2 }}>
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          mb: 2,
          gap: 1,
        }}
      >
        <Typography variant="h6">Institute</Typography>
        <Box sx={{ display: "flex", gap: 1 }}>
          <Button onClick={reset} disabled={busy || !dirty}>
            Reset
          </Button>
          <Button variant="contained" onClick={save} disabled={busy || !dirty}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </Box>
      </Box>

      {loading ? (
        <Box sx={{ display: "grid", placeItems: "center", minHeight: 200 }}>
          <CircularProgress />
        </Box>
      ) : (
        <Box
          sx={{
            display: "grid",
            gridTemplateColumns: { xs: "1fr", md: "280px 1fr" },
            gap: 3,
          }}
        >
          {/* Logo */}
          <PhotoBox
            mode="edit"
            entityId={data?.id}
            src={data?.logo_url}
            initialsText={data?.abbr_name ?? data?.name ?? "Institute"}
            buildUploadUrl={(id) => INSTITUTE_LOGO_UPLOAD_ENDPOINT(id!)}
            onUploaded={async () => {
              // refresh just the object (cheap)
              const r = await api.get<Institute>(
                `${INSTITUTE_ENDPOINT}${instituteId}/`
              );
              setData(r.data);
            }}
            onBlocked={() =>
              setToast({ severity: "error", msg: "Not allowed" })
            }
          />

          {/* Dynamic fields */}
          <Box
            sx={{
              display: "grid",
              gap: 2,
              gridTemplateColumns: { xs: "1fr", md: "1fr 1fr" },
            }}
          >
            {keys.map((k) => (
              <TextField
                key={k}
                label={LABELS[k] ?? toTitle(k)}
                type={inputTypeFor(k, form[k])}
                value={form[k] ?? ""}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, [k]: e.target.value }))
                }
                InputLabelProps={{
                  shrink:
                    inputTypeFor(k, form[k]) === "date" ? true : undefined,
                }}
              />
            ))}
          </Box>
        </Box>
      )}

      {toast && (
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
      )}
    </Paper>
  );
}
