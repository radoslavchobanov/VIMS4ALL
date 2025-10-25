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

export default function HomePage() {
  const { user, hasRole, isAuthenticated, authReady } = useAuth();
  const nav = useNavigate();

  // show BLANK home when:
  // - auth not resolved yet
  // - not authenticated
  // - authenticated but missing institute
  const hasInstitute = !!(user?.institute_id || user?.institute);
  if (!authReady || !isAuthenticated || !hasInstitute) {
    return null; // blank screen by design
  }

  const emp = user.employee ?? null;
  const inst = user.institute ?? null;

  return (
    <Box>
      <ProfileCard
        firstName={emp?.first_name}
        lastName={emp?.last_name}
        functionName={emp?.function?.name ?? null}
        photoUrl={emp?.photo_url ?? null}
        username={user.username}
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

      <Box sx={{ mt: 3 }}>
        <Typography variant="overline" color="text.secondary">
          Quick actions
        </Typography>
        <Grid container spacing={2} sx={{ mt: 1 }}>
          {hasRole("institute_admin") && (
            <Grid item xs={12} sm={6} md={3}>
              <HomeTile
                title="Add Student"
                subtitle="Create a new student"
                icon={<PersonAddIcon />}
                onClick={() => nav("/students?mode=create")}
              />
            </Grid>
          )}
          {hasRole("institute_admin") && (
            <Grid item xs={12} sm={6} md={3}>
              <HomeTile
                title="Create Employee"
                subtitle="Register a new employee"
                icon={<WorkIcon />}
                onClick={() => nav("/employees?mode=create")}
              />
            </Grid>
          )}
          {(hasRole("institute_admin") || hasRole("superuser")) && (
            <Grid item xs={12} sm={6} md={3}>
              <HomeTile
                title="New Cash/Bank Entry"
                subtitle="Record payment or receipt"
                icon={<AccountBalanceWalletIcon />}
                onClick={() => nav("/finance?mode=new-entry")}
              />
            </Grid>
          )}
          <Grid item xs={12} sm={6} md={3}>
            <HomeTile
              title="Courses & Classes"
              subtitle="Browse and manage"
              icon={<SchoolIcon />}
              onClick={() => nav("/courses")}
            />
          </Grid>
        </Grid>
      </Box>
    </Box>
  );
}
