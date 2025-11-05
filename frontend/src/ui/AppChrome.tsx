import { useState, useEffect, PropsWithChildren } from "react";
import { useNavigate } from "react-router-dom";
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  AppBar,
  Toolbar,
  Typography,
  Box,
  IconButton,
  Drawer,
  List,
  ListItemButton,
  ListItemText,
  Button,
  TextField,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from "@mui/material";
import MenuIcon from "@mui/icons-material/Menu";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/apiClient";

const theme = createTheme({ palette: { mode: "light" } });

type MenuItem = {
  label: string;
  to: string;
  roles?: string[];
  funcCodes?: string[];
};

const MENU: MenuItem[] = [
  { label: "Home", to: "/home", roles: ["institute_admin"] },
  { label: "Superuser", to: "/admin", roles: ["superuser"] },
  {
    label: "Institute",
    to: "/institute",
    roles: ["institute_admin"],
  },
  {
    label: "Students",
    to: "/students",
    roles: ["institute_admin", "employee"],
    funcCodes: ["director", "registrar", "instructor"],
  },
  {
    label: "Employees",
    to: "/employees",
    roles: ["institute_admin", "employee"],
    funcCodes: ["director", "registrar"],
  },
  {
    label: "Courses",
    to: "/courses",
    roles: ["institute_admin", "employee"],
    funcCodes: ["director", "registrar", "instructor"],
  },
  {
    label: "Terms",
    to: "/terms",
    roles: ["institute_admin", "employee"],
    funcCodes: ["director", "registrar"],
  },

  { label: "Finance", to: "/finance", funcCodes: ["director", "accountant"] },
];

export default function AppChrome({ children }: PropsWithChildren) {
  const nav = useNavigate();
  const { user, isAuthenticated, hasRole, hasFunctionCode, login, logout } =
    useAuth();
  const [drawer, setDrawer] = useState(false);
  const [u, setU] = useState("");
  const [p, setP] = useState("");

  const items = MENU.filter((m) => {
    if (!isAuthenticated) return false;
    if (m.roles && !m.roles.some((r) => hasRole(r))) return false;
    if (m.funcCodes && !m.funcCodes.some((c) => hasFunctionCode(c)))
      return false;
    return true;
  });

  const [pwdOpen, setPwdOpen] = useState(false);
  const [pwd1, setPwd1] = useState("");
  const [pwd2, setPwd2] = useState("");
  const [pwdErr, setPwdErr] = useState("");

  useEffect(() => {
    if (isAuthenticated && user?.must_change_password) {
      setPwdOpen(true);
    } else {
      setPwdOpen(false);
    }
  }, [isAuthenticated, user]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await login(u, p);
    setU("");
    setP("");
    nav("/");
  }

  async function submitPasswordChange() {
    setPwdErr("");
    if (!pwd1 || pwd1.length < 6) {
      setPwdErr("Password must be at least 6 characters.");
      return;
    }
    if (pwd1 !== pwd2) {
      setPwdErr("Passwords do not match.");
      return;
    }

    try {
      await api.post("/api/auth/me/set-password/", {
        new_password: pwd1,
        confirm_password: pwd2,
      });
      setPwdOpen(false);
      setPwd1("");
      setPwd2("");
      // make sure your AuthContext/me reload clears the flag:
      // await refreshMe(); or mutate local state
      nav("/home");
    } catch (e: any) {
      setPwdErr(e?.response?.data?.detail ?? e?.message ?? "Update failed.");
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="static" color="default" elevation={1}>
        <Toolbar sx={{ gap: 2 }}>
          <IconButton edge="start" onClick={() => setDrawer(true)}>
            <MenuIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            VIMS
          </Typography>

          {!isAuthenticated ? (
            <Box
              component="form"
              onSubmit={onSubmit}
              sx={{ display: "flex", gap: 1 }}
            >
              <TextField
                size="small"
                label="Username"
                value={u}
                onChange={(e) => setU(e.target.value)}
              />
              <TextField
                size="small"
                type="password"
                label="Password"
                value={p}
                onChange={(e) => setP(e.target.value)}
              />
              <Button type="submit" variant="contained">
                Login
              </Button>
            </Box>
          ) : (
            <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
              <Typography variant="body2">
                Signed in as <b>{user?.username}</b>
              </Typography>
              <Button variant="outlined" onClick={logout}>
                Logout
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      <Drawer open={drawer} onClose={() => setDrawer(false)}>
        <Box sx={{ width: 260 }}>
          <Typography variant="h6" sx={{ p: 2 }}>
            Navigation
          </Typography>
          <Divider />
          <List>
            {items.map((i) => (
              <ListItemButton
                key={i.to}
                onClick={() => {
                  nav(i.to);
                  setDrawer(false);
                }}
              >
                <ListItemText primary={i.label} />
              </ListItemButton>
            ))}
          </List>
        </Box>
      </Drawer>

      {/* FORCE PASSWORD CHANGE MODAL */}
      <Dialog
        open={pwdOpen}
        disableEscapeKeyDown
        onClose={() => {
          /* block close while required */
        }}
      >
        <DialogTitle>Set a new password</DialogTitle>
        <DialogContent sx={{ pt: 2, minWidth: 420 }}>
          <Typography variant="body2" sx={{ mb: 2 }}>
            For security, please set a new password before continuing.
          </Typography>
          <TextField
            fullWidth
            label="New password"
            type="password"
            margin="dense"
            value={pwd1}
            onChange={(e) => setPwd1(e.target.value)}
          />
          <TextField
            fullWidth
            label="Confirm new password"
            type="password"
            margin="dense"
            value={pwd2}
            onChange={(e) => setPwd2(e.target.value)}
          />
          {pwdErr && (
            <Typography variant="caption" color="error">
              {pwdErr}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          {/* Intentionally no "Cancel" to force completion */}
          <Button variant="contained" onClick={submitPasswordChange}>
            Save password
          </Button>
        </DialogActions>
      </Dialog>

      <Box component="main" sx={{ p: 3, maxWidth: 1200, mx: "auto" }}>
        {children}
      </Box>
    </ThemeProvider>
  );
}
