// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import AppChrome from "./ui/AppChrome";
import StudentsPage from "./pages/StudentsPage";
import SuperuserPage from "./pages/SuperuserPage";
import EmployeesPage from "./pages/EmployeesPage";
import CoursesPage from "./pages/CoursesPage";
import TermsPage from "./pages/TermsPage";
import FinancePage from "./pages/FinancePage";
import HomePage from "./pages/HomePage";
import { CircularProgress, Box } from "@mui/material";

function AppLoading() {
  return (
    <Box sx={{ display: "grid", placeItems: "center", minHeight: "40vh" }}>
      <CircularProgress />
    </Box>
  );
}

function AppRoutes() {
  const { isAuthenticated, hasRole, authReady } = useAuth();

  const Protected: React.FC<{
    roles?: string[];
    children: React.ReactNode;
  }> = ({ roles, children }) => {
    if (!authReady) return <AppLoading />; // ⬅️ wait for hydration
    if (!isAuthenticated) return <Navigate to="/" replace />;
    if (roles && !roles.some((r) => hasRole(r)))
      return <Navigate to="/forbidden" replace />;
    return <>{children}</>;
  };

  const Forbidden = () => <div>Forbidden</div>;

  return (
    <AppChrome>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/dashboard" element={<Navigate to="/" replace />} />
        <Route path="/forbidden" element={<Forbidden />} />

        <Route
          path="/admin"
          element={
            <Protected roles={["superuser"]}>
              <SuperuserPage />
            </Protected>
          }
        />
        <Route
          path="/students"
          element={
            <Protected roles={["institute_admin"]}>
              <StudentsPage />
            </Protected>
          }
        />
        <Route
          path="/employees"
          element={
            <Protected roles={["institute_admin"]}>
              <EmployeesPage />
            </Protected>
          }
        />
        <Route
          path="/courses"
          element={
            <Protected roles={["institute_admin"]}>
              <CoursesPage />
            </Protected>
          }
        />
        <Route
          path="/terms"
          element={
            <Protected roles={["institute_admin"]}>
              <TermsPage />
            </Protected>
          }
        />
        <Route
          path="/finance"
          element={
            <Protected roles={["institute_admin", "superuser"]}>
              <FinancePage />
            </Protected>
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppChrome>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
