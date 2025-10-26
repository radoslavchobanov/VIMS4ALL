import { useEffect, useMemo, useState } from "react";
import { Box, Grid, Typography } from "@mui/material";
import { useAuth } from "../auth/AuthContext";
import { useNavigate } from "react-router-dom";
import { ProfileCard } from "../components/home/ProfileCard";
import { InstituteCard } from "../components/home/InstituteCard";
import { api } from "../lib/apiClient";
import { EMPLOYEE_PHOTO_ENDPOINT } from "../lib/endpoints";

export default function HomePage() {
  const { user, hasRole, isAuthenticated, authReady, refreshMe } = useAuth();
  const nav = useNavigate();
  const [photoVersion, setPhotoVersion] = useState(0);

  const hasInstitute = !!(user?.institute_id || user?.institute);
  useEffect(() => {
    if (!authReady || !isAuthenticated) return;
    const ctrl = new AbortController();
    refreshMe(ctrl.signal).catch(() => {
      /* ignore */
    });
    return () => ctrl.abort();
  }, [authReady, isAuthenticated, refreshMe]);
  if (!authReady || !isAuthenticated || !hasInstitute) return null;

  const emp = user!.employee!;
  const inst = user!.institute!;
  const employeeId = user!.employee_id;

  function bust(url: string | null | undefined, v: number) {
    if (!url) return null;
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}v=${v}`;
  }

  async function uploadEmployeePhoto(file: File) {
    const fd = new FormData();
    fd.append("photo", file);
    const { data } = await api.post(EMPLOYEE_PHOTO_ENDPOINT(employeeId), fd);
    setPhotoVersion((x) => x + 1);
    await refreshMe();
    setPhotoVersion((x) => x + 1);
  }

  return (
    <Box>
      <ProfileCard
        firstName={emp?.first_name}
        lastName={emp?.last_name}
        functionName={emp?.function?.name ?? null}
        photoUrl={bust(emp?.photo_url, photoVersion)}
        username={user?.username}
        uploadHandler={uploadEmployeePhoto}
      />

      <Box sx={{ mt: 2 }}>
        <InstituteCard
          name={inst?.name ?? "Your Institute"}
          abbr={inst?.abbr_name ?? inst?.short_name ?? null}
          imageUrl={inst?.logo_url ?? null}
          imageHeight={320}
          imageMaxWidth={1024}
          sx={{ mx: "auto" }}
        />
      </Box>

      {/* quick actions unchanged ... */}
    </Box>
  );
}
