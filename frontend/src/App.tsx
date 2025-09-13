// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import AppChrome from "./ui/AppChrome";
import StudentsPage from "./pages/StudentsPage";
import SuperuserPage from "./pages/SuperuserPage";

const Protected: React.FC<{ roles?: string[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { isAuthenticated, hasRole } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (roles && !hasRole(...roles)) return <Navigate to="/forbidden" replace />;
  return <>{children}</>;
};

const Dashboard = () => <div>Welcome to VIMS</div>;
const Forbidden = () => <div>Forbidden</div>;

const EmployeesPage = () => <div>Employees table here</div>;
const CoursesPage = () => <div>Courses table here</div>;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppChrome>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/forbidden" element={<Forbidden />} />

            <Route path="/admin" element={
              <Protected roles={["superuser"]}><SuperuserPage /></Protected>
            } />
            <Route path="/students" element={
              <Protected roles={["institute_admin"]}><StudentsPage /></Protected>
            } />
            <Route path="/employees" element={
              <Protected roles={["institute_admin"]}><EmployeesPage /></Protected>
            } />
            <Route path="/courses" element={
              <Protected roles={["institute_admin"]}><CoursesPage /></Protected>
            } />
          </Routes>
        </AppChrome>
      </BrowserRouter>
    </AuthProvider>
  );
}
