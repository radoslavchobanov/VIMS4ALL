import { useEffect, useState } from "react";
import { Box, Grid, Typography } from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { ProfileCard } from "../components/home/ProfileCard";
import { InstituteCard } from "../components/home/InstituteCard";
import { HomeTile } from "../components/home/HomeTile";
import SchoolIcon from "@mui/icons-material/School";
import PersonAddIcon from "@mui/icons-material/PersonAdd";
import WorkIcon from "@mui/icons-material/Work";
import AccountBalanceWalletIcon from "@mui/icons-material/AccountBalanceWallet";
import TodayIcon from "@mui/icons-material/Today";
import { api } from "../lib/apiClient";
import { EMPLOYEE_PHOTO_ENDPOINT } from "../lib/endpoints";

export default function HomePage() {
  const { user, hasFunctionCode, isAuthenticated, authReady, refreshMe } =
    useAuth();
  const nav = useNavigate();

  // used to bust the browser cache after a new photo is uploaded
  const [photoVersion, setPhotoVersion] = useState(0);

  // blank home by design if not authenticated or no institute
  const hasInstitute = !!(user?.institute_id || user?.institute);
  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    const ctrl = new AbortController();
    // always refresh /me on enter (keeps name/photo/function fresh)
    refreshMe(ctrl.signal).catch(() => {
      /* ignore */
    });
    return () => ctrl.abort();
  }, [authReady, isAuthenticated, refreshMe]);

  if (!authReady || !isAuthenticated || !hasInstitute) return null;

  const emp = user!.employee!;
  const inst = user!.institute!;
  const employeeId = user!.employee_id;

  // add a cache-buster query param so the <img> updates after upload
  function bust(url?: string | null, v?: number) {
    if (!url) return null;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${v ?? 0}`;
  }

  async function uploadEmployeePhoto(file: File) {
    const fd = new FormData();
    fd.append("photo", file);
    await api.post(EMPLOYEE_PHOTO_ENDPOINT(employeeId), fd);
    // pull the fresh me (with new photo_url), then bump cache buster once
    await refreshMe();
    setPhotoVersion((x) => x + 1);
  }

  return (
    <Box>
      {/* Profile (avatar is clickable for upload) */}
      <ProfileCard
        epin={emp?.epin ?? null}
        firstName={emp?.first_name}
        lastName={emp?.last_name}
        functionName={emp?.function?.name ?? null}
        photoUrl={bust(emp?.photo_url, photoVersion)}
        username={user?.username}
        uploadHandler={uploadEmployeePhoto}
      />

      {/* Institute (centered content; big image) */}
      <Box sx={{ mt: 2 }}>
        <InstituteCard
          name={inst?.name ?? "Your Institute"}
          abbr={inst?.abbr_name ?? inst?.short_name ?? null}
          imageUrl={inst?.logo_url ?? null}
          activeTerm={inst?.active_term ?? null}
          imageHeight={320}
          imageMaxWidth={1024}
          sx={{ mx: "auto" }}
        />
      </Box>

      {/* Quick actions by function code */}
      <Box sx={{ mt: 3 }}>
        <Typography variant="overline" color="text.secondary">
          Quick actions
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {/* Registrar + Director */}
          {hasFunctionCode("director", "registrar") && (
            <>
              <Grid item xs={12} sm={6} md={3}>
                <HomeTile
                  title="Add Student"
                  subtitle="Create a new student"
                  icon={<PersonAddIcon />}
                  onClick={() => nav("/students?mode=create")}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <HomeTile
                  title="Create Employee"
                  subtitle="Register a new employee"
                  icon={<WorkIcon />}
                  onClick={() => nav("/employees?mode=create")}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <HomeTile
                  title="Courses & Classes"
                  subtitle="Browse and manage"
                  icon={<SchoolIcon />}
                  onClick={() => nav("/courses")}
                />
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <HomeTile
                  title="Academic Terms"
                  subtitle="Manage business periods"
                  icon={<TodayIcon />}
                  onClick={() => nav("/terms")}
                />
              </Grid>
            </>
          )}

          {/* Finance: Director + Accountant */}
          {hasFunctionCode("director", "accountant") && (
            <Grid item xs={12} sm={6} md={3}>
              <HomeTile
                title="New Cash/Bank Entry"
                subtitle="Record payment or receipt"
                icon={<AccountBalanceWalletIcon />}
                onClick={() => nav("/finance?mode=new-entry")}
              />
            </Grid>
          )}
        </Grid>
      </Box>
    </Box>
  );
}
