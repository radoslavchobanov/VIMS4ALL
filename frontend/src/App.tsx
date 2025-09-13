// src/App.tsx
import { BrowserRouter, Routes, Route, Navigate, Link } from "react-router-dom";
import { AuthProvider, useAuth } from "./auth/AuthContext";
import { LoginBar } from "./components/LoginBar";

const Protected: React.FC<{ roles?: string[]; children: React.ReactNode }> = ({ roles, children }) => {
  const { isAuthenticated, hasRole } = useAuth();
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (roles && !hasRole(...roles)) return <Navigate to="/forbidden" replace />;
  return <>{children}</>;
};

const Menu: React.FC = () => {
  const { hasRole } = useAuth();
  return (
    <nav className="flex gap-4 p-3 border-b">
      <Link to="/dashboard">Dashboard</Link>
      {hasRole("superuser") && <Link to="/admin">Superuser</Link>}
      {hasRole("institute_admin") && (
        <>
          <Link to="/students">Students</Link>
          <Link to="/employees">Employees</Link>
          <Link to="/courses">Courses</Link>
        </>
      )}
    </nav>
  );
};

const Dashboard = () => <div className="p-4">Welcome to VIMS</div>;
const Forbidden = () => <div className="p-4 text-red-600">Forbidden</div>;

// placeholders — replace with your table pages
const StudentsPage = () => <div className="p-4">Students table here</div>;
const EmployeesPage = () => <div className="p-4">Employees table here</div>;
const CoursesPage = () => <div className="p-4">Courses table here</div>;
const SuperuserPage = () => <div className="p-4">Create institutes/users</div>;

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <LoginBar />
        <Menu />
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
      </BrowserRouter>
    </AuthProvider>
  );
}
