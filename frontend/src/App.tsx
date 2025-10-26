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
    funcCodes?: string[];
    children: React.ReactNode;
  }> = ({ roles, funcCodes, children }) => {
    const { isAuthenticated, hasRole, hasFunctionCode } = useAuth();
    if (!authReady) return <AppLoading />;
    if (!isAuthenticated) return <Navigate to="/" replace />;
    if (roles && !hasRole(...roles))
      return <Navigate to="/forbidden" replace />;
    if (funcCodes && !hasFunctionCode(...funcCodes))
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

        {/* Registrar + Director */}
        <Route
          path="/students"
          element={
            <Protected funcCodes={["director", "registrar"]}>
              <StudentsPage />
            </Protected>
          }
        />
        <Route
          path="/employees"
          element={
            <Protected funcCodes={["director", "registrar"]}>
              <EmployeesPage />
            </Protected>
          }
        />
        <Route
          path="/courses"
          element={
            <Protected funcCodes={["director", "registrar"]}>
              <CoursesPage />
            </Protected>
          }
        />
        <Route
          path="/terms"
          element={
            <Protected funcCodes={["director", "registrar"]}>
              <TermsPage />
            </Protected>
          }
        />

        {/* Finance: Director + Accountant */}
        <Route
          path="/finance"
          element={
            <Protected funcCodes={["director", "accountant"]}>
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
